import { useToastStore, type ToastSeverity } from "../stores/toast-store";

/** Color classes by toast severity. */
const SEVERITY_STYLES: Record<
  ToastSeverity,
  { border: string; bg: string; titleColor: string; messageColor: string; dismissColor: string }
> = {
  error: {
    border: "border-red-200 dark:border-red-800",
    bg: "bg-red-50 dark:bg-red-900/90",
    titleColor: "text-red-800 dark:text-red-200",
    messageColor: "text-red-600 dark:text-red-400",
    dismissColor: "text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300",
  },
  warning: {
    border: "border-yellow-200 dark:border-yellow-800",
    bg: "bg-yellow-50 dark:bg-yellow-900/90",
    titleColor: "text-yellow-800 dark:text-yellow-200",
    messageColor: "text-yellow-600 dark:text-yellow-400",
    dismissColor: "text-yellow-400 hover:text-yellow-600 dark:text-yellow-500 dark:hover:text-yellow-300",
  },
  info: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-900/90",
    titleColor: "text-blue-800 dark:text-blue-200",
    messageColor: "text-blue-600 dark:text-blue-400",
    dismissColor: "text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300",
  },
};

/**
 * Global toast notification container. Renders all active toasts from the toast store.
 * Position: fixed bottom-right, stacking upward.
 */
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      data-testid="toast-container"
    >
      {toasts.map((toast) => {
        const style = SEVERITY_STYLES[toast.severity];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-lg border ${style.border} ${style.bg} p-3 shadow-lg max-w-sm`}
            data-testid={`toast-${toast.id}`}
            role="alert"
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${style.titleColor}`}>
                {toast.title}
              </p>
              <p className={`mt-0.5 text-xs ${style.messageColor} break-words`}>
                {toast.message}
              </p>
            </div>
            <button
              className={`shrink-0 ${style.dismissColor}`}
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              data-testid={`dismiss-toast-${toast.id}`}
            >
              x
            </button>
          </div>
        );
      })}
    </div>
  );
}
