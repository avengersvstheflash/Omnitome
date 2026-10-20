import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, ToastMessage, ToastType } from '../../store/useToastStore';

const ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const BORDER_STYLES: Record<ToastType, string> = {
  success: 'border-ok/40 text-ok',
  error: 'border-err/40 text-err',
  warning: 'border-warn/40 text-warn',
  info: 'border-brand/40 text-brand',
};

export const ToastRegion: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <aside
      aria-label="Notifications"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toastItem: ToastMessage) => {
        const IconComponent = ICONS[toastItem.type] || Info;
        const colorClasses = BORDER_STYLES[toastItem.type] || BORDER_STYLES.info;

        return (
          <div
            key={toastItem.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-surface/95 backdrop-blur-md border shadow-lg shadow-black/10 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
          >
            <div className={`mt-0.5 shrink-0 ${colorClasses}`}>
              <IconComponent className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              {toastItem.title && (
                <div className="text-ui font-semibold text-ink text-sm leading-tight mb-0.5">
                  {toastItem.title}
                </div>
              )}
              <div className="text-ui-sm text-ink-muted leading-relaxed break-words">
                {toastItem.message}
              </div>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toastItem.id)}
              className="shrink-0 p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-subtle transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </aside>
  );
};
