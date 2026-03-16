import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Phone, User, Building2, Loader2, CalendarClock, FileText, MessageCircle, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useCancelClientAppointment, type ClientAppointment } from '@/hooks/useClientAppointments';
import { ClientRescheduleDialog } from './ClientRescheduleDialog';
import { supabase } from '@/integrations/supabase/client';
import { evaluateCancellation, type CancellationScenario } from '@/lib/cancellationRules';

interface ClientAppointmentDialogProps {
  appointment: ClientAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { statusLabels, statusVariants } from '@/lib/appointmentStatus';

interface AcceptedTermsData {
  terms_type: string;
  terms_text: string;
  terms_params: Record<string, any>;
  accepted_at: string;
}

export function ClientAppointmentDialog({ appointment, open, onOpenChange }: ClientAppointmentDialogProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<AcceptedTermsData | null>(null);
  const { toast } = useToast();
  const cancelMutation = useCancelClientAppointment();

  // Load accepted terms for this appointment
  useEffect(() => {
    if (!appointment || !open) {
      setAcceptedTerms(null);
      return;
    }
    (supabase as any)
      .from('appointment_accepted_terms')
      .select('terms_type, terms_text, terms_params, accepted_at')
      .eq('appointment_id', appointment.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setAcceptedTerms(data || null);
      });
  }, [appointment?.id, open]);

  // Evaluate cancellation rules based on accepted terms
  const cancellationDecision = useMemo(() => {
    if (!appointment) return null;
    return evaluateCancellation({
      termsType: (acceptedTerms?.terms_type as CancellationScenario) ?? null,
      termsParams: acceptedTerms?.terms_params ?? null,
      appointmentStartAt: appointment.start_at,
      establishmentPhone: appointment.establishment.phone,
      establishmentName: appointment.establishment.name,
      serviceName: appointment.service.name,
      professionalName: appointment.professional.name,
      appointmentStatus: appointment.status,
    });
  }, [appointment, acceptedTerms]);

  if (!appointment) return null;

  const actionableStatuses = ['booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation'];
  const canAct = actionableStatuses.includes(appointment.status);
  const isPast = new Date(appointment.start_at) < new Date();

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(appointment.id);
      toast({ title: 'Agendamento cancelado com sucesso' });
      setCancelDialogOpen(false);
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar',
        description: error instanceof Error ? error.message : 'Não foi possível cancelar o agendamento',
      });
    }
  };

  const formatPrice = (cents: number | null) => {
    if (cents === null) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  const showActions = canAct && !isPast;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Detalhes do Agendamento
              <Badge variant={statusVariants[appointment.status]}>
                {statusLabels[appointment.status]}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Establishment */}
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                {appointment.establishment.logo_url && (
                  <AvatarImage 
                    src={appointment.establishment.logo_url} 
                    alt={appointment.establishment.name} 
                  />
                )}
                <AvatarFallback>
                  <Building2 className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium">{appointment.establishment.name}</h3>
                {appointment.establishment.address && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {appointment.establishment.address}
                    {appointment.establishment.city && `, ${appointment.establishment.city}`}
                  </p>
                )}
                {appointment.establishment.phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {appointment.establishment.phone}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Service & Professional */}
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Serviço</p>
                <p className="font-medium">{appointment.service.name}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {appointment.service.duration_minutes} minutos
                  {appointment.service.price_cents && (
                    <span>• {formatPrice(appointment.service.price_cents)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  {appointment.professional.photo_url && (
                    <AvatarImage 
                      src={appointment.professional.photo_url} 
                      alt={appointment.professional.name} 
                    />
                  )}
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">Profissional</p>
                  <p className="font-medium">{appointment.professional.name}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Date & Time */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {format(new Date(appointment.start_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(appointment.start_at), 'HH:mm')} - {format(new Date(appointment.end_at), 'HH:mm')}
                </p>
              </div>
            </div>

            {/* Notes */}
            {appointment.customer_notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Observações</p>
                <p className="text-sm bg-muted/50 p-2 rounded">{appointment.customer_notes}</p>
              </div>
            )}

            {/* Accepted Terms */}
            {acceptedTerms && (
              <Collapsible open={termsOpen} onOpenChange={setTermsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">
                      Termos aceitos em {format(new Date(acceptedTerms.accepted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ScrollArea className="max-h-48 mt-2">
                    <div className="text-xs whitespace-pre-wrap bg-muted/50 p-3 rounded text-muted-foreground leading-relaxed">
                      {acceptedTerms.terms_text}
                    </div>
                  </ScrollArea>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Actions */}
            {showActions && cancellationDecision && (
              <div className="space-y-2 pt-2">
                {/* Reschedule button - always show if allowed */}
                {cancellationDecision.canReschedule && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setRescheduleDialogOpen(true)}
                  >
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Reagendar
                  </Button>
                )}

                {/* Cancel button - direct cancel */}
                {cancellationDecision.canCancelDirectly && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancelar Agendamento
                  </Button>
                )}

                {/* WhatsApp contact - for paid or out-of-deadline */}
                {cancellationDecision.showWhatsAppContact && cancellationDecision.whatsAppUrl && (
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    asChild
                  >
                    <a
                      href={cancellationDecision.whatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Falar com o estabelecimento via WhatsApp
                    </a>
                  </Button>
                )}

                {/* Out-of-deadline warning without WhatsApp */}
                {!cancellationDecision.canCancelDirectly && !cancellationDecision.showWhatsAppContact && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p>
                      O prazo para cancelamento direto expirou. 
                      Entre em contato com o estabelecimento para solicitar o cancelamento.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <ClientRescheduleDialog
        appointment={appointment}
        open={rescheduleDialogOpen}
        onOpenChange={setRescheduleDialogOpen}
        onSuccess={() => onOpenChange(false)}
      />

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{cancellationDecision?.cancelTitle ?? 'Cancelar Agendamento'}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancellationDecision?.cancelDescription ?? 'Tem certeza que deseja cancelar este agendamento?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Voltar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Cancelamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
