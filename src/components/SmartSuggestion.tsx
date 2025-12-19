import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { PageContext } from '@/utils/pageDetection';

interface SmartSuggestionProps {
  pageContext: PageContext;
  currentMode: 'file' | 'text';
  onSwitchMode: () => void;
  onKeepMode: () => void;
  onDismiss: () => void;
}

export function SmartSuggestion({ 
  pageContext, 
  currentMode, 
  onSwitchMode, 
  onKeepMode,
  onDismiss 
}: SmartSuggestionProps) {
  // Only show if detected page doesn't match current mode
  if (pageContext.type === 'unknown' || pageContext.mode === currentMode) {
    return null;
  }

  const handleSwitch = () => {
    onSwitchMode();
    onDismiss();
  };

  const handleKeep = () => {
    onKeepMode();
    onDismiss();
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 rounded-lg p-3 mb-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          <p className="text-xs text-primary-foreground mb-2">
            <strong>{pageContext.label}</strong> detected. We recommend{' '}
            <strong>{pageContext.mode === 'text' ? 'Text Mode' : 'File Mode'}</strong>.
          </p>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSwitch}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground h-7 text-xs px-3"
            >
              Switch to {pageContext.mode === 'text' ? 'Text' : 'File'} Mode
            </Button>
            <Button
              onClick={handleKeep}
              size="sm"
              variant="outline"
              className="border-primary/30 text-primary h-7 text-xs px-3"
            >
              Keep {currentMode === 'text' ? 'Text' : 'File'} Mode
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

