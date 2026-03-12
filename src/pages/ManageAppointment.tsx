import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, addMinutes, isBefore, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, User, Scissors, MapPin, Phone, AlertTriangle, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getStatusLabel, getStatusVariant } from '@/lib/appointmentStatus';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAppointmentByToken, useCancelAppointment, useRescheduleAppointment } from '@/hooks/useAppointmentByToken';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';

export default function ManageAppointment() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const { toast } = useToast();
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

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

  const canModify = appointment && 
    ['booked', 'confirmed', 'pending_approval'].includes(appointment.status) &&
    isBefore(new Date(), addHours(new Date(appointment.start_at), -(appointment.establishment?.reschedule_min_hours || 2)));

  const handleCancel = async () => {
    if (!appointment || !token) return;

    try {
      await cancelMutation.mutateAsync({ appointmentId: appointment.id, token });
      toast({
        title: 'Agendamento cancelado',
        description: 'Seu agendamento foi cancelado com sucesso.',
      });
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
        {!canModify && ['booked', 'confirmed'].includes(appointment.status) && (
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

        {/* Completed/Canceled Status */}
        {['completed', 'canceled', 'canceled_by_customer', 'canceled_by_establishment', 'no_show', 'rejected'].includes(appointment.status) && (
          <Card>
            <CardContent className="pt-6 text-center">
              {appointment.status === 'completed' ? (
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <p className="font-medium">Agendamento concluído</p>
                  <p className="text-sm text-muted-foreground">Obrigado pela visita!</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <XCircle className="h-8 w-8 text-destructive" />
                  <p className="font-medium">Agendamento cancelado</p>
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
