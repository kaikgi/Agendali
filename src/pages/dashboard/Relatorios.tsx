import { useState } from 'react';
import { FeatureGate } from '@/components/dashboard/FeatureGate';
import { useReportData, type ReportFilters } from '@/hooks/useReportData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import {
  Calendar, TrendingUp, TrendingDown, Users, DollarSign, Download, BarChart3,
  UserCheck, UserX, Clock, Percent, Target, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useInteractiveGuide, GuideOverlay, type GuideStep } from '@/components/guide';

const RELATORIOS_GUIDE_STEPS: GuideStep[] = [
  {
    id: 'intro',
    title: 'Relatórios',
    description: 'Acompanhe o desempenho financeiro e operacional do seu estabelecimento em um período específico.',
  },
  {
    id: 'filters',
    title: 'Como filtrar',
    description: 'Escolha um período de datas e, se quiser, filtre também por profissional, serviço ou status do agendamento. Os números abaixo se atualizam automaticamente.',
    target: '[data-guide="relatorios-filters"]',
    placement: 'bottom',
  },
  {
    id: 'export',
    title: 'Exportar dados',
    description: 'Use "Exportar CSV" pra baixar os dados filtrados e abrir no Excel ou Google Planilhas.',
  },
];

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
  'hsl(var(--destructive))',
  'hsl(var(--warning))',
  'hsl(var(--success))',
  'hsl(0 0% 60%)',
];

export default function Relatorios() {
  return (
    <FeatureGate feature="advanced_reports">
      <RelatoriosContent />
    </FeatureGate>
  );
}

