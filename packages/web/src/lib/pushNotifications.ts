const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Push] Service workers not supported');
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.error('[Push] Service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) {
    console.warn('[Push] Push API not supported');
    return null;
  }

  let subscription = await registration.pushManager.getSubscription();
  if (subscription) return subscription;

  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
    });
    return subscription;
  } catch (err: any) {
    if (err.name === 'NotAllowedError') {
      console.warn('[Push] Notification permission denied');
    } else {
      console.error('[Push] Subscription failed:', err);
    }
    return null;
  }
}

export async function sendSubscriptionToServer(
  subscription: PushSubscription
): Promise<void> {
  const json = subscription.toJSON();
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}/api/notifications/push/subscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      endpoint: json.endpoint,
      auth: json.keys?.auth,
      p256dh: json.keys?.p256dh,
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to register push subscription');
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return;
  }
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
    const token = localStorage.getItem('accessToken');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`${API_BASE}/api/notifications/push/unsubscribe`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  }
}

export async function initializePushNotifications(): Promise<boolean> {
  const registration = await registerServiceWorker();
  if (!registration) return false;

  const permission = await requestNotificationPermission();
  if (!permission) return false;

  const subscription = await subscribeToPush(registration);
  if (!subscription) return false;

  try {
    await sendSubscriptionToServer(subscription);
    return true;
  } catch (err) {
    console.error('[Push] Failed to send subscription:', err);
    return false;
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
