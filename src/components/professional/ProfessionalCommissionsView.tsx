import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, CheckCircle2, Clock, History, FileText, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface ProfessionalCommissionsViewProps {
  token: string;
}

// ── Settlement Detail Dialog ───────────────────────────

function PortalSettlementDetail({ token, settlementId, onClose }: { token: string; settlementId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['professional-settlement-detail', token, settlementId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_professional_settlement_detail', {
        p_token: token,
        p_settlement_id: settlementId,
      });
      if (error) throw error;
      return data as { success: boolean; settlement: any; entries: any[]; error?: string };
    },
    enabled: !!token && !!settlementId,
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Repasse</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-40" /></div>
        ) : !data?.success ? (
          <p className="text-sm text-muted-foreground text-center py-4">{data?.error || 'Erro ao carregar detalhes'}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="font-semibold text-sm">
                  {format(new Date(data.settlement.period_start), 'dd/MM/yy')} – {format(new Date(data.settlement.period_end), 'dd/MM/yy')}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="font-bold text-primary text-lg">{formatCents(data.settlement.total_amount_cents)}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Data do repasse</p>
                <p className="font-semibold text-sm">
                  {data.settlement.paid_at ? format(new Date(data.settlement.paid_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—'}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Atendimentos</p>
                <p className="font-semibold">{data.settlement.entries_count}</p>
              </div>
            </div>

            {data.settlement.notes && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Observação</p>
                <p className="text-sm">{data.settlement.notes}</p>
              </div>
            )}

            <Separator />

            <p className="text-sm font-medium">Atendimentos incluídos ({data.entries.length})</p>

            {data.entries.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Data</TableHead>
                      <TableHead className="text-xs">Serviço</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Cliente</TableHead>
                      <TableHead className="text-xs text-right">Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entries.map((e: any) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs py-2">{format(new Date(e.appointment_date), 'dd/MM HH:mm')}</TableCell>
                        <TableCell className="text-xs py-2">{e.service_name}</TableCell>
                        <TableCell className="text-xs py-2 hidden sm:table-cell">{e.customer_name || '—'}</TableCell>
                        <TableCell className="text-xs py-2 text-right font-medium">{formatCents(e.commission_amount_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Detalhes indisponíveis.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Component ─────────────────────────────────────

export function ProfessionalCommissionsView({ token }: ProfessionalCommissionsViewProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);

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
            <p className="text-lg font-bold">{formatCents(totals.total_settled)}</p>
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
          <TabsTrigger value="entries" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Comissões
          </TabsTrigger>
          <TabsTrigger value="settlements" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Repasses recebidos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entries" className="mt-4">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhuma comissão no período</p>
                <p className="text-sm mt-1">As comissões aparecem após a conclusão dos atendimentos.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Valor serviço</TableHead>
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
                      <TableCell className="hidden sm:table-cell">{e.customer_name || '—'}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{formatCents(e.service_price_cents)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCents(e.commission_amount_cents)}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({e.commission_type === 'percentage' ? `${e.commission_value}%` : 'fixo'})
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === 'settled' ? 'default' : e.status === 'voided' ? 'destructive' : 'secondary'}>
                          {e.status === 'pending' ? 'Pendente' : e.status === 'settled' ? 'Pago' : 'Anulado'}
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
                <p className="font-medium">Nenhum repasse recebido ainda</p>
                <p className="text-sm mt-1">Os repasses aparecerão aqui quando o estabelecimento registrar pagamentos.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Atend.</TableHead>
                    <TableHead>Data do repasse</TableHead>
                    <TableHead className="hidden sm:table-cell">Observação</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/70" onClick={() => setSelectedSettlementId(s.id)}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(s.period_start), 'dd/MM/yy')} – {format(new Date(s.period_end), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCents(s.total_amount_cents)}</TableCell>
                      <TableCell className="text-center">{s.entries_count}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {s.paid_at ? format(new Date(s.paid_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[200px] truncate text-sm text-muted-foreground">
                        {s.notes || '—'}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {selectedSettlementId && (
        <PortalSettlementDetail
          token={token}
          settlementId={selectedSettlementId}
          onClose={() => setSelectedSettlementId(null)}
        />
      )}
    </div>
  );
}
