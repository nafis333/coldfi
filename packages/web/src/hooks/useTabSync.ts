import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { initTabSync, broadcastLogin, broadcastLogout } from '../lib/tabSync';

export function useTabSync() {
  const initialize = useAuthStore((s) => s.initialize);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const cleanup = initTabSync(
      () => {
        initialize();
      },
      async () => {
        await logout();
      }
    );
    return cleanup;
  }, [initialize, logout]);

  return { broadcastLogin, broadcastLogout };
}
