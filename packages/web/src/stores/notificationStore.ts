import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';
import { onLogout } from '../lib/resetStores';

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

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  addNotification: (notification: Notification) => void;
  clearError: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  fetchNotifications: async () => {
    set({ isLoading: true, error: null });

    try {
      const res = await apiClient('/api/notifications');

      if (!res.ok) {
        throw new Error(`Failed to fetch notifications: ${res.status}`);
      }

      const data = await res.json();
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notifications',
      });
    }
  },

  markAsRead: async (id: string) => {
    try {
      await apiClient(`/api/notifications/${id}/read`, { method: 'PATCH' });

      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (err: any) {
      console.error('markAsRead failed:', err.message);
    }
  },

  markAllAsRead: async () => {
    try {
      await apiClient('/api/notifications/read-all', { method: 'POST' });

      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (err: any) {
      console.error('markAllAsRead failed:', err.message);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await apiClient(`/api/notifications/${id}`, { method: 'DELETE' });
      set((state) => {
        const removed = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: removed && !removed.isRead ? state.unreadCount - 1 : state.unreadCount,
        };
      });
    } catch {
      // Keep notification in local state — API call failed, don't optimistically remove
    }
  },

  clearError: () => set({ error: null }),

  addNotification: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },
}));

onLogout(() => {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
  });
});
