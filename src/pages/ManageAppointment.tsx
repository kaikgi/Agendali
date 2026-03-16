import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, addMinutes, isBefore, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, Scissors, MapPin, Phone, AlertTriangle, CheckCircle, XCircle, ArrowLeft, Star, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { getStatusLabel, getStatusVariant } from '@/lib/appointmentStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { evaluateCancellation, type CancellationScenario } from '@/lib/cancellationRules';
import { useToast } from '@/hooks/use-toast';
import { useAppointmentByToken, useCancelAppointment, useRescheduleAppointment } from '@/hooks/useAppointmentByToken';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { sendRatingNotificationEmail } from '@/lib/emailNotifications';

function TokenRatingForm({ appointmentId, token, establishmentName }: { appointmentId: string; token: string; establishmentName: string }) {
  const [stars, setStars] = useState(0);
  const [hoveredStars, setHoveredStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  // Check if already rated
  const { data: alreadyRated, isLoading: checkingRated } = useQuery({
    queryKey: ['rating-check-token', appointmentId],
    queryFn: async () => {
      const { data } = await supabase
        .from('ratings')
        .select('id, stars, comment')
        .eq('appointment_id', appointmentId)
        .maybeSingle();
      return data;
    },
  });

  if (checkingRated) return null;

  if (alreadyRated || submitted) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((v) => (
              <Star
                key={v}
                className={cn(
                  'h-6 w-6',
                  v <= (alreadyRated?.stars || stars)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                )}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-foreground">Obrigado pela sua avaliação!</p>
          {(alreadyRated?.comment || comment) && (
            <p className="text-sm text-muted-foreground italic">"{alreadyRated?.comment || comment}"</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const displayStars = hoveredStars || stars;

  const handleSubmit = async () => {
    if (stars === 0) {
      toast({ variant: 'destructive', title: 'Selecione uma nota', description: 'Escolha de 1 a 5 estrelas.' });
      throw new Error('validation');
    }

    const { data, error } = await (supabase.rpc as any)('public_submit_rating_by_token', {
      p_token: token,
      p_appointment_id: appointmentId,
      p_stars: stars,
      p_comment: comment.trim() || null,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
      throw error;
    }

    const result = data as { success: boolean; error?: string; rating_id?: string };
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Erro', description: result.error || 'Erro ao enviar avaliação' });
      throw new Error(result.error);
    }

    // Send notification to establishment (fire and forget)
    if (result.rating_id) {
      sendRatingNotificationEmail(result.rating_id).catch(console.warn);
    }

    toast({ title: 'Avaliação enviada!', description: 'Obrigado pelo seu feedback.' });
    setSubmitted(true);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
          Avalie seu atendimento
        </CardTitle>
        <CardDescription>
          Como foi sua experiência em {establishmentName}?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stars */}
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
                  'h-9 w-9 transition-colors',
                  value <= displayStars
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground/30'
                )}
              />
            </button>
          ))}
        </div>
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
          <Label htmlFor="rating-comment">Comentário (opcional)</Label>
          <Textarea
            id="rating-comment"
            placeholder="Conte como foi sua experiência..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            className="min-h-[80px] resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
        </div>

        <ActionButton
          className="w-full"
          onClick={handleSubmit}
          disabled={stars === 0}
          loadingLabel="Enviando..."
          successLabel="Enviado!"
        >
          Enviar Avaliação
        </ActionButton>
      </CardContent>
    </Card>
  );
}

