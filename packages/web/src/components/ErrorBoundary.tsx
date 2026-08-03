import { Component, ErrorInfo, ReactNode } from 'react';
import { useErrorStore } from '../stores/errorStore';
import { categorizeError } from '../lib/errorHandler';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  handleGlobalError = (event: Event) => {
    if (event instanceof ErrorEvent) {
      useErrorStore.getState().addError({
        type: event.error?.name || 'UncaughtError',
        message: event.message || 'Unknown error',
        stack: event.error?.stack || '',
        componentStack: '',
        timestamp: new Date().toISOString(),
      });
    }
  };

  componentDidMount() {
    window.addEventListener('error', this.handleGlobalError);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.handleGlobalError);
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const critical = categorizeError(error);
    critical.componentStack = errorInfo.componentStack || '';
    useErrorStore.getState().setCriticalError(critical);

    this.redirectTimer = setTimeout(() => {
      if (window.location.pathname !== '/error') {
        window.location.href = '/error';
      }
    }, 100);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    useErrorStore.getState().clearCriticalError();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900 p-8">
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-900/20">
              <svg className="h-8 w-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-white">
              Something went wrong
            </h1>
            <p className="mb-6 text-neutral-500 dark:text-neutral-400">
              Redirecting to error details...
            </p>
            <button
              onClick={this.handleReset}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
