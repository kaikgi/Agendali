import { Calendar, Users, XCircle, TrendingUp, UserCheck, UsersRound, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useAppointments } from '@/hooks/useAppointments';
import { useManageProfessionals } from '@/hooks/useManageProfessionals';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis } from 'recharts';
import { PendingApprovalsSection } from '@/components/dashboard/PendingApprovalsSection';

function DashboardContent({ establishmentId }: { establishmentId: string }) {
  const { data: appointments = [] } = useAppointments(establishmentId);
  const { professionals } = useManageProfessionals(establishmentId);
  const {
    today,
    week,
    canceled,
    byProfessional,
    topServices,
    totalCustomers,
    recurringCustomers,
    appointmentsByDay,
    isLoading,
    error,
    refetch,
  } = useDashboardMetrics(establishmentId);

  const handleRetry = () => {
    refetch();
  };

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">Erro ao carregar dashboard</p>
        <Button variant="outline" onClick={handleRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Tentar novamente
        </Button>
      </div>
    );
  }

  const chartConfig = {
    count: {
      label: 'Agendamentos',
      color: 'hsl(var(--primary))',
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu estabelecimento</p>
      </div>

      {/* Pending Approvals */}
      <PendingApprovalsSection
        appointments={appointments as any}
        onAppointmentClick={() => {}}
        professionals={professionals}
      />

      {/* Metrics Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : today}
            </div>
            <p className="text-xs text-muted-foreground">agendamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : week}
            </div>
            <p className="text-xs text-muted-foreground">agendamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelados (7d)</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : canceled}
            </div>
            <p className="text-xs text-muted-foreground">nos últimos 7 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : totalCustomers}
            </div>
            <p className="text-xs text-muted-foreground">cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Recorrentes</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : recurringCustomers}
            </div>
            <p className="text-xs text-muted-foreground">com 2+ agendamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profissionais</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? <Skeleton className="h-8 w-12" /> : byProfessional.length}
            </div>
            <p className="text-xs text-muted-foreground">ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointments Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Agendamentos por Dia</CardTitle>
          <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[250px] w-full" />
          ) : appointmentsByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum dado disponível
            </p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[200px] sm:h-[250px] w-full">
              <BarChart
                data={appointmentsByDay}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
             >
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Serviços Mais Agendados</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : topServices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum agendamento registrado ainda
              </p>
            ) : (
              <div className="space-y-3">
                {topServices.map((service, idx) => (
                  <div
                    key={service.service_id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-5">
                        {idx + 1}.
                      </span>
                      <span className="text-sm font-medium">{service.service_name}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {service.total_30d} agendamentos
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* By Professional */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Por Profissional</CardTitle>
            <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : byProfessional.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum profissional cadastrado ainda
              </p>
            ) : (
              <div className="space-y-3">
                {byProfessional.map((prof) => (
                  <div
                    key={prof.professional_id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">{prof.professional_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {prof.total_30d} agendamentos
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const {
    data: establishment,
    isLoading: estLoading,
    error: estError,
  } = useUserEstablishment();

  if (estLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (estError) {
    const errorMsg = (estError as any)?.message || 'Erro desconhecido';
    console.error('[DashboardHome] Establishment error:', estError);
    
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-2 font-bold text-lg">Erro ao carregar estabelecimento</p>
        <p className="text-sm text-muted-foreground mb-4">
          {errorMsg === 'JWT expired' ? 'Sua sessão expirou. Por favor, faça login novamente.' : 'Verifique sua conexão ou tente novamente mais tarde.'}
        </p>
        <p className="text-xs text-muted-foreground bg-muted p-2 rounded max-w-md mx-auto overflow-hidden text-ellipsis whitespace-nowrap">
          Detalhes: {errorMsg}
        </p>
        <Button 
          variant="outline" 
          className="mt-6"
          onClick={() => window.location.reload()}
        >
          Recarregar página
        </Button>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="space-y-4 max-w-xl">
        <h1 className="text-2xl font-bold">Bem-vindo ao Agendali</h1>
        <p className="text-muted-foreground">
          Para começar a usar o dashboard, finalize a configuração do seu estabelecimento
          na aba Configurações.
        </p>
        <p className="text-sm text-muted-foreground">
          Após criar o estabelecimento, as métricas e dados do dashboard serão exibidos
          automaticamente aqui.
        </p>
      </div>
    );
  }

  return <DashboardContent establishmentId={establishment.id} />;
}
