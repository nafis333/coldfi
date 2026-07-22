import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { silentCatch } from '../../lib/errorHandler';
import { useNotificationStore } from '../../stores/notificationStore';

type NotificationType =
  | 'expense_added' | 'expense_updated'
  | 'settlement_proposed' | 'settlement_confirmed' | 'settlement_rejected'
  | 'group_invite' | 'member_joined' | 'member_left' | 'general';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  isRead: boolean;
  groupId?: string;
  expenseId?: string;
  settlementId?: string;
}

const NOTIFICATION_ICONS: Record<NotificationType, string> = {
  expense_added: '+',
  expense_updated: 'E',
  settlement_proposed: 'h',
  settlement_confirmed: 'OK',
  settlement_rejected: 'X',
  group_invite: 'Mail',
  member_joined: 'Wave',
  member_left: 'Exit',
  general: 'N',
};

function timeAgo(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function NotificationCard({
  notification,
  onPress,
  onMarkRead,
}: {
  notification: Notification;
  onPress: () => void;
  onMarkRead: () => void;
}) {
  const icon = NOTIFICATION_ICONS[notification.type] ?? 'N';

  return (
    <button
      onClick={onPress}
      className={`flex w-full items-start gap-3 sm:gap-4 rounded-2xl border p-4 text-left transition-all duration-200 ${
        !notification.isRead
          ? 'border-primary-200/80 dark:border-primary-800/50 bg-primary-50/60 dark:bg-primary-900/15 shadow-sm'
          : 'border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-800/80 hover:bg-neutral-50 dark:hover:bg-neutral-700/30 hover:shadow-sm'
      }`}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-700/60">
        <span className="text-base">{icon}</span>
        {!notification.isRead && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white dark:border-neutral-800 bg-primary-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!notification.isRead ? 'font-bold text-neutral-900 dark:text-white' : 'font-medium text-neutral-700 dark:text-neutral-300'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">{notification.body}</p>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{timeAgo(notification.timestamp)}</p>
      </div>
      {!notification.isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40 hover:bg-primary-200 dark:hover:bg-primary-800/40 transition-colors"
          title="Mark as read"
        >
          <svg className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </button>
      )}
    </button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    isLoading,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      try { await markAsRead(id); } catch (e) { silentCatch('NotificationsPage.markAsRead', e); console.error('Failed to mark notification as read:', e); }
    },
    [markAsRead]
  );

  const handleMarkAllRead = useCallback(async () => {
    try { await markAllAsRead(); } catch (e) { silentCatch('NotificationsPage.markAllAsRead', e); console.error('Failed to mark all notifications as read:', e); }
  }, [markAllAsRead]);

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) markAsRead(notification.id);
      if (notification.groupId) {
        navigate(`/groups/${notification.groupId}`);
      }
    },
    [navigate, markAsRead]
  );

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-white">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="btn-ghost text-sm"
          >
            Mark All Read
          </button>
        )}
      </div>

      {isLoading && notifications.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-100 dark:bg-success-900/20 mb-4">
            <svg className="h-8 w-8 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">All Caught Up!</p>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">No notifications yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n: Notification) => (
            <NotificationCard
              key={n.id}
              notification={n}
              onPress={() => handleNotificationPress(n)}
              onMarkRead={() => handleMarkRead(n.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
