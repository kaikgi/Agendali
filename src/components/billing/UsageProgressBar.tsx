import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface UsageProgressBarProps {
  current: number;
  max: number | null;
  label: string;
  icon?: React.ReactNode;
  showPercentage?: boolean;
  className?: string;
}

export function UsageProgressBar({
  current,
  max,
  label,
  icon,
  showPercentage = true,
  className,
}: UsageProgressBarProps) {
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-semibold',
              isAtLimit && 'text-destructive',
              isNearLimit && !isAtLimit && 'text-amber-600',
              !isNearLimit && 'text-foreground'
            )}
          >
            {isUnlimited ? `${current}` : `${current} / ${max}`}
          </span>
          {isUnlimited && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Ilimitado
            </span>
          )}
          {!isUnlimited && showPercentage && (
            <span className="text-xs text-muted-foreground">
              ({Math.round(percentage)}%)
            </span>
          )}
        </div>
      </div>

      {!isUnlimited && (
        <div className="relative">
          <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500 ease-out',
                isAtLimit && 'bg-destructive',
                isNearLimit && !isAtLimit && 'bg-amber-500',
                !isNearLimit && 'bg-primary'
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
          {/* Marker lines at 50% and 80% */}
          <div className="absolute top-0 left-1/2 h-2.5 w-px bg-background/50" />
          <div className="absolute top-0 left-[80%] h-2.5 w-px bg-background/50" />
        </div>
      )}

      {isUnlimited && (
        <div className="h-2.5 w-full bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 rounded-full animate-pulse" />
      )}

      {!isUnlimited && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>{Math.round(max / 2)}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}