export default function ManageAppointment() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const { toast } = useToast();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState<{ terms_type: string; terms_params: Record<string, any> } | null>(null);

  const { data: appointment, isLoading, error } = useAppointmentByToken(slug, token);
  const cancelMutation = useCancelAppointment();
  const rescheduleMutation = useRescheduleAppointment();

  const { data: slotResult } = useAvailableSlots({
    establishmentId: appointment?.establishment?.id,
    professionalId: appointment?.professional?.id,
    serviceDurationMinutes: appointment?.service?.duration_minutes || 30,
    date: selectedDate,
    slotIntervalMinutes: 15,
    bufferMinutes: 0,
  });
  const availableSlots = slotResult?.slots ?? [];

  // Load accepted terms for this appointment
  useEffect(() => {
    if (!appointment) return;
    (supabase as any)
      .from('appointment_accepted_terms')
      .select('terms_type, terms_params')
      .eq('appointment_id', appointment.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setAcceptedTerms(data || null);
      });
  }, [appointment?.id]);

  // Evaluate cancellation rules
  const cancellationDecision = useMemo(() => {
    if (!appointment) return null;
    return evaluateCancellation({
      termsType: (acceptedTerms?.terms_type as CancellationScenario) ?? null,
      termsParams: acceptedTerms?.terms_params ?? null,
      appointmentStartAt: appointment.start_at,
      establishmentPhone: appointment.establishment?.phone ?? null,
      establishmentName: appointment.establishment?.name ?? '',
      serviceName: appointment.service?.name ?? '',
      professionalName: appointment.professional?.name ?? '',
      customerName: appointment.customer?.name,
      appointmentStatus: appointment.status,
    });
  }, [appointment, acceptedTerms]);

  const actionableStatuses = ['booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation'];
  const canModify = appointment && 
    actionableStatuses.includes(appointment.status) &&
    !isBefore(new Date(appointment.start_at), new Date());

  const handleCancel = async () => {
    if (!appointment || !token) return;

    try {
      await cancelMutation.mutateAsync({ appointmentId: appointment.id, token });
      toast({
        title: 'Agendamento cancelado',
        description: 'Seu agendamento foi cancelado com sucesso.',
      });
      setCancelDialogOpen(false);
    } catch (err) {
      toast({
        title: 'Erro ao cancelar',
        description: err instanceof Error ? err.message : 'Ocorreu um erro ao cancelar o agendamento.',
        variant: 'destructive',
      });
    }
  };

  const handleReschedule = async () => {
    if (!appointment || !token || !selectedDate || !selectedTime || !appointment.service) return;

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const newStartAt = new Date(selectedDate);
    newStartAt.setHours(hours, minutes, 0, 0);
    const newEndAt = addMinutes(newStartAt, appointment.service.duration_minutes);

    try {
      await rescheduleMutation.mutateAsync({
        appointmentId: appointment.id,
        token,
        newStartAt: newStartAt.toISOString(),
        newEndAt: newEndAt.toISOString(),
      });
      toast({
        title: 'Agendamento reagendado',
        description: `Novo horário: ${format(newStartAt, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}`,
      });
      setIsRescheduling(false);
      setSelectedDate(undefined);
      setSelectedTime(null);
    } catch (err) {
      toast({
        title: 'Erro ao reagendar',
        description: err instanceof Error ? err.message : 'Ocorreu um erro ao reagendar.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    return <Badge variant={getStatusVariant(status)}>{getStatusLabel(status)}</Badge>;
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Link inválido</CardTitle>
            <CardDescription>
              {error instanceof Error ? error.message : 'Este link não é válido ou expirou.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to={`/${slug}`}>
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Fazer novo agendamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{appointment.establishment?.name}</h1>
          <p className="text-muted-foreground">Gerenciar agendamento</p>
        </div>

        {/* Appointment Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Detalhes do Agendamento</CardTitle>
              {getStatusBadge(appointment.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Service */}
            <div className="flex items-start gap-3">
              <Scissors className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{appointment.service?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {appointment.service?.duration_minutes} minutos
                  {appointment.service?.price_cents && ` • ${formatPrice(appointment.service.price_cents)}`}
                </p>
              </div>
            </div>

            {/* Professional */}
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{appointment.professional?.name}</p>
                <p className="text-sm text-muted-foreground">Profissional</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">
                  {format(new Date(appointment.start_at), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {format(new Date(appointment.start_at), 'HH:mm')} - {format(new Date(appointment.end_at), 'HH:mm')}
                </p>
              </div>
            </div>

            {/* Location */}
            {appointment.establishment?.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{appointment.establishment.address}</p>
                  {appointment.establishment.phone && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {appointment.establishment.phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Customer Notes */}
            {appointment.customer_notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Suas observações:</p>
                  <p className="text-sm">{appointment.customer_notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Reschedule Section */}
        {isRescheduling && canModify && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Escolher novo horário</CardTitle>
              <CardDescription>
                Selecione uma nova data e horário para seu agendamento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                  }}
                  disabled={(date) => date < new Date()}
                  locale={ptBR}
                />
              </div>

              {selectedDate && availableSlots && availableSlots.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2">Horários disponíveis:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        variant={selectedTime === slot ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {selectedDate && availableSlots && availableSlots.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Nenhum horário disponível nesta data
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsRescheduling(false);
                    setSelectedDate(undefined);
                    setSelectedTime(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  disabled={!selectedTime || rescheduleMutation.isPending}
                  onClick={handleReschedule}
                >
                  {rescheduleMutation.isPending ? 'Reagendando...' : 'Confirmar reagendamento'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {canModify && !isRescheduling && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsRescheduling(true)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Reagendar
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1">
                      <XCircle className="mr-2 h-4 w-4" />
                      Cancelar agendamento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {appointment.establishment?.cancellation_policy_text || 
                          'Esta ação não pode ser desfeita. Você precisará fazer um novo agendamento se mudar de ideia.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancel}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelMutation.isPending ? 'Cancelando...' : 'Sim, cancelar'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <p className="text-xs text-muted-foreground text-center mt-4">
                Alterações permitidas até {appointment.establishment?.reschedule_min_hours || 2} horas antes do horário agendado
              </p>
            </CardContent>
          </Card>
        )}

        {/* Cannot Modify Message */}
        {!canModify && ['booked', 'confirmed', 'pending_approval'].includes(appointment.status) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm">
                  Não é possível alterar este agendamento. O prazo mínimo de{' '}
                  {appointment.establishment?.reschedule_min_hours || 2} horas já passou.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Status + Rating */}
        {appointment.status === 'completed' && (
          <>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-emerald-600" />
                  <p className="font-medium">Agendamento concluído</p>
                  <p className="text-sm text-muted-foreground">Obrigado pela visita!</p>
                </div>
              </CardContent>
            </Card>

            {/* Rating Form */}
            {token && (
              <TokenRatingForm
                appointmentId={appointment.id}
                token={token}
                establishmentName={appointment.establishment?.name || ''}
              />
            )}

            <div className="text-center">
              <Link to={`/${slug}`}>
                <Button variant="outline">Fazer novo agendamento</Button>
              </Link>
            </div>
          </>
        )}

        {/* Canceled/Rejected Status */}
        {['canceled', 'canceled_by_customer', 'canceled_by_establishment', 'no_show', 'rejected'].includes(appointment.status) && (
          <Card>
            <CardContent className="pt-6 text-center">
              {appointment.status === 'rejected' ? (
                <div className="flex flex-col items-center gap-2">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="font-medium">Agendamento recusado</p>
                  <p className="text-sm text-muted-foreground">Este agendamento foi recusado pelo estabelecimento.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="font-medium">{getStatusLabel(appointment.status)}</p>
                </div>
              )}
              <Link to={`/${slug}`} className="block mt-4">
                <Button variant="outline">
                  Fazer novo agendamento
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center">
          <Link to={`/${slug}`} className="text-sm text-muted-foreground hover:underline">
            ← Voltar para {appointment.establishment?.name}
          </Link>
        </div>
      </div>
    </div>
  );
}