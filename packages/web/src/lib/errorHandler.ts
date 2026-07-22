import { useErrorStore, CriticalError, ErrorCategory } from '../stores/errorStore';

export function categorizeError(error: unknown, context?: string): CriticalError {
  const err = error instanceof Error ? error : new Error(String(error));
  const ts = new Date().toISOString();
  const base = { id: crypto.randomUUID(), timestamp: ts, stack: err.stack || '', componentStack: '' };

  const msg = err.message || String(error);

  if (msg === 'Failed to fetch' || msg === 'NetworkError' || msg === 'Network request failed' || msg.includes('net::ERR') || msg.includes('NetworkError') || msg.includes('network')) {
    return {
      ...base,
      type: 'NetworkError',
      category: 'NetworkError',
      message: msg,
      title: 'Connection Failed',
      detail: context
        ? `Could not reach ${context}.`
        : 'The application cannot connect to the server. This may be due to a network issue, the server being down, or a DNS misconfiguration.',
      action: 'Check your internet connection and try again. If the problem persists, the server may be down.',
      retryable: true,
    };
  }

  if (msg.includes('CSP') || msg.includes('Content Security Policy') || msg.includes('violates') || msg.includes('Refused to connect')) {
    return {
      ...base,
      type: 'CSPError',
      category: 'CSPError',
      message: msg,
      title: 'Content Security Policy Violation',
      detail: 'A browser security policy blocked the request. This is usually a configuration issue on the server side.',
      action: 'The website owner needs to update the Content Security Policy. Try using a different browser in the meantime.',
      retryable: false,
    };
  }

  if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('unauthorized') || msg.includes('token') || msg.includes('Token') || msg.includes('expired') || msg.includes('session')) {
    return {
      ...base,
      type: 'AuthError',
      category: 'AuthError',
      message: msg,
      title: 'Authentication Error',
      detail: 'Your session may have expired or you are not authorized to perform this action.',
      action: 'Please log in again and retry.',
      retryable: true,
    };
  }

  if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('forbidden')) {
    return {
      ...base,
      type: 'AuthError',
      category: 'AuthError',
      message: msg,
      title: 'Access Denied',
      detail: 'You do not have permission to access this resource.',
      action: 'Contact your administrator if you believe this is a mistake.',
      retryable: false,
    };
  }

  if (msg.includes('500') || msg.includes('Internal Server Error') || msg.includes('internal server error')) {
    return {
      ...base,
      type: 'ServerError',
      category: 'ServerError',
      message: msg,
      title: 'Server Error',
      detail: 'The server encountered an internal error and could not complete your request.',
      action: 'Please try again later. If the problem persists, contact support.',
      retryable: true,
    };
  }

  if (msg.includes('404') || msg.includes('Not Found')) {
    return {
      ...base,
      type: 'ServerError',
      category: 'ServerError',
      message: msg,
      title: 'Not Found',
      detail: 'The requested resource could not be found on the server.',
      action: 'Check the URL and try again.',
      retryable: false,
    };
  }

  if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit')) {
    return {
      ...base,
      type: 'ServerError',
      category: 'ServerError',
      message: msg,
      title: 'Rate Limit Exceeded',
      detail: 'You have made too many requests in a short period.',
      action: 'Wait a moment and try again.',
      retryable: true,
    };
  }

  return {
    ...base,
    type: err.name || 'UnknownError',
    category: 'UnknownError',
    message: msg,
    title: 'Unexpected Error',
    detail: context || msg,
    action: 'Try again. If the problem persists, report this issue.',
    retryable: true,
  };
}

export function triggerCriticalError(error: unknown, context?: string): void {
  const critical = categorizeError(error, context);
  useErrorStore.getState().setCriticalError(critical);
  try {
    sessionStorage.setItem('coldfi:criticalError', JSON.stringify(critical));
  } catch {}
  window.location.href = '/error';
}

export function silentCatch(context: string, error?: unknown): void {
  const err = error instanceof Error ? error : new Error(String(error || 'Unknown error'));
  useErrorStore.getState().addError({
    type: `SilentCatch:${context}`,
    message: err.message,
    stack: err.stack || '',
    timestamp: new Date().toISOString(),
  });
}
