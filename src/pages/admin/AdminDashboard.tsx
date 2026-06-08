import { useAdminStats } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, CreditCard, AlertTriangle, CheckCircle2, XCircle, TrendingUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";

function StatCard({ title, value, icon: Icon, loading, variant, subtitle }: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}) {
  const bgMap = {
    default: 'bg-card',
    success: 'bg-card border-green-500/20',
    warning: 'bg-card border-amber-500/20',
    danger: 'bg-card border-destructive/20',
  };
  const iconBgMap = {
    default: 'bg-muted',
    success: 'bg-green-500/10',
    warning: 'bg-amber-500/10',
    danger: 'bg-destructive/10',
  };
  const iconColorMap = {
    default: 'text-muted-foreground',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-destructive',
  };
  const v = variant || 'default';
  return (
    <Card className={bgMap[v]}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <p className="text-3xl font-bold tabular-nums">{value}</p>
            )}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg ${iconBgMap[v]} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${iconColorMap[v]}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading, error, refetch } = useAdminStats();
  const queryClient = useQueryClient();

  if (error) {
    return (
      <div className="text-center py-12 space-y-2">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-destructive font-medium">Erro ao carregar estatísticas</p>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message || 'Erro desconhecido'}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3 gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const activeCount = stats?.by_status?.active ?? 0;
  const pastDueCount = (stats?.by_status?.past_due ?? 0) + (stats?.by_status?.canceled ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">Centro de comando do Agendali SaaS</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Estabelecimentos"
          value={stats?.total_establishments ?? 0}
          icon={Building2}
          loading={isLoading}
          subtitle="Cadastrados na plataforma"
        />
        <StatCard
          title="Pagantes (Active)"
          value={activeCount}
          icon={CheckCircle2}
          loading={isLoading}
          variant="success"
          subtitle="Assinaturas ativas"
        />
        <StatCard
          title="Bloqueados / Cancelados"
          value={pastDueCount}
          icon={XCircle}
          loading={isLoading}
          variant="danger"
          subtitle="Acesso suspenso"
        />
        <StatCard
          title="Total de Clientes"
          value={stats?.total_customers ?? 0}
          icon={Users}
          loading={isLoading}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Assinaturas Ativas"
          value={stats?.active_subscriptions ?? 0}
          icon={CreditCard}
          loading={isLoading}
          variant="success"
        />
        <StatCard
          title="Novos este mês"
          value={stats?.recent_establishments?.length ?? 0}
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      {/* Status Breakdown */}
      {stats?.by_status && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.by_status).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg">
                  <Badge variant={status === 'active' ? 'default' : 'destructive'}>
                    {status}
                  </Badge>
                  <span className="text-lg font-bold tabular-nums">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Establishments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Últimos Estabelecimentos Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : stats?.recent_establishments?.length ? (
            <div className="divide-y">
              {stats.recent_establishments.map((est) => (
                <div key={est.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{est.name}</p>
                      <p className="text-xs text-muted-foreground">{est.owner_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={est.status === 'active' ? 'default' : 'destructive'}>
                      {est.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {format(new Date(est.created_at), "dd/MM/yy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-sm">Nenhum estabelecimento ainda</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
