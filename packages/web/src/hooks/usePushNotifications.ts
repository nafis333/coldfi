import { useCallback, useEffect, useRef, useState } from 'react';

export function usePushNotifications() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window) {
      setEnabled(Notification.permission === 'granted');
    }
  }, []);

  const enable = useCallback(async () => {
    cancelledRef.current = false;
    setLoading(true);
    try {
      const { initializePushNotifications } = await import('../lib/pushNotifications');
      const result = await initializePushNotifications();
      if (!cancelledRef.current) setEnabled(result);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => { cancelledRef.current = true; };
  }, []);

  return { enabled, loading, enable };
}
