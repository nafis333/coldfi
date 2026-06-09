import { Component, ErrorInfo, ReactNode } from 'react';
import { useErrorStore } from '../stores/errorStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

const GLOBAL_ERROR_EVENTS = ['error', 'unhandledrejection'] as const;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidMount() {
    for (const event of GLOBAL_ERROR_EVENTS) {
      window.addEventListener(event, this.handleGlobalError);
    }
  }

  componentWillUnmount() {
    for (const event of GLOBAL_ERROR_EVENTS) {
      window.removeEventListener(event, this.handleGlobalError);
    }
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
    } else if (event instanceof PromiseRejectionEvent) {
      useErrorStore.getState().addError({
        type: 'UnhandledRejection',
        message: event.reason?.message || 'Promise rejection',
        stack: event.reason?.stack || '',
        componentStack: '',
        timestamp: new Date().toISOString(),
      });
    }
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    useErrorStore.getState().addError({
      type: error.name || 'ReactError',
      message: error.message || 'Unknown error',
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
      timestamp: new Date().toISOString(),
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-8">
          <div className="max-w-md text-center">
            <div className="mb-4 text-5xl">⚠️</div>
            <h1 className="mb-2 text-2xl font-bold text-danger-600">
              Something went wrong
            </h1>
            <p className="mb-6 text-neutral-500">
              The application encountered an unexpected error.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 max-h-48 overflow-auto rounded-lg bg-neutral-100 p-4 text-left">
                <p className="mb-2 font-semibold text-danger-600">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                <pre className="whitespace-pre-wrap text-xs text-neutral-500">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

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
