import { X, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HelpfulHintProps {
  onDismiss?: () => void;
}

export function HelpfulHint({ onDismiss }: HelpfulHintProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['hideHelpfulHint'], (result: { hideHelpfulHint?: boolean }) => {
        if (result.hideHelpfulHint) {
          setVisible(false);
        }
      });
    }
  }, []);

  const handleDismiss = () => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ hideHelpfulHint: true }).catch(() => {});
    }
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 mb-3 text-xs rounded-lg border bg-muted/50">
      <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <p className="text-muted-foreground">
        <span className="font-medium text-foreground">File Mode</span> for CKLS files · <span className="font-medium text-foreground">Text Mode</span> for emails/HTML
      </p>
      <button
        onClick={handleDismiss}
        className="ml-auto p-0.5 rounded hover:bg-muted transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
