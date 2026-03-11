import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, XCircle, Clock, User, Scissors, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUpdateAppointmentStatus } from '@/hooks/useAppointments';
import { useToast } from '@/hooks/use-toast';

interface PendingAppointment {
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

interface PendingApprovalsSectionProps {
  appointments: PendingAppointment[];
  onAppointmentClick: (apt: PendingAppointment) => void;
}

export function PendingApprovalsSection({ appointments, onAppointmentClick }: PendingApprovalsSectionProps) {
  const { mutateAsync: updateStatus, isPending } = useUpdateAppointmentStatus();
  const { toast } = useToast();

  const pendingApprovals = appointments.filter((a) => a.status === 'pending_approval');

  if (pendingApprovals.length === 0) return null;

  const handleApprove = async (e: React.MouseEvent, apt: PendingAppointment) => {
    e.stopPropagation();
    try {
      await updateStatus({ id: apt.id, status: 'confirmed' as any, oldStatus: 'pending_approval' });
      toast({ title: 'Agendamento aprovado!' });
    } catch {
      toast({ title: 'Erro ao aprovar', variant: 'destructive' });
    }
  };

  const handleReject = async (e: React.MouseEvent, apt: PendingAppointment) => {
    e.stopPropagation();
    try {
      await updateStatus({ id: apt.id, status: 'rejected' as any, oldStatus: 'pending_approval' });
      toast({ title: 'Agendamento recusado' });
    } catch {
      toast({ title: 'Erro ao recusar', variant: 'destructive' });
    }
  };

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-600" />
          Aguardando aprovação
          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
            {pendingApprovals.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingApprovals.map((apt) => (
          <div
            key={apt.id}
            onClick={() => onAppointmentClick(apt)}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-background cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {format(parseISO(apt.start_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-2 text-sm mt-1">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{apt.customer?.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                <Scissors className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{apt.service?.name} • {apt.professional?.name}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                onClick={(e) => handleApprove(e, apt)}
                disabled={isPending}
                className="gap-1"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => handleReject(e, apt)}
                disabled={isPending}
                className="gap-1"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Recusar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
