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
  ThumbsDown,
  Phone,
  Mail,
  DollarSign,
  CreditCard,
  Receipt,
  MessageSquare,
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

export interface PortalAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  service_name: string;
  service_duration: number;
  service_price_cents?: number | null;
  customer_notes: string | null;
  internal_notes?: string | null;
  completed_at?: string | null;
  created_at?: string;
  payment_status?: string | null;
  payment_amount_cents?: number | null;
  commission_amount_cents?: number | null;
  commission_type?: string | null;
  commission_value?: number | null;
}

const statusColors: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800 border-amber-200',
  paid_pending_confirmation: 'bg-amber-100 text-amber-800 border-amber-200',
  pending_payment: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  booked: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmed: 'bg-green-100 text-green-800 border-green-200',
  completed: 'bg-muted text-muted-foreground border-border',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  canceled: 'bg-red-100 text-red-800 border-red-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<string, string> = {
  pending_approval: 'Aguardando aprovação',
  paid_pending_confirmation: 'Pago – aguardando confirmação',
  pending_payment: 'Aguardando pagamento',
  booked: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  canceled: 'Cancelado',
  rejected: 'Recusado',
};

function formatCents(cents: number | null | undefined): string {
  if (!cents) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

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

  const isPending = ['pending_approval', 'paid_pending_confirmation'].includes(appointment.status);
  const isActive = ['booked', 'confirmed', 'pending_approval', 'paid_pending_confirmation'].includes(appointment.status);
  const canConfirm = isPending || appointment.status === 'booked';
  const canReject = isPending;
  const isFinalized = ['completed', 'canceled', 'no_show', 'rejected'].includes(appointment.status);

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

  const handleEmail = () => {
    if (appointment.customer_email) {
      window.open(`mailto:${appointment.customer_email}`, '_blank');
    }
  };

  const hasPayment = appointment.payment_status && appointment.payment_amount_cents;
  const hasCommission = appointment.commission_amount_cents != null && appointment.commission_amount_cents > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
          <DialogDescription>
            {format(parseISO(appointment.start_at), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className={cn('text-xs', statusColors[appointment.status])}>
              {statusLabels[appointment.status] || appointment.status}
            </Badge>
            {appointment.created_at && (
              <span className="text-[10px] text-muted-foreground">
                Criado em {format(parseISO(appointment.created_at), 'dd/MM HH:mm')}
              </span>
            )}
          </div>

          {/* Pending approval highlight */}
          {isPending && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-sm font-medium text-amber-800">
                ⏳ Este agendamento precisa da sua aprovação
              </p>
              <p className="text-xs text-amber-700 mt-1">
                Confirme ou recuse este atendimento.
              </p>
            </div>
          )}

          {/* Main details */}
          <div className="space-y-3">
            {/* Time */}
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">
                  {format(parseISO(appointment.start_at), 'HH:mm')} – {format(parseISO(appointment.end_at), 'HH:mm')}
                </p>
                <p className="text-sm text-muted-foreground">{appointment.service_duration} minutos</p>
              </div>
            </div>

            {/* Customer */}
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{appointment.customer_name}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 hover:underline"
                  >
                    <Phone className="h-3 w-3" />
                    {appointment.customer_phone}
                  </button>
                  {appointment.customer_email && (
                    <button
                      type="button"
                      onClick={handleEmail}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {appointment.customer_email}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Service */}
            <div className="flex items-center gap-3">
              <Scissors className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-medium">{appointment.service_name}</p>
                {appointment.service_price_cents != null && appointment.service_price_cents > 0 && (
                  <p className="text-sm text-muted-foreground">{formatCents(appointment.service_price_cents)}</p>
                )}
              </div>
            </div>

            {/* Payment info */}
            {hasPayment && (
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Pagamento: {formatCents(appointment.payment_amount_cents)}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-0.5">
                    {appointment.payment_status === 'approved' ? 'Pago' :
                     appointment.payment_status === 'pending' ? 'Pendente' :
                     appointment.payment_status === 'refunded' ? 'Reembolsado' :
                     appointment.payment_status}
                  </Badge>
                </div>
              </div>
            )}

            {/* Commission info */}
            {hasCommission && (
              <div className="flex items-center gap-3">
                <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium">
                    Comissão: {formatCents(appointment.commission_amount_cents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {appointment.commission_type === 'percentage'
                      ? `${appointment.commission_value}% do serviço`
                      : 'Valor fixo'}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {appointment.customer_notes && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Observação do cliente</p>
                    <p className="text-sm">{appointment.customer_notes}</p>
                  </div>
                </div>
              </>
            )}

            {appointment.internal_notes && (
              <div className="flex items-start gap-3">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Nota interna</p>
                  <p className="text-sm">{appointment.internal_notes}</p>
                </div>
              </div>
            )}

            {/* Completed info */}
            {appointment.status === 'completed' && appointment.completed_at && (
              <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                Concluído em {format(parseISO(appointment.completed_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {isActive && (
          <div className="space-y-3 pt-4 border-t">
            {/* Primary: Confirm / Reject for pending */}
            {isPending && (
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAction('confirmed')}
                  disabled={!!loading}
                >
                  {loading === 'confirmed' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4 mr-2" />
                  )}
                  Aprovar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                  onClick={() => handleAction('rejected')}
                  disabled={!!loading}
                >
                  {loading === 'rejected' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 mr-2" />
                  )}
                  Recusar
                </Button>
              </div>
            )}

            {/* Confirm for booked (non-pending) */}
            {!isPending && canConfirm && (
              <Button
                variant="outline"
                className="w-full text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
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

            {/* Complete / No-show / Cancel */}
            <div className="flex flex-col sm:flex-row gap-2">
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
            </div>

            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => handleAction('canceled')}
              disabled={!!loading}
            >
              {loading === 'canceled' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Cancelar agendamento
            </Button>
          </div>
        )}

        {isFinalized && (
          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              Este agendamento já foi finalizado e não pode mais ser alterado.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
