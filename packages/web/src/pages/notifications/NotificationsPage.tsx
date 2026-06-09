import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        !notification.isRead
          ? 'border-primary-200 bg-primary-50/50'
          : 'border-neutral-200 bg-white hover:bg-neutral-50'
      }`}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100">
        <span className="text-lg">{icon}</span>
        {!notification.isRead && (
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!notification.isRead ? 'font-bold text-neutral-900' : 'font-semibold text-neutral-700'}`}>
          {notification.title}
        </p>
        <p className="mb-1 line-clamp-2 text-xs text-neutral-500">{notification.body}</p>
        <p className="text-xs text-neutral-400">{timeAgo(notification.timestamp)}</p>
      </div>
      {!notification.isRead && (
        <button
          onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-100 hover:bg-primary-200"
        >
          <span className="text-xs font-bold text-primary-600">OK</span>
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
      try { await markAsRead(id); } catch {}
    },
    [markAsRead]
  );

  const handleMarkAllRead = useCallback(async () => {
    try { await markAllAsRead(); } catch {}
  }, [markAllAsRead]);

  const handleNotificationPress = useCallback(
    (notification: Notification) => {
      if (!notification.isRead) markAsRead(notification.id);
      if (notification.settlementId && notification.groupId) {
        navigate(`/groups/${notification.groupId}/settlements`);
      } else if (notification.groupId) {
        navigate(`/groups/${notification.groupId}`);
      }
    },
    [navigate, markAsRead]
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-base text-primary-600">({unreadCount})</span>
          )}
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            Mark All Read
          </button>
        )}
      </div>

      {isLoading && notifications.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-20 text-center">
          <p className="mb-2 text-xl font-bold text-neutral-900">All Caught Up!</p>
          <p className="text-sm text-neutral-500">No notifications yet.</p>
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
