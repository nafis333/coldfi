import webpush from 'web-push';
import { Pool } from 'pg';
import { logger } from './logger';
import { config } from '../config';

if (config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY) {
  // web-push requires the subject to be a URL or mailto: address. Env schemas
  // accept a bare email, so normalize it here — a bad subject must never
  // crash the process at import time.
  let subject = config.VAPID_SUBJECT ?? '';
  if (!subject && config.VAPID_EMAIL) {
    subject = `mailto:${config.VAPID_EMAIL}`;
  }
  if (subject && !/^(https?:\/\/|mailto:)/i.test(subject)) {
    subject = `mailto:${subject}`;
  }
  try {
    webpush.setVapidDetails(
      subject || 'mailto:admin@coldfi.app',
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY
    );
  } catch (err) {
    logger.warn('VAPID subject rejected — push notifications disabled', { module: 'web-push', error: String(err) });
  }
}

const vapidConfigured = !!(config.VAPID_PUBLIC_KEY && config.VAPID_PRIVATE_KEY);

export interface WebPushSubscription {
  endpoint: string;
  auth: string;
  p256dh: string;
}

export interface SendNotificationInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  category?: string;
}

export interface NotificationPreferences {
  push_enabled: boolean;
  expense_created: boolean;
  expense_updated: boolean;
  expense_deleted: boolean;
  settlement_created: boolean;
  settlement_confirmed: boolean;
  settlement_rejected: boolean;
  member_joined: boolean;
  member_left: boolean;
  balance_adjusted: boolean;
  reminders: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  quiet_hours_enabled: boolean;
}

export class WebPushService {
  constructor(private pool: Pool) {}

  async subscribe(
    userId: string,
    subscription: WebPushSubscription
  ): Promise<string> {
    const { endpoint, auth, p256dh } = subscription;

    const result = await this.pool.query(
      `INSERT INTO push_subscriptions_web (user_id, endpoint, auth, p256dh)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET
         auth = EXCLUDED.auth,
         p256dh = EXCLUDED.p256dh
       RETURNING id`,
      [userId, endpoint, auth, p256dh]
    );

    return result.rows[0].id;
  }

  async unsubscribe(userId: string, endpoint: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM push_subscriptions_web
       WHERE user_id = $1 AND endpoint = $2`,
      [userId, endpoint]
    );

    return (result.rowCount ?? 0) > 0;
  }

  async removeAllSubscriptions(userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM push_subscriptions_web WHERE user_id = $1`,
      [userId]
    );
  }

  async sendWebPush(input: SendNotificationInput): Promise<number> {
    const { userId, title, body, data, category } = input;

    const prefs = await this.getPreferences(userId);
    if (prefs && !this.shouldSend(prefs, category)) {
      return 0;
    }

    const subscriptions = await this.getSubscriptions(userId);
    if (subscriptions.length === 0) return 0;

    if (prefs?.quiet_hours_enabled && this.isQuietHours(prefs)) {
      return 0;
    }

    if (!vapidConfigured) {
      logger.warn('VAPID keys not configured — skipping push notification', { module: 'web-push' });
      return 0;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/notification-icon.png',
      badge: '/icons/notification-badge.png',
      data: data ?? {},
    });

    let successCount = 0;
    const invalidEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              auth: sub.auth,
              p256dh: sub.p256dh,
            },
          },
          payload,
          { TTL: 86400 }
        );
        successCount++;
      } catch (error: unknown) {
        const err = error as { statusCode?: number; message?: string };
        if (err.statusCode === 410) {
          invalidEndpoints.push(sub.endpoint);
        } else {
          logger.error(`Failed to send to ${sub.endpoint}`, { module: 'web-push', error: err.message });
        }
      }
    }

    if (invalidEndpoints.length > 0) {
      await this.removeSubscriptionsByEndpoint(userId, invalidEndpoints);
    }

    return successCount;
  }

  async sendToUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    category?: string
  ): Promise<number> {
    const results = await Promise.allSettled(
      userIds.map(userId =>
        this.sendWebPush({ userId, title, body, data, category })
      )
    );
    return results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value : 0), 0);
  }

  async getPreferences(
    userId: string
  ): Promise<NotificationPreferences | null> {
    const result = await this.pool.query(
      `SELECT * FROM notification_preferences WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  async updatePreferences(
    userId: string,
    prefs: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const columns = Object.keys(prefs) as (keyof NotificationPreferences)[];
    const values = columns.map((col) => prefs[col]);
    const setClauses = columns
      .map((col, i) => `${col} = $${i + 2}`)
      .join(', ');

    const result = await this.pool.query(
      `INSERT INTO notification_preferences (user_id, ${columns.join(', ')})
       VALUES ($1, ${columns.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (user_id) DO UPDATE SET ${setClauses}, updated_at = now()
       RETURNING *`,
      [userId, ...values]
    );

    return result.rows[0];
  }

  isVapidConfigured(): boolean {
    return vapidConfigured;
  }

  async getSubscriptions(
    userId: string
  ): Promise<WebPushSubscription[]> {
    const result = await this.pool.query(
      `SELECT endpoint, auth, p256dh FROM push_subscriptions_web WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  private async removeSubscriptionsByEndpoint(
    userId: string,
    endpoints: string[]
  ): Promise<void> {
    await this.pool.query(
      `DELETE FROM push_subscriptions_web
       WHERE user_id = $1 AND endpoint = ANY($2)`,
      [userId, endpoints]
    );
  }

  private shouldSend(
    prefs: NotificationPreferences,
    category?: string
  ): boolean {
    if (!prefs.push_enabled) return false;
    if (!category) return true;

    const key = category as keyof NotificationPreferences;
    if (key in prefs && typeof prefs[key] === 'boolean') {
      return prefs[key] as boolean;
    }

    return true;
  }

  private isQuietHours(prefs: NotificationPreferences): boolean {
    if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = prefs.quiet_hours_start.split(':').map(Number);
    const [endH, endM] = prefs.quiet_hours_end.split(':').map(Number);
    const startMinutes = startH! * 60 + startM!;
    const endMinutes = endH! * 60 + endM!;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }
}

export function generateVapidKeys(): {
  publicKey: string;
  privateKey: string;
} {
  const keys = webpush.generateVAPIDKeys();
  return {
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}
