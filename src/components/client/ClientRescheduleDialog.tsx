import { useState, useMemo, useEffect } from 'react';
import { format, addDays, addMinutes, startOfDay, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Loader2, User, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { useAvailableSlotsForReschedule } from '@/hooks/useAvailableSlotsForReschedule';
import { useClientReschedule } from '@/hooks/useClientReschedule';
import { useProfessionalsByService } from '@/hooks/useProfessionals';
import { cn } from '@/lib/utils';
import type { ClientAppointment } from '@/hooks/useClientAppointments';

interface ClientRescheduleDialogProps {
  appointment: ClientAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClientRescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onSuccess,
}: ClientRescheduleDialogProps) {
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string | undefined>(undefined);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined);
  const [showProfessionalSelector, setShowProfessionalSelector] = useState(false);
  const { toast } = useToast();
  const rescheduleMutation = useClientReschedule();

  // Fetch professionals for this service
  const { data: professionals = [], isLoading: professionalsLoading } = useProfessionalsByService(
    appointment?.service.id
  );

  // Initialize state when dialog opens (handles both internal and external open)
  useEffect(() => {
    if (open && appointment) {
      setSelectedProfessionalId(appointment.professional.id);
      const appointmentDate = new Date(appointment.start_at);
      if (isAfter(appointmentDate, new Date())) {
        setSelectedDate(startOfDay(appointmentDate));
      } else {
        setSelectedDate(startOfDay(addDays(new Date(), 1)));
      }
      setSelectedTime(undefined);
      setShowProfessionalSelector(false);
    }
    if (!open) {
      setSelectedProfessionalId(undefined);
      setSelectedDate(undefined);
      setSelectedTime(undefined);
      setShowProfessionalSelector(false);
    }
  }, [open, appointment]);

  // Reset state when dialog opens with new appointment
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
  };

  // When professional changes, reset date/time
  const handleProfessionalChange = (professionalId: string) => {
    setSelectedProfessionalId(professionalId);
    setSelectedTime(undefined);
    setShowProfessionalSelector(false);
  };

  // Fetch available slots based on selected professional - IGNORE current appointment
  const { data: availableSlots = [], isLoading: slotsLoading } = useAvailableSlotsForReschedule({
    establishmentId: appointment?.establishment.id,
    professionalId: selectedProfessionalId,
    serviceDurationMinutes: appointment?.service.duration_minutes || 30,
    date: selectedDate,
    slotIntervalMinutes: appointment?.establishment.slot_interval_minutes ?? 15,
    bufferMinutes: appointment?.establishment.buffer_minutes ?? 0,
    ignoreAppointmentId: appointment?.id,
  });

  // Date limits - use establishment's max_future_days setting; allow today for future slots
  const maxFutureDays = appointment?.establishment?.max_future_days ?? 7;
  const minDate = startOfDay(new Date());
  const maxDate = addDays(new Date(), maxFutureDays);

  const disabledDays = (date: Date) => {
    return isBefore(date, minDate) || isAfter(date, maxDate);
  };

  // Get selected professional details
  const selectedProfessional = useMemo(() => {
    if (!selectedProfessionalId) return appointment?.professional;
    return professionals.find((p) => p.id === selectedProfessionalId) || appointment?.professional;
  }, [selectedProfessionalId, professionals, appointment]);

  // Check if professional changed
  const professionalChanged = selectedProfessionalId !== appointment?.professional.id;

  const handleReschedule = async () => {
    if (!appointment || !selectedDate || !selectedTime || !selectedProfessionalId) return;

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const newStartAt = new Date(selectedDate);
      newStartAt.setHours(hours, minutes, 0, 0);

      const newEndAt = addMinutes(newStartAt, appointment.service.duration_minutes);

      await rescheduleMutation.mutateAsync({
        appointmentId: appointment.id,
        newStartAt: newStartAt.toISOString(),
        newEndAt: newEndAt.toISOString(),
        newProfessionalId: professionalChanged ? selectedProfessionalId : undefined,
      });

      toast({
        title: 'Agendamento reagendado!',
        description: professionalChanged
          ? `Novo horário com ${selectedProfessional?.name}: ${format(newStartAt, "dd/MM 'às' HH:mm", { locale: ptBR })}`
          : `Novo horário: ${format(newStartAt, "dd/MM 'às' HH:mm", { locale: ptBR })}`,
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reagendar Agendamento
          </DialogTitle>
          <DialogDescription>
            Escolha uma nova data e horário para o serviço "{appointment.service.name}".
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Current appointment info */}
          <div className="p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>Horário atual</span>
            </div>
            <p className="font-medium">
              {format(new Date(appointment.start_at), "EEEE, dd 'de' MMMM 'às' HH:mm", {
                locale: ptBR,
              })}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              com {appointment.professional.name}
            </p>
          </div>

          {/* Professional selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Profissional
              </span>
              {professionals.length > 1 && !showProfessionalSelector && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProfessionalSelector(true)}
                  className="text-xs h-7"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Trocar
                </Button>
              )}
            </div>

            {showProfessionalSelector ? (
              <div className="space-y-2">
                {professionalsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {professionals.map((professional) => (
                      <button
                        key={professional.id}
                        type="button"
                        onClick={() => handleProfessionalChange(professional.id)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors text-left w-full',
                          selectedProfessionalId === professional.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={professional.photo_url || undefined} />
                          <AvatarFallback>
                            {professional.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{professional.name}</p>
                          {professional.id === appointment.professional.id && (
                            <p className="text-xs text-muted-foreground">Profissional atual</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProfessionalSelector(false)}
                  className="w-full text-xs"
                >
                  Cancelar
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedProfessional?.photo_url || undefined} />
                  <AvatarFallback>
                    {selectedProfessional?.name?.charAt(0).toUpperCase() || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedProfessional?.name}</p>
                  {professionalChanged && (
                    <p className="text-xs text-primary">Novo profissional</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Date selection */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
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
                classNames={{
                  months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                  month: 'space-y-4',
                  nav_button: cn(
                    'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
                  ),
                }}
              />
            </div>

            {/* Time slots */}
            {selectedDate && (
              <div className="mt-4 flex-1 min-h-0">
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
                  <ScrollArea className="h-[120px]">
                    <div className="grid grid-cols-4 gap-2 pr-4">
                      {availableSlots.map((time) => (
                        <Button
                          key={time}
                          type="button"
                          variant={selectedTime === time ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTime(time)}
                          className="text-xs"
                        >
                          {time}
                        </Button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={rescheduleMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleReschedule}
            disabled={!selectedDate || !selectedTime || !selectedProfessionalId || rescheduleMutation.isPending}
          >
            {rescheduleMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Confirmar Reagendamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
