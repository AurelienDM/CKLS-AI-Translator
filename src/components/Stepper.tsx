import { Check, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openOptionsPage } from '@/utils/extensionHelpers';

interface StepperProps {
  currentStep: number;
  completedSteps: number[];
  onStepClick?: (step: number) => void;
}

const steps = [
  { id: 1, label: 'Source' },
  { id: 2, label: 'Rules' },
  { id: 3, label: 'Translate' },
];

export function Stepper({ currentStep, completedSteps, onStepClick }: StepperProps) {
  const canNavigateToStep = (stepId: number) => {
    if (completedSteps.includes(stepId)) return true;
    if (stepId === currentStep) return true;
    return false;
  };

  return (
    <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Tab-style stepper */}
        <div className="inline-flex h-11 items-center justify-center rounded-lg bg-muted p-1.5 text-muted-foreground">
          {steps.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const canClick = canNavigateToStep(step.id) && onStepClick;

            return (
              <button
                key={step.id}
                onClick={() => canClick && onStepClick(step.id)}
                disabled={!canClick}
                className={`
                  inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all
                  ${isCurrent 
                    ? 'bg-background text-foreground shadow-sm' 
                    : isCompleted
                      ? 'text-green-600 dark:text-green-400 hover:text-green-700'
                      : 'text-muted-foreground'
                  }
                  ${canClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}
                `}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-primary" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                )}
                {step.label}
              </button>
            );
          })}
        </div>

        {/* Settings button */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9"
          onClick={() => openOptionsPage()}
        >
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
