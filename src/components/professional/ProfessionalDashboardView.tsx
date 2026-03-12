import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  Clock,
  Wallet,
  BarChart3,
  Bell,
} from 'lucide-react';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface DashboardStats {
  success: boolean;
  today_count: number;
  next7_count: number;
  pending_approval: number;
  completed_month: number;
  canceled_month: number;
  noshow_month: number;
  revenue_month: number;
  commission_month: number;
  commission_pending: number;
  commission_settled: number;
  ticket_medio: number;
}

interface ProfessionalDashboardViewProps {
  token: string;
  professionalName: string;
}

export function ProfessionalDashboardView({ token, professionalName }: ProfessionalDashboardViewProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['professional-portal-dashboard', token],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_professional_dashboard_stats', {
        p_token: token,
      });
      if (error) throw error;
      return data as DashboardStats;
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 11 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  if (!data?.success) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>Não foi possível carregar o painel.</p>
        </CardContent>
      </Card>
    );
  }

  const kpiCards = [
    {
      label: 'Hoje',
      value: String(data.today_count),
      icon: CalendarCheck,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Próximos 7 dias',
      value: String(data.next7_count),
      icon: CalendarDays,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    ...(data.pending_approval > 0
      ? [
          {
            label: 'Aguardando aprovação',
            value: String(data.pending_approval),
            icon: Bell,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
            highlight: true,
          },
        ]
      : []),
    {
      label: 'Concluídos (mês)',
      value: String(data.completed_month),
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Cancelados (mês)',
      value: String(data.canceled_month),
      icon: XCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
    {
      label: 'No-show (mês)',
      value: String(data.noshow_month),
      icon: AlertTriangle,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      label: 'Receita (mês)',
      value: formatCents(data.revenue_month),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Comissão (mês)',
      value: formatCents(data.commission_month),
      icon: TrendingUp,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
    {
      label: 'Comissão pendente',
      value: formatCents(data.commission_pending),
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Já recebido',
      value: formatCents(data.commission_settled),
      icon: Wallet,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
    },
    {
      label: 'Ticket médio',
      value: formatCents(data.ticket_medio),
      icon: BarChart3,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">
          Olá, {professionalName?.split(' ')[0]} 👋
        </h2>
        <p className="text-sm text-muted-foreground">
          Aqui está o resumo da sua operação este mês.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => (
          <Card
            key={card.label}
            className={`hover:shadow-md transition-shadow ${
              (card as any).highlight ? 'ring-2 ring-amber-300 shadow-amber-100' : ''
            }`}
          >
            <CardContent className="p-4 flex flex-col items-start gap-3">
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold leading-none">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
