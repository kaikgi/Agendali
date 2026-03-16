import { useState, useEffect } from 'react';
import { format, addDays, addMinutes, startOfDay, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Loader2, CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useAvailableSlotsForReschedule } from '@/hooks/useAvailableSlotsForReschedule';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface EstablishmentAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  professional: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
}

interface EstablishmentRescheduleDialogProps {
  appointment: EstablishmentAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function useEstablishmentReschedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      newStartAt,
      newEndAt,
    }: {
      appointmentId: string;
      newStartAt: string;
      newEndAt: string;
    }) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          start_at: newStartAt,
          end_at: newEndAt,
        })
        .eq('id', appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments-month'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots-reschedule'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}

export function EstablishmentRescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: EstablishmentRescheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { data: establishment } = useUserEstablishment();
  const rescheduleMutation = useEstablishmentReschedule();

  useEffect(() => {
    if (open && appointment) {
      const appointmentDate = new Date(appointment.start_at);
      if (isAfter(appointmentDate, new Date())) {
        setSelectedDate(startOfDay(appointmentDate));
      } else {
        setSelectedDate(startOfDay(new Date()));
      }
      setSelectedTime(undefined);
    }
    if (!open) {
      setSelectedDate(undefined);
      setSelectedTime(undefined);
    }
  }, [open, appointment]);

  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlotsForReschedule({
    establishmentId: establishment?.id,
    professionalId: appointment?.professional?.id,
    serviceDurationMinutes: appointment?.service?.duration_minutes || 30,
    date: selectedDate,
    slotIntervalMinutes: establishment?.slot_interval_minutes ?? 15,
    bufferMinutes: establishment?.buffer_minutes ?? 0,
    ignoreAppointmentId: appointment?.id,
  });

  const maxFutureDays = establishment?.max_future_days ?? 30;
  const minDate = startOfDay(new Date());
  const maxDate = addDays(new Date(), maxFutureDays);

  const disabledDays = (date: Date) => {
    return isBefore(date, minDate) || isAfter(date, maxDate);
  };

  const handleReschedule = async () => {
    if (!appointment || !selectedDate || !selectedTime) return;

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const newStartAt = new Date(selectedDate);
      newStartAt.setHours(hours, minutes, 0, 0);

      const duration = appointment.service?.duration_minutes || 30;
      const newEndAt = addMinutes(newStartAt, duration);

      await rescheduleMutation.mutateAsync({
        appointmentId: appointment.id,
        newStartAt: newStartAt.toISOString(),
        newEndAt: newEndAt.toISOString(),
      });

      toast({
        title: 'Agendamento reagendado!',
        description: `Novo horário: ${format(newStartAt, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao reagendar',
        description: error instanceof Error ? error.message : 'Tente novamente mais tarde',
      });
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Reagendar Agendamento
          </DialogTitle>
          <DialogDescription>
            {appointment.customer?.name} — {appointment.service?.name} com {appointment.professional?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Horário atual</span>
            </div>
            <p className="font-medium">
              {format(new Date(appointment.start_at), "EEEE, dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Date selection */}
          <div className="flex items-center justify-center">
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedTime(undefined);
              }}
              disabled={disabledDays}
              locale={ptBR}
              className="rounded-md border pointer-events-auto"
            />
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <h4 className="text-sm font-medium mb-2">Horários disponíveis</h4>
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum horário disponível nesta data.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((time) => (
                    <Button
                      key={time}
                      type="button"
                      variant={selectedTime === time ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                      className="text-xs touch-target"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t mt-2 sticky bottom-0 bg-background pb-1">
          <Button
            variant="outline"
            className="flex-1 touch-target"
            onClick={() => onOpenChange(false)}
            disabled={rescheduleMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 touch-target"
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedTime || rescheduleMutation.isPending}
          >
            {rescheduleMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Confirmar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
