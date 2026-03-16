import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { useToast } from '@/hooks/use-toast';
import {
  usePendingCompletionAppointments,
  useMarkPrompted,
  useCompleteAppointment,
  useHasBeenPrompted,
} from '@/hooks/useCompletionPrompt';
import { RatingDialog } from '@/components/ratings/RatingDialog';
import { useAuth } from '@/hooks/useAuth';

interface CompletionPromptDialogProps {
  establishmentId?: string;
  userType: 'customer' | 'establishment' | 'professional';
  professionalToken?: string; // For professional portal
}

export function CompletionPromptDialog({
  establishmentId,
  userType,
}: CompletionPromptDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [open, setOpen] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [currentAppointment, setCurrentAppointment] = useState<{
    id: string;
    service_name: string;
    professional_id: string;
    professional_name: string;
    customer_name: string;
    customer_id: string;
    establishment_id: string;
    establishment_name: string;
    end_at: string;
  } | null>(null);

  const { data: pendingAppointments } = usePendingCompletionAppointments(
    establishmentId,
    user?.id,
    userType
  );

  const { data: hasBeenPrompted, isLoading: checkingPrompted } = useHasBeenPrompted(
    pendingAppointments?.[0]?.id,
    user?.id
  );

  const markPrompted = useMarkPrompted();
  const completeAppointment = useCompleteAppointment();

  // Check for pending appointments that need prompting
  useEffect(() => {
    if (
      !checkingPrompted &&
      pendingAppointments &&
      pendingAppointments.length > 0 &&
      !hasBeenPrompted &&
      user?.id
    ) {
      const apt = pendingAppointments[0];
      setCurrentAppointment({
        id: apt.id,
        service_name: apt.service?.name || 'Serviço',
        professional_id: apt.professional?.id || '',
        professional_name: apt.professional?.name || 'Profissional',
        customer_name: apt.customer?.name || 'Cliente',
        customer_id: apt.customer?.id || '',
        establishment_id: apt.establishment?.id || '',
        establishment_name: apt.establishment?.name || '',
        end_at: apt.end_at,
      });
      setOpen(true);
    }
  }, [pendingAppointments, hasBeenPrompted, checkingPrompted, user?.id]);

  const handleNotYet = async () => {
    if (!currentAppointment || !user?.id) return;

    try {
      await markPrompted.mutateAsync({
        appointmentId: currentAppointment.id,
        userId: user.id,
        userType,
        actionTaken: 'not_yet',
      });
      setOpen(false);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível registrar sua resposta.',
      });
    }
  };

  const handleCompleted = async () => {
    if (!currentAppointment || !user?.id) return;

    try {
      // Mark as completed
      await completeAppointment.mutateAsync({
        appointmentId: currentAppointment.id,
        completedBy: userType,
      });

      // Mark as prompted
      await markPrompted.mutateAsync({
        appointmentId: currentAppointment.id,
        userId: user.id,
        userType,
        actionTaken: 'completed',
      });

      toast({
        title: 'Atendimento finalizado!',
        description: 'O agendamento foi marcado como concluído.',
      });

      setOpen(false);

      // Open rating dialog for customers
      if (userType === 'customer') {
        setRatingOpen(true);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível finalizar o atendimento.',
      });
    }
  };

  const handleDismiss = async () => {
    if (!currentAppointment || !user?.id) return;

    try {
      await markPrompted.mutateAsync({
        appointmentId: currentAppointment.id,
        userId: user.id,
        userType,
        actionTaken: 'dismissed',
      });
      setOpen(false);
    } catch {
      // Silently fail for dismiss
      setOpen(false);
    }
  };

  const isPending = markPrompted.isPending || completeAppointment.isPending;

  if (!currentAppointment) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDismiss()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Atendimento Finalizado?
            </DialogTitle>
            <DialogDescription>
              Este atendimento deveria ter terminado. O procedimento foi finalizado?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Horário previsto:</span>
                <span className="font-medium">
                  {format(parseISO(currentAppointment.end_at), "HH:mm", {
                    locale: ptBR,
                  })}
                </span>
              </div>
              <p className="font-medium">{currentAppointment.service_name}</p>
              {userType === 'customer' ? (
                <p className="text-sm text-muted-foreground">
                  com {currentAppointment.professional_name}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Cliente: {currentAppointment.customer_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleNotYet}
              disabled={isPending}
            >
              Ainda não
            </Button>
            <ActionButton
              className="flex-1"
              onClick={handleCompleted}
              loadingLabel="Finalizando..."
              successLabel="Finalizado!"
            >
              Sim, finalizado
            </ActionButton>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rating dialog for customers */}
      {userType === 'customer' && currentAppointment && (
        <RatingDialog
          open={ratingOpen}
          onOpenChange={setRatingOpen}
          appointmentId={currentAppointment.id}
          establishmentId={currentAppointment.establishment_id}
          customerId={currentAppointment.customer_id}
          establishmentName={currentAppointment.establishment_name}
          professionalId={currentAppointment.professional_id}
          professionalName={currentAppointment.professional_name}
        />
      )}
    </>
  );
}
