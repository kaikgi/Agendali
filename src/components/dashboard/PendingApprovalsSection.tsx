import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, User, Scissors, Loader2, DollarSign, CreditCard, CalendarDays, MessageSquare, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useAllCustomerTags } from '@/hooks/useClientTags';
import { toast } from 'sonner';

interface PendingAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
  professional: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents?: number | null } | null;
}

interface PendingApprovalsSectionProps {
  appointments: PendingAppointment[];
  onAppointmentClick: (apt: PendingAppointment) => void;
  professionals?: { id: string; name: string }[];
}

const PENDING_STATUSES = ['pending_approval', 'paid_pending_confirmation'];

function formatCents(cents: number | null | undefined): string {
  if (!cents) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PendingApprovalsSection({ appointments, onAppointmentClick, professionals = [] }: PendingApprovalsSectionProps) {
  const { mutateAsync: updateStatus, isPending: isUpdating } = useUpdateAppointmentStatus();
  const { data: establishment } = useUserEstablishment();
  const { data: allCustomerTags = [] } = useAllCustomerTags(establishment?.id);

  const customerTagsMap = useMemo(() => {
    const map = new Map<string, typeof allCustomerTags>();
    for (const ct of allCustomerTags) {
      const list = map.get(ct.customer_id) ?? [];
      list.push(ct);
      map.set(ct.customer_id, list);
    }
    return map;
  }, [allCustomerTags]);

  const renderCustomerTags = (customerId: string | undefined) => {
    if (!customerId) return null;
    const tags = customerTagsMap.get(customerId);
    if (!tags?.length) return null;
    return (
      <span className="inline-flex flex-wrap gap-0.5 ml-1">
        {tags.map((ct) => (
          <span
            key={ct.tag_id}
            className="inline-flex items-center px-1 py-0 rounded-full text-[9px] font-medium text-white leading-none"
            style={{ backgroundColor: ct.tag?.color || '#6b7280' }}
          >
            {ct.tag?.name}
          </span>
        ))}
      </span>
    );
  };

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; apt: PendingAppointment | null }>({ open: false, apt: null });
  const [rejectReason, setRejectReason] = useState('');
  const [filterProfessional, setFilterProfessional] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingApprovals = useMemo(() => {
    let filtered = appointments.filter((a) => PENDING_STATUSES.includes(a.status));
    if (filterProfessional !== 'all') {
      filtered = filtered.filter((a) => a.professional?.id === filterProfessional);
    }
    if (filterStatus !== 'all') {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }
    return filtered.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [appointments, filterProfessional, filterStatus]);

  const paidCount = pendingApprovals.filter((a) => a.status === 'paid_pending_confirmation').length;
  const unpaidCount = pendingApprovals.filter((a) => a.status === 'pending_approval').length;

  if (pendingApprovals.length === 0 && filterProfessional === 'all' && filterStatus === 'all') return null;

  const handleApprove = async (e: React.MouseEvent, apt: PendingAppointment) => {
    e.stopPropagation();
    setProcessingId(apt.id);
    try {
      await updateStatus({ id: apt.id, status: 'confirmed' as any, oldStatus: apt.status });
      toast.success('Agendamento aprovado com sucesso!');
    } catch {
      toast.error('Erro ao aprovar agendamento');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (e: React.MouseEvent, apt: PendingAppointment) => {
    e.stopPropagation();
    setRejectReason('');
    setRejectDialog({ open: true, apt });
  };

  const handleReject = async () => {
    if (!rejectDialog.apt) return;
    setProcessingId(rejectDialog.apt.id);
    try {
      // Save reason as internal note if provided
      if (rejectReason.trim()) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase
          .from('appointments')
          .update({ internal_notes: `Motivo da recusa: ${rejectReason.trim()}` })
          .eq('id', rejectDialog.apt.id);
      }
      await updateStatus({ id: rejectDialog.apt.id, status: 'rejected' as any, oldStatus: rejectDialog.apt.status });
      toast.success('Agendamento recusado');
      setRejectDialog({ open: false, apt: null });
    } catch {
      toast.error('Erro ao recusar agendamento');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'paid_pending_confirmation') {
      return <Badge className="bg-primary/10 text-primary border-primary/20">Pago — aguardando</Badge>;
    }
    return <Badge variant="secondary">Aguardando aprovação</Badge>;
  };

  return (
    <>
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Aguardando aprovação
              <Badge variant="outline" className="ml-1">{pendingApprovals.length}</Badge>
              {paidCount > 0 && (
                <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {paidCount} pago{paidCount > 1 ? 's' : ''}
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {professionals.length > 1 && (
                <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending_approval">Sem pagamento</SelectItem>
                  <SelectItem value="paid_pending_confirmation">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum agendamento pendente com os filtros selecionados.</p>
          ) : (
            pendingApprovals.map((apt) => (
              <div
                key={apt.id}
                onClick={() => onAppointmentClick(apt)}
                className="flex flex-col gap-3 p-4 rounded-lg border bg-background cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(apt.status)}
                      <span className="text-xs text-muted-foreground">
                        Solicitado {format(parseISO(apt.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {format(parseISO(apt.start_at), "EEEE, dd/MM 'às' HH:mm", { locale: ptBR })}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">{apt.customer?.name}</span>
                      {renderCustomerTags(apt.customer?.id)}
                      {(apt.customer_email || apt.customer?.email) && (
                        <span className="text-muted-foreground text-xs truncate hidden sm:inline">
                          • {apt.customer_email || apt.customer?.email}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Scissors className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {apt.service?.name}
                        {apt.service?.price_cents ? ` • ${formatCents(apt.service.price_cents)}` : ''}
                        {' • '}{apt.professional?.name}
                      </span>
                    </div>

                    {apt.customer_notes && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span className="italic">"{apt.customer_notes}"</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0 sm:flex-col">
                    <Button
                      size="sm"
                      onClick={(e) => handleApprove(e, apt)}
                      disabled={isUpdating && processingId === apt.id}
                      className="gap-1.5 flex-1 sm:flex-none"
                    >
                      {isUpdating && processingId === apt.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => openRejectDialog(e, apt)}
                      disabled={isUpdating && processingId === apt.id}
                      className="gap-1.5 flex-1 sm:flex-none text-destructive hover:text-destructive"
                    >
                      {isUpdating && processingId === apt.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5" />
                      )}
                      Recusar
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(v) => !v && setRejectDialog({ open: false, apt: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar agendamento</DialogTitle>
          </DialogHeader>
          {rejectDialog.apt && (
            <div className="space-y-4 py-2">
              <div className="text-sm space-y-1">
                <p><span className="font-medium">Cliente:</span> {rejectDialog.apt.customer?.name}</p>
                <p><span className="font-medium">Serviço:</span> {rejectDialog.apt.service?.name}</p>
                <p><span className="font-medium">Data:</span> {format(parseISO(rejectDialog.apt.start_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                {rejectDialog.apt.status === 'paid_pending_confirmation' && (
                  <p className="text-primary font-medium flex items-center gap-1.5 mt-2">
                    <CreditCard className="h-4 w-4" />
                    Este agendamento possui pagamento aprovado.
                  </p>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Motivo da recusa (opcional)</Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Ex: Horário indisponível, profissional ausente..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">O motivo será registrado nas notas internas do agendamento.</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, apt: null })}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isUpdating}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
