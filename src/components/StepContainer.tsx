import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface StepContainerProps {
  children: ReactNode;
  step: number;
  onNext?: () => void;
  onBack?: () => void;
  canGoNext?: boolean;
  canGoBack?: boolean;
  nextLabel?: string;
  backLabel?: string;
}

export function StepContainer({
  children,
  step,
  onNext,
  onBack,
  canGoNext = true,
  canGoBack = true,
  nextLabel = 'Next',
  backLabel = 'Back',
}: StepContainerProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {children}
      </div>
      
      {/* Navigation Footer - Sticky */}
      <div className="sticky bottom-0 bg-background border-t px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={onBack}
              disabled={!canGoBack}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {backLabel}
            </Button>
          ) : (
            <div />
          )}
          
          {step < 3 && (
            <Button
              variant="outline"
              onClick={onNext}
              disabled={!canGoNext}
              className="flex items-center gap-2 ml-auto"
            >
              {nextLabel}
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {/* Settings menu removed - now in extension options page */}
        </div>
      </div>
    </div>
  );
}

