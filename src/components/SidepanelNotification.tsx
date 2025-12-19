import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidepanelNotificationProps {
  visible: boolean;
  type: 'success' | 'info' | 'error';
  icon: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

export function SidepanelNotification({
  visible,
  type,
  icon,
  title,
  message,
  onAction,
  onDismiss
}: SidepanelNotificationProps) {
  if (!visible) return null;

  const bgColor = {
    success: 'bg-gradient-to-r from-success/10 to-success/5',
    info: 'bg-gradient-to-r from-info/10 to-info/5',
    error: 'bg-gradient-to-r from-destructive/10 to-destructive/5'
  }[type];

  const borderColor = {
    success: 'border-success/30',
    info: 'border-info/30',
    error: 'border-destructive/30'
  }[type];

  return (
    <div className="px-4 py-2 animate-in slide-in-from-top duration-300">
      <div className={`relative overflow-hidden rounded-lg border ${borderColor} ${bgColor} shadow-sm`}>
        <div className="flex items-center gap-3 p-3">
          {/* Icon and content as clickable area */}
          <button 
            onClick={onAction}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left"
            disabled={!onAction}
          >
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {title}
              </p>
              {message && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {message}
                </p>
              )}
            </div>
          </button>

          {/* Close button only */}
          <Button
            onClick={onDismiss}
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

