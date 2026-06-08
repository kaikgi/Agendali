import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

export function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-8 overflow-x-auto px-1">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        
        return (
          <div key={step} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  isCompleted && 'bg-foreground text-background',
                  isCurrent && 'bg-foreground text-background',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className={cn(
                'text-[10px] sm:text-xs font-medium leading-none',
                isCurrent ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {step}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'w-4 sm:w-8 h-0.5 mx-0.5 sm:mx-1 mt-[-14px]',
                  index < currentStep ? 'bg-foreground' : 'bg-muted'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
