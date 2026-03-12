import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, User, Scissors, Phone, Mail, FileText, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateAppointmentStatus, useUpdateAppointmentNotes } from '@/hooks/useAppointments';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { statusColors, statusLabels, type AppointmentStatus } from '@/lib/appointmentStatus';

interface Appointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
  professional: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
}

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
}

const statusOptions: AppointmentStatus[] = ['pending_approval', 'paid_pending_confirmation', 'pending_payment', 'booked', 'confirmed', 'completed', 'no_show', 'canceled', 'rejected'];

export function AppointmentDetailsDialog({ open, onOpenChange, appointment }: AppointmentDetailsDialogProps) {
  const { mutateAsync: updateStatus, isPending: isUpdatingStatus } = useUpdateAppointmentStatus();
  const { mutateAsync: updateNotes, isPending: isUpdatingNotes } = useUpdateAppointmentNotes();
  const { toast } = useToast();
  
  const [internalNotes, setInternalNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (appointment) {
      setInternalNotes(appointment.internal_notes || '');
      setHasChanges(false);
    }
  }, [appointment]);

  if (!appointment) return null;

  const handleStatusChange = async (newStatus: AppointmentStatus) => {
    try {
      await updateStatus({ id: appointment.id, status: newStatus, oldStatus: appointment.status });
      toast({ title: 'Status atualizado com sucesso!' });
      // Auto-close modal on success
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({ 
        title: 'Erro ao atualizar status', 
        description: errorMessage,
        variant: 'destructive' 
      });
    }
  };

  const handleNotesChange = (value: string) => {
    setInternalNotes(value);
    setHasChanges(value !== (appointment.internal_notes || ''));
  };

  const handleSaveNotes = async () => {
    try {
      await updateNotes({ 
        id: appointment.id, 
        internal_notes: internalNotes.trim() || null 
      });
      setHasChanges(false);
      toast({ title: 'Notas salvas com sucesso!' });
    } catch (err) {
      toast({ title: 'Erro ao salvar notas', variant: 'destructive' });
      throw err;
    }
  };

  const isPending = isUpdatingStatus || isUpdatingNotes;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
          <DialogDescription>
            {format(parseISO(appointment.start_at), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn("text-sm", statusColors[appointment.status])}>
              {statusLabels[appointment.status]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Criado em {format(parseISO(appointment.created_at), "dd/MM/yyyy 'às' HH:mm")}
            </span>
          </div>

          <Separator />

          {/* Time & Service */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {format(parseISO(appointment.start_at), 'HH:mm')} - {format(parseISO(appointment.end_at), 'HH:mm')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {appointment.service?.duration_minutes} minutos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Scissors className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{appointment.service?.name}</p>
                <p className="text-sm text-muted-foreground">Serviço</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{appointment.professional?.name}</p>
                <p className="text-sm text-muted-foreground">Profissional</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Cliente</p>
            <div className="space-y-2">
              <p className="font-medium">{appointment.customer?.name}</p>
              
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <a 
                  href={`tel:${appointment.customer?.phone}`}
                  className="text-primary hover:underline"
                >
                  {appointment.customer?.phone}
                </a>
              </div>

              {appointment.customer?.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <a 
                    href={`mailto:${appointment.customer?.email}`}
                    className="text-primary hover:underline"
                  >
                    {appointment.customer?.email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Customer Notes (read-only) */}
          {appointment.customer_notes && (
            <>
              <Separator />
              <div className="flex items-start gap-2">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Observações do cliente</p>
                  <p className="text-sm text-muted-foreground">{appointment.customer_notes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Internal Notes (editable) */}
          <div className="space-y-2">
            <Label htmlFor="internal-notes">Notas internas</Label>
            <Textarea
              id="internal-notes"
              placeholder="Adicione anotações sobre este agendamento..."
              value={internalNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              className="min-h-[80px] resize-none"
              maxLength={500}
            />
            {hasChanges && (
              <ActionButton
                size="sm"
                onClick={handleSaveNotes}
                icon={<Save className="h-4 w-4" />}
                loadingLabel="Salvando..."
                successLabel="Salvo!"
                className="w-full"
              >
                Salvar notas
              </ActionButton>
            )}
          </div>

          <Separator />

          {/* Change Status */}
          <div className="space-y-2">
            <Label>Alterar Status</Label>
            <Select 
              value={appointment.status} 
              onValueChange={(value) => handleStatusChange(value as AppointmentStatus)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 pt-2">
            {appointment.status === 'pending_approval' && (
              <>
                <Button 
                  className="flex-1" 
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={isPending}
                >
                  Aprovar
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1" 
                  onClick={() => handleStatusChange('rejected')}
                  disabled={isPending}
                >
                  Recusar
                </Button>
              </>
            )}
            {appointment.status === 'booked' && (
              <Button 
                className="flex-1" 
                onClick={() => handleStatusChange('confirmed')}
                disabled={isPending}
              >
                Confirmar
              </Button>
            )}
            {(appointment.status === 'booked' || appointment.status === 'confirmed') && (
              <>
                <Button 
                  variant="outline"
                  className="flex-1" 
                  onClick={() => handleStatusChange('completed')}
                  disabled={isPending}
                >
                  Concluir
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1" 
                  onClick={() => handleStatusChange('canceled')}
                  disabled={isPending}
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
