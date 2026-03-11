import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock,
  User,
  Scissors,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ThumbsUp,
  Phone,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PortalAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  service_duration: number;
  customer_notes: string | null;
}

const statusColors: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  booked: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  canceled: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<string, string> = {
  pending_approval: 'Aguardando aprovação',
  booked: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  canceled: 'Cancelado',
  rejected: 'Recusado',
};

interface ProfessionalAppointmentDialogProps {
  appointment: PortalAppointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onStatusChanged: () => void;
}

export function ProfessionalAppointmentDialog({
  appointment,
  open,
  onOpenChange,
  token,
  onStatusChanged,
}: ProfessionalAppointmentDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  if (!appointment) return null;

  const canAct = ['booked', 'confirmed'].includes(appointment.status);
  const canConfirm = appointment.status === 'booked';

  const handleAction = async (newStatus: string) => {
    setLoading(newStatus);
    try {
      const { data, error } = await (supabase.rpc as any)('professional_update_appointment_status', {
        p_token: token,
        p_appointment_id: appointment.id,
        p_new_status: newStatus,
      });

      if (error) throw error;

      const result = data as unknown as { success: boolean; message?: string; error?: string };
      if (!result.success) throw new Error(result.error);

      toast({ title: result.message || 'Status atualizado' });
      onStatusChanged();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleWhatsApp = () => {
    const phone = appointment.customer_phone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${fullPhone}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
          <DialogDescription>
            {format(parseISO(appointment.start_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn('text-xs', statusColors[appointment.status])}>
              {statusLabels[appointment.status]}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">
                  {format(parseISO(appointment.start_at), 'HH:mm')} - {format(parseISO(appointment.end_at), 'HH:mm')}
                </p>
                <p className="text-sm text-muted-foreground">{appointment.service_duration} minutos</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{appointment.customer_name}</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-muted-foreground">{appointment.customer_phone}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                    onClick={handleWhatsApp}
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    WhatsApp
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="font-medium">{appointment.service_name}</p>
            </div>

            {appointment.customer_notes && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm">{appointment.customer_notes}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {canAct && (
          <div className="space-y-3 pt-4 border-t">
            {/* Primary actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              {canConfirm && (
                <Button
                  variant="outline"
                  className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                  onClick={() => handleAction('confirmed')}
                  disabled={!!loading}
                >
                  {loading === 'confirmed' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 mr-2" />
                  )}
                  Confirmar
                </Button>
              )}
              <Button
                className="flex-1"
                onClick={() => handleAction('completed')}
                disabled={!!loading}
              >
                {loading === 'completed' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Concluir
              </Button>
            </div>

            {/* Secondary actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleAction('no_show')}
                disabled={!!loading}
              >
                {loading === 'no_show' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                Não compareceu
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-destructive hover:text-destructive"
                onClick={() => handleAction('canceled')}
                disabled={!!loading}
              >
                {loading === 'canceled' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