function RelatoriosContent() {
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: format(subDays(new Date(), 29), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
  });

  const data = useReportData(filters);
  const guide = useInteractiveGuide('relatorios', RELATORIOS_GUIDE_STEPS);

  const handleExportCSV = () => {
    const headers = ['Métrica', 'Valor'];
    const rows = [
      ['Total Agendamentos', String(data.total)],
      ['Confirmados', String(data.confirmed)],
      ['Cancelados', String(data.canceled)],
      ['No-show', String(data.noShow)],
      ['Concluídos', String(data.completed)],
      ['Taxa Confirmação', `${data.confirmationRate}%`],
      ['Taxa Cancelamento', `${data.cancellationRate}%`],
      ['Taxa No-show', `${data.noShowRate}%`],
      ['Ticket Médio', formatCents(data.avgTicket)],
      ['Faturamento Bruto', formatCents(data.grossRevenue)],
      ['Total Recebido Online', formatCents(data.totalReceived)],
      ['Total Sinais', formatCents(data.totalDeposits)],
      ['Total Pendente', formatCents(data.totalPending)],
      ['Total Reembolsado', formatCents(data.totalRefunded)],
      ['Comissões a Pagar', formatCents(data.pendingCommissions)],
    ];
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
      <GuideOverlay guide={guide} />
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Análise de desempenho e financeiro do seu estabelecimento</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          data-guide="relatorios-filters" <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={filters.dateFrom || ''}
                onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                className="w-40"
              />
              <span className="text-muted-foreground text-sm">até</span>
              <Input
                type="date"
                value={filters.dateTo || ''}
                onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                className="w-40"
              />
            </div>
            <Select value={filters.professionalId || 'all'} onValueChange={v => setFilters(f => ({ ...f, professionalId: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Profissional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos profissionais</SelectItem>
                {data.professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.serviceId || 'all'} onValueChange={v => setFilters(f => ({ ...f, serviceId: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Serviço" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos serviços</SelectItem>
                {data.services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="confirmed">Confirmado</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
                <SelectItem value="no_show">No-show</SelectItem>
                <SelectItem value="pending_approval">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="performance">Desempenho</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
        </TabsList>

        {/* ═══════════ PERFORMANCE TAB ═══════════ */}
        <TabsContent value="performance" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Calendar} label="Total" value={String(data.total)} />
            <MetricCard icon={Target} label="Confirmados" value={String(data.confirmed)} accent="success" />
            <MetricCard icon={TrendingDown} label="Cancelados" value={String(data.canceled)} accent="destructive" />
            <MetricCard icon={UserX} label="No-show" value={String(data.noShow)} accent="warning" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={Percent} label="Taxa Confirmação" value={`${data.confirmationRate}%`} accent="success" />
            <MetricCard icon={Percent} label="Taxa Cancelamento" value={`${data.cancellationRate}%`} accent="destructive" />
            <MetricCard icon={Percent} label="Taxa No-show" value={`${data.noShowRate}%`} accent="warning" />
            <MetricCard icon={DollarSign} label="Ticket Médio" value={formatCents(data.avgTicket)} />
          </div>

          {/* Customers */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard icon={Users} label="Clientes Únicos" value={String(data.uniqueCustomers)} />
            <MetricCard icon={UserCheck} label="Novos" value={String(data.newCustomers)} accent="success" />
            <MetricCard icon={ArrowUpRight} label="Recorrentes" value={String(data.recurringCustomers)} />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Services */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Serviços mais vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                {data.topServices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</p>
                ) : (
                  <ChartContainer config={{ count: { label: 'Agendamentos', color: 'hsl(var(--primary))' } }} className="h-64">
                    <BarChart data={data.topServices.slice(0, 8)} layout="vertical">
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* By Professional */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Atendimentos por profissional</CardTitle>
              </CardHeader>
              <CardContent>
                {data.byProfessional.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</p>
                ) : (
                  <ChartContainer config={{ count: { label: 'Atendimentos', color: 'hsl(var(--primary))' } }} className="h-64">
                    <BarChart data={data.byProfessional}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Peak Hours & Weekdays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Horários mais procurados</CardTitle>
              </CardHeader>
              <CardContent>
                {data.peakHours.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
                ) : (
                  <ChartContainer config={{ count: { label: 'Agendamentos', color: 'hsl(var(--primary))' } }} className="h-56">
                    <BarChart data={data.peakHours.sort((a, b) => parseInt(a.hour) - parseInt(b.hour))}>
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Dias da semana</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={{ count: { label: 'Agendamentos', color: 'hsl(var(--primary))' } }} className="h-56">
                  <BarChart data={data.peakWeekdays}>
                    <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ranking de serviços</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Agendamentos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topServices.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right">{formatCents(s.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {data.topServices.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ FINANCIAL TAB ═══════════ */}
        <TabsContent value="financial" className="space-y-6">
          {/* Financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={DollarSign} label="Faturamento Bruto" value={formatCents(data.grossRevenue)} />
            <MetricCard icon={ArrowUpRight} label="Recebido Online" value={formatCents(data.totalReceived)} accent="success" />
            <MetricCard icon={Clock} label="Pendente" value={formatCents(data.totalPending)} accent="warning" />
            <MetricCard icon={ArrowDownRight} label="Reembolsado" value={formatCents(data.totalRefunded)} accent="destructive" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon={DollarSign} label="Total Sinais" value={formatCents(data.totalDeposits)} />
            <MetricCard icon={DollarSign} label="Pagamento Integral" value={formatCents(data.totalFullPayments)} />
            <MetricCard icon={Percent} label="Taxas MP" value={formatCents(data.totalFees)} accent="destructive" />
            <MetricCard icon={Users} label="Comissões a Pagar" value={formatCents(data.pendingCommissions)} accent="warning" />
          </div>

          {/* Revenue by professional */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento por profissional</CardTitle>
            </CardHeader>
            <CardContent>
              {data.byProfessional.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados no período</p>
              ) : (
                <ChartContainer config={{ revenue: { label: 'Faturamento', color: 'hsl(var(--primary))' } }} className="h-64">
                  <BarChart data={data.byProfessional}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `R$${(v / 100).toFixed(0)}`} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCents(Number(value))} />} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue by service table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Faturamento por serviço</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                    <TableHead className="text-right">Faturamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.revenueByService.sort((a, b) => b.revenue - a.revenue).map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right">{formatCents(s.revenue)}</TableCell>
                    </TableRow>
                  ))}
                  {data.revenueByService.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Commissions by professional */}
          {data.commissionByProf.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comissões por profissional</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Profissional</TableHead>
                      <TableHead className="text-right">Total Comissões</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.commissionByProf.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right">{formatCents(c.total)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={c.pending > 0 ? 'destructive' : 'secondary'}>
                            {formatCents(c.pending)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Payments table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transações online</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.slice(0, 50).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.paid_at ? format(new Date(p.paid_at), 'dd/MM/yy HH:mm') : '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{p.payment_type === 'deposit' ? 'Sinal' : 'Integral'}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'approved' ? 'default' : p.status === 'pending' ? 'secondary' : 'destructive'}>
                          {p.status === 'approved' ? 'Aprovado' : p.status === 'pending' ? 'Pendente' : p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCents(p.amount_cents)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCents(p.fee_cents)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCents(p.net_amount_cents)}</TableCell>
                    </TableRow>
                  ))}
                  {data.payments.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma transação online no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Metric Card Component ─────────────────────────
function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  accent?: 'success' | 'destructive' | 'warning';
}) {
  const accentClass = accent === 'success'
    ? 'text-green-600'
    : accent === 'destructive'
    ? 'text-destructive'
    : accent === 'warning'
    ? 'text-amber-600'
    : 'text-foreground';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className={`text-xl font-bold ${accentClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
