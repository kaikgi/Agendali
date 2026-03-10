import { useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSubmitRating } from '@/hooks/useRatings';
import { cn } from '@/lib/utils';

interface RatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  establishmentId: string;
  customerId: string;
  establishmentName: string;
  onSuccess?: () => void;
}

export function RatingDialog({
  open,
  onOpenChange,
  appointmentId,
  establishmentId,
  customerId,
  establishmentName,
  onSuccess,
}: RatingDialogProps) {
  const [stars, setStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [comment, setComment] = useState('');
  const { toast } = useToast();
  const submitRating = useSubmitRating();

  const handleSubmit = async () => {
    if (stars === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma avaliação',
        description: 'Por favor, escolha de 1 a 5 estrelas.',
      });
      throw new Error('validation');
    }

    try {
      await submitRating.mutateAsync({
        appointmentId,
        establishmentId,
        customerId,
        stars,
        comment: comment.trim() || undefined,
      });

      toast({
        title: 'Avaliação enviada!',
        description: 'Obrigado pelo seu feedback.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar avaliação',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
    }
  };

  const handleClose = () => {
    setStars(0);
    setHoveredStars(0);
    setComment('');
    onOpenChange(false);
  };

  const displayStars = hoveredStars || stars;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avalie seu atendimento</DialogTitle>
          <DialogDescription>
            Como foi sua experiência em {establishmentName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star rating */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStars(value)}
                onMouseEnter={() => setHoveredStars(value)}
                onMouseLeave={() => setHoveredStars(0)}
                className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
              >
                <Star
                  className={cn(
                    'h-10 w-10 transition-colors',
                    value <= displayStars
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  )}
                />
              </button>
            ))}
          </div>

          {/* Star label */}
          <div className="text-center text-sm text-muted-foreground">
            {displayStars === 0 && 'Toque nas estrelas para avaliar'}
            {displayStars === 1 && 'Muito ruim'}
            {displayStars === 2 && 'Ruim'}
            {displayStars === 3 && 'Regular'}
            {displayStars === 4 && 'Bom'}
            {displayStars === 5 && 'Excelente'}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label htmlFor="comment">Comentário (opcional)</Label>
            <Textarea
              id="comment"
              placeholder="Conte como foi sua experiência..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              className="min-h-[100px] resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleClose}>
            Pular
          </Button>
          <ActionButton
            className="flex-1"
            onClick={handleSubmit}
            disabled={stars === 0}
            loadingLabel="Enviando..."
            successLabel="Enviado!"
          >
            Enviar Avaliação
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
