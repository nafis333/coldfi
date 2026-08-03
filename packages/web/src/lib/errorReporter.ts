import { useErrorStore } from '../stores/errorStore';
import { categorizeError } from './errorHandler';

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
    event.preventDefault();
    const err = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    const critical = categorizeError(err, 'Unhandled Promise Rejection');
    useErrorStore.getState().addError({
      type: critical.type,
      message: critical.message,
      stack: critical.stack,
      timestamp: critical.timestamp,
    });
    useErrorStore.getState().setCriticalError(critical);
  });

  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const message = args.map((a) => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch { return String(a); }
      }
      return String(a);
    }).join(' ');

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
