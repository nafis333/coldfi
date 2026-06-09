const CHANNEL_NAME = 'coldfi_auth_sync';
type AuthEvent = { type: 'login'; userId: string } | { type: 'logout' };

let channel: BroadcastChannel | null = null;

export function initTabSync(onLogin: () => void, onLogout: () => void): () => void {
  if (!('BroadcastChannel' in window)) {
    console.warn('[TabSync] BroadcastChannel not supported');
    return () => {};
  }

  channel = new BroadcastChannel(CHANNEL_NAME);

  const handler = (event: MessageEvent<AuthEvent>) => {
    const { data } = event;
    if (data.type === 'login') {
      onLogin();
    } else if (data.type === 'logout') {
      onLogout();
    }
  };

  channel.addEventListener('message', handler);

  return () => {
    channel?.removeEventListener('message', handler);
    channel?.close();
    channel = null;
  };
}

export function broadcastLogin(userId: string): void {
  if (channel) {
    channel.postMessage({ type: 'login', userId } satisfies AuthEvent);
  }
}

export function broadcastLogout(): void {
  if (channel) {
    channel.postMessage({ type: 'logout' } satisfies AuthEvent);
  }
}
