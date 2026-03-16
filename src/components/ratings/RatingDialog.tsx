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
import { Separator } from '@/components/ui/separator';
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
  professionalId?: string;
  professionalName?: string;
  onSuccess?: () => void;
}

function StarRow({
  label,
  value,
  hovered,
  onSelect,
  onHover,
  onLeave,
}: {
  label: string;
  value: number;
  hovered: number;
  onSelect: (v: number) => void;
  onHover: (v: number) => void;
  onLeave: () => void;
}) {
  const display = hovered || value;
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-center">{label}</p>
      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onSelect(v)}
            onMouseEnter={() => onHover(v)}
            onMouseLeave={onLeave}
            className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            <Star
              className={cn(
                'h-8 w-8 transition-colors',
                v <= display
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/30'
              )}
            />
          </button>
        ))}
      </div>
      <div className="text-center text-xs text-muted-foreground h-4">
        {display === 0 && 'Toque nas estrelas'}
        {display === 1 && 'Muito ruim'}
        {display === 2 && 'Ruim'}
        {display === 3 && 'Regular'}
        {display === 4 && 'Bom'}
        {display === 5 && 'Excelente'}
      </div>
    </div>
  );
}

export function RatingDialog({
  open,
  onOpenChange,
  appointmentId,
  establishmentId,
  customerId,
  establishmentName,
  professionalId,
  professionalName,
  onSuccess,
}: RatingDialogProps) {
  const [establishmentStars, setEstablishmentStars] = useState(0);
  const [hoveredEstablishment, setHoveredEstablishment] = useState(0);
  const [professionalStars, setProfessionalStars] = useState(0);
  const [hoveredProfessional, setHoveredProfessional] = useState(0);
  const [comment, setComment] = useState('');
  const { toast } = useToast();
  const submitRating = useSubmitRating();

  const hasProfessional = !!professionalId && !!professionalName;

  const handleSubmit = async () => {
    if (establishmentStars === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma avaliação',
        description: 'Avalie o estabelecimento com 1 a 5 estrelas.',
      });
      throw new Error('validation');
    }

    if (hasProfessional && professionalStars === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma avaliação',
        description: 'Avalie o profissional com 1 a 5 estrelas.',
      });
      throw new Error('validation');
    }

    try {
      console.log('[rating-submit] Submitting rating:', {
        appointmentId,
        establishmentId,
        customerId,
        establishmentStars,
        professionalId,
        professionalStars: hasProfessional ? professionalStars : undefined,
      });

      await submitRating.mutateAsync({
        appointmentId,
        establishmentId,
        customerId,
        stars: establishmentStars,
        comment: comment.trim() || undefined,
        professionalId: hasProfessional ? professionalId : undefined,
        professionalStars: hasProfessional ? professionalStars : undefined,
      });

      toast({
        title: 'Avaliação enviada!',
        description: 'Obrigado pelo seu feedback.',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      if (error instanceof Error && error.message === 'validation') throw error;
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar avaliação',
        description: error instanceof Error ? error.message : 'Tente novamente.',
      });
      throw error;
    }
  };

  const handleClose = () => {
    setEstablishmentStars(0);
    setHoveredEstablishment(0);
    setProfessionalStars(0);
    setHoveredProfessional(0);
    setComment('');
    onOpenChange(false);
  };

  const canSubmit = establishmentStars > 0 && (!hasProfessional || professionalStars > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avalie seu atendimento</DialogTitle>
          <DialogDescription>
            Como foi sua experiência em {establishmentName}?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Establishment rating */}
          <StarRow
            label={hasProfessional ? `Estabelecimento — ${establishmentName}` : establishmentName}
            value={establishmentStars}
            hovered={hoveredEstablishment}
            onSelect={setEstablishmentStars}
            onHover={setHoveredEstablishment}
            onLeave={() => setHoveredEstablishment(0)}
          />

          {/* Professional rating */}
          {hasProfessional && (
            <>
              <Separator />
              <StarRow
                label={`Profissional — ${professionalName}`}
                value={professionalStars}
                hovered={hoveredProfessional}
                onSelect={setProfessionalStars}
                onHover={setHoveredProfessional}
                onLeave={() => setHoveredProfessional(0)}
              />
            </>
          )}

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
            disabled={!canSubmit}
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
