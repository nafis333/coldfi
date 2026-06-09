import { useErrorStore } from '../stores/errorStore';
import type { ErrorEntry } from '../stores/errorStore';

export function setupErrorReporter(): void {
  if (typeof window === 'undefined') return;

  const originalOnerror = window.onerror;

  window.onerror = (
    message: string | Event,
    source?: string,
    lineno?: number,
    colno?: number,
    error?: Error
  ) => {
    const msg = typeof message === 'string' ? message : 'Script error';
    const detail = [
      `Source: ${source || 'unknown'}`,
      `Line: ${lineno || '?'}:${colno || '?'}`,
    ].join('\n');

    useErrorStore.getState().addError({
      type: error?.name || 'window.onerror',
      message: msg,
      stack: error?.stack || detail,
      timestamp: new Date().toISOString(),
    });

    if (typeof originalOnerror === 'function') {
      return originalOnerror(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

    useErrorStore.getState().addError({
      type: 'UnhandledRejection',
      message: error.message,
      stack: error.stack || '',
      timestamp: new Date().toISOString(),
    });
  });

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args
      .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');

    if (message.length > 0 && message.length < 2000) {
      useErrorStore.getState().addError({
        type: 'console.error',
        message: message.slice(0, 1000),
        stack: '',
        timestamp: new Date().toISOString(),
      });
    }

    originalConsoleError.call(console, ...args);
  };
}

export function getRecentErrors(limit = 50): ErrorEntry[] {
  return useErrorStore.getState().errors.slice(0, limit);
}
