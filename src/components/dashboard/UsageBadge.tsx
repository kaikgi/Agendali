import { cn } from '@/lib/utils';

interface UsageBadgeProps {
  current: number;
  max: number | null;
  label: string;
  className?: string;
}

export function UsageBadge({ current, max, label, className }: UsageBadgeProps) {
  // If max is null, it means unlimited
  const isUnlimited = max === null;
  const percentage = isUnlimited ? 0 : (current / max) * 100;
  const isNearLimit = !isUnlimited && percentage >= 80;
  const isAtLimit = !isUnlimited && percentage >= 100;

  return (
    <div className={cn('text-xs', className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            'font-medium',
            isAtLimit && 'text-destructive',
            isNearLimit && !isAtLimit && 'text-amber-600'
          )}
        >
          {isUnlimited ? `${current} (ilimitado)` : `${current}/${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isAtLimit && 'bg-destructive',
              isNearLimit && !isAtLimit && 'bg-amber-500',
              !isNearLimit && 'bg-primary'
            )}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
