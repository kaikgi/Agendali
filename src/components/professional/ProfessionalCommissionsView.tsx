import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, CheckCircle2, Clock, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProfessionalCommissionsViewProps {
  token: string;
}

export function ProfessionalCommissionsView({ token }: ProfessionalCommissionsViewProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['professional-portal-commissions', token, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_professional_commissions', {
        p_token: token,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      });
      if (error) throw error;
      return data as {
        success: boolean;
        entries: any[];
        settlements: any[];
        totals: { total_earned: number; total_pending: number; total_settled: number; total_count: number };
        error?: string;
      };
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  if (!data?.success) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <p>Não foi possível carregar as comissões.</p>
        </CardContent>
      </Card>
    );
  }

  const { entries, settlements, totals } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Total ganho
            </div>
            <p className="text-lg font-bold">{formatCents(totals.total_earned)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Clock className="h-3.5 w-3.5" />
              Pendente
            </div>
            <p className="text-lg font-bold text-destructive">{formatCents(totals.total_pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Já recebido
            </div>
            <p className="text-lg font-bold text-green-600">{formatCents(totals.total_settled)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Atendimentos
            </div>
            <p className="text-lg font-bold">{totals.total_count}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="space-y-1">
          <Label className="text-xs">De</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Até</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-40" />
        </div>
      </div>

      <Tabs defaultValue="entries">
        <TabsList>
          <TabsTrigger value="entries">Comissões</TabsTrigger>
          <TabsTrigger value="settlements">Repasses recebidos</TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma comissão no período</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor serviço</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(e.appointment_date), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{e.service_name}</TableCell>
                      <TableCell>{e.customer_name || '—'}</TableCell>
                      <TableCell className="text-right">{formatCents(e.service_price_cents)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCents(e.commission_amount_cents)}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({e.commission_type === 'percentage' ? `${e.commission_value}%` : 'fixo'})
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'settled' ? 'default' : 'secondary'}>
                          {e.status === 'pending' ? 'Pendente' : 'Pago'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settlements" className="mt-4">
          {settlements.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum repasse recebido ainda</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Atendimentos</TableHead>
                    <TableHead>Data do repasse</TableHead>
                    <TableHead>Observação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(s.period_start), 'dd/MM/yy')} – {format(new Date(s.period_end), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCents(s.total_amount_cents)}</TableCell>
                      <TableCell className="text-center">{s.entries_count}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {s.paid_at ? format(new Date(s.paid_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {s.notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
