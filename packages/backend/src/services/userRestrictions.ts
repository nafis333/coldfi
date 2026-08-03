import { query } from '../db/pool';
import { AuthError } from '../errors';

export interface ActiveRestriction {
  type: string;
  expiresAt: Date | null;
}

const CACHE_TTL_MS = 30_000;
const restrictionCache = new Map<string, { checkedAt: number; restrictions: ActiveRestriction[] }>();

export async function getActiveRestrictions(userId: string): Promise<ActiveRestriction[]> {
  const result = await query<{ type: string; expires_at: string | null }>(
    `SELECT type, expires_at FROM user_restrictions
     WHERE user_id = $1 AND lifted_at IS NULL
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );
  return result.rows.map((r) => ({
    type: r.type,
    expiresAt: r.expires_at ? new Date(r.expires_at) : null,
  }));
}

export function invalidateRestrictionCache(userId?: string): void {
  if (userId) {
    restrictionCache.delete(userId);
  } else {
    restrictionCache.clear();
  }
}

export async function assertUserNotRestricted(userId: string): Promise<void> {
  const now = Date.now();
  const cached = restrictionCache.get(userId);
  let restrictions: ActiveRestriction[];

  if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
    restrictions = cached.restrictions;
  } else {
    restrictions = await getActiveRestrictions(userId);
    if (restrictionCache.size > 10_000) restrictionCache.clear();
    restrictionCache.set(userId, { checkedAt: now, restrictions });
  }

  if (restrictions.length === 0) return;

  if (restrictions.some((r) => r.type === 'banned')) {
    throw new AuthError('ERR_ACCOUNT_BANNED', 'This account has been banned. Contact support for assistance.', 403);
  }
  if (restrictions.some((r) => r.type === 'suspended')) {
    throw new AuthError('ERR_ACCOUNT_SUSPENDED', 'This account has been suspended.', 403);
  }
}
