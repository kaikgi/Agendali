import { Star, MessageSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useEstablishmentReviews } from '@/hooks/useRatings';
import { cn } from '@/lib/utils';

interface EstablishmentReviewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  establishmentId: string | undefined;
  establishmentName: string;
}

function ReviewStars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-3.5 w-3.5',
            star <= count ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  );
}

export function EstablishmentReviewsDialog({
  open,
  onOpenChange,
  establishmentId,
  establishmentName,
}: EstablishmentReviewsDialogProps) {
  const { data: reviews, isLoading } = useEstablishmentReviews(establishmentId, open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            Avaliações de {establishmentName}
          </DialogTitle>
          <DialogDescription>
            O que os clientes estão dizendo
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
          ) : !reviews || reviews.length === 0 ? (
            <div className="py-10 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Ainda não há avaliações públicas.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="border rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{review.customer_first_name}</span>
                  <ReviewStars count={review.stars} />
                </div>
                {review.comment && (
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                )}
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground/80">
                  {review.service_name && <span>{review.service_name}</span>}
                  {review.professional_name && <span>com {review.professional_name}</span>}
                  <span>
                    {new Date(review.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
