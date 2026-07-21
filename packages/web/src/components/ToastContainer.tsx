import { useToastStore, type ToastType } from '../stores/toastStore';

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

const STYLES: Record<ToastType, string> = {
  success: 'bg-success-600 text-white',
  error: 'bg-danger-600 text-white',
  info: 'bg-primary-600 text-white',
  warning: 'bg-warning-600 text-white',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg animate-slide-up ${STYLES[toast.type]}`}
          role="alert"
        >
          <span className="text-lg leading-none shrink-0">{ICONS[toast.type]}</span>
          <p className="text-sm flex-1">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white shrink-0 leading-none"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
