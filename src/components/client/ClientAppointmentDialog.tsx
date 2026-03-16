import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, MapPin, Phone, User, Building2, Loader2, CalendarClock, FileText, MessageCircle, AlertTriangle, Bell, CreditCard, BanknoteIcon, Star } from 'lucide-react';
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
import { useProfile } from '@/hooks/useProfile';
import { useAppointmentRated } from '@/hooks/useRatings';
import { RatingDialog } from '@/components/ratings/RatingDialog';

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

interface PaymentData {
  id: string;
  amount_cents: number;
  payment_type: string;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  refunded_at: string | null;
}

const paymentStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  paid: 'Pago',
  rejected: 'Rejeitado',
  refunded: 'Reembolsado',
  cancelled: 'Cancelado',
  in_process: 'Em processamento',
};

const paymentTypeLabels: Record<string, string> = {
  deposit: 'Sinal',
  full: 'Pagamento integral',
};

export function ClientAppointmentDialog({ appointment, open, onOpenChange }: ClientAppointmentDialogProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState<AcceptedTermsData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const { toast } = useToast();
  const cancelMutation = useCancelClientAppointment();
  const { profile } = useProfile();
  
  // Check if this appointment has been rated
  const { data: isRated } = useAppointmentRated(appointment?.status === 'completed' ? appointment?.id : undefined);

  // Load accepted terms and payment data for this appointment
  useEffect(() => {
    if (!appointment || !open) {
      setAcceptedTerms(null);
      setPaymentData(null);
      return;
    }

    // Fetch terms
    (supabase as any)
      .from('appointment_accepted_terms')
      .select('terms_type, terms_text, terms_params, accepted_at')
      .eq('appointment_id', appointment.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setAcceptedTerms(data || null);
      });

    // Fetch payment data
    (supabase as any)
      .from('appointment_payments')
      .select('id, amount_cents, payment_type, status, payment_method, paid_at, refunded_at')
      .eq('appointment_id', appointment.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        setPaymentData(data || null);
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
      customerName: profile?.full_name ?? undefined,
      appointmentStatus: appointment.status,
    });
  }, [appointment, acceptedTerms, profile]);

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

  const reminderLabel = (() => {
    const hours = appointment.customer_reminder_hours;
    if (hours == null) return null;
    if (hours === 0) return 'Sem lembrete';
    if (hours === 1) return '1 hora antes';
    if (hours < 24) return `${hours} horas antes`;
    const days = Math.floor(hours / 24);
    return days === 1 ? '1 dia antes' : `${days} dias antes`;
  })();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

            {/* Reminder Info */}
            {reminderLabel && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bell className="h-3.5 w-3.5" />
                <span>Lembrete: {reminderLabel}</span>
              </div>
            )}

            {/* Payment Info */}
            {paymentData && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    Pagamento
                  </p>
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {paymentTypeLabels[paymentData.payment_type] || paymentData.payment_type}
                      </span>
                      <span className="font-semibold text-sm">
                        {formatPrice(paymentData.amount_cents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge
                        variant={
                          ['approved', 'paid'].includes(paymentData.status)
                            ? 'default'
                            : paymentData.status === 'refunded'
                            ? 'secondary'
                            : ['rejected', 'cancelled'].includes(paymentData.status)
                            ? 'destructive'
                            : 'outline'
                        }
                        className="text-[10px]"
                      >
                        {paymentStatusLabels[paymentData.status] || paymentData.status}
                      </Badge>
                    </div>
                    {paymentData.payment_method && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Método</span>
                        <span className="text-sm capitalize">{paymentData.payment_method.replace(/_/g, ' ')}</span>
                      </div>
                    )}
                    {paymentData.paid_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Pago em</span>
                        <span className="text-sm">
                          {format(new Date(paymentData.paid_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    {paymentData.refunded_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Reembolsado em</span>
                        <span className="text-sm">
                          {format(new Date(paymentData.refunded_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

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

                {cancellationDecision.canCancelDirectly && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setCancelDialogOpen(true)}
                  >
                    Cancelar Agendamento
                  </Button>
                )}

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

                {!cancellationDecision.canCancelDirectly && !cancellationDecision.showWhatsAppContact && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
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
