import { Star } from 'lucide-react';
import { useEstablishmentRating } from '@/hooks/useRatings';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EstablishmentRatingDisplayProps {
  establishmentId: string | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function EstablishmentRatingDisplay({
  establishmentId,
  className,
  size = 'md',
}: EstablishmentRatingDisplayProps) {
  const { data: rating, isLoading } = useEstablishmentRating(establishmentId);

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (!rating || rating.rating_count === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        Ainda sem avaliações
      </p>
    );
  }

  const starSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }[size];

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }[size];

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating.rating_avg);
    const hasHalfStar = rating.rating_avg - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className={cn(starSize, 'fill-yellow-400 text-yellow-400')}
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        // Render a half-filled star using clipPath
        stars.push(
          <div key={i} className="relative">
            <Star className={cn(starSize, 'text-muted-foreground')} />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <Star
                className={cn(starSize, 'fill-yellow-400 text-yellow-400')}
              />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star key={i} className={cn(starSize, 'text-muted-foreground')} />
        );
      }
    }
    return stars;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-0.5">{renderStars()}</div>
      <span className={cn(textSize, 'font-medium')}>{rating.rating_avg}</span>
      <span className={cn(textSize, 'text-muted-foreground')}>
        ({rating.rating_count} {rating.rating_count === 1 ? 'avaliação' : 'avaliações'})
      </span>
    </div>
  );
}
