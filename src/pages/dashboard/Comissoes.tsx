import { useState, useMemo } from 'react';
import { FeatureGate } from '@/components/dashboard/FeatureGate';
import { useCommissionRules, useCommissionEntries, useUpsertCommissionRule, useDeleteCommissionRule, useCreateSettlement, useCommissionSettlements, aggregateByProfessional, type CommissionFilters, type CommissionEntry, type CommissionSettlement } from '@/hooks/useCommissions';
import { useManageProfessionals } from '@/hooks/useManageProfessionals';
import { useServices } from '@/hooks/useServices';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { MoneyInput } from '@/components/ui/money-input';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  DollarSign, Users, TrendingUp, Calculator, Plus, Trash2,
  Search, Download, CheckCircle2, History, BarChart3,
  Wallet, Clock, ArrowUpRight, ChevronDown, ChevronUp,
  FileText, Award,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ── Rule Form Dialog ───────────────────────────────────

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  professionals: any[];
  services: any[];
  editRule?: any;
  establishmentId: string;
}

function RuleFormDialog({ open, onClose, professionals, services, editRule, establishmentId }: RuleFormProps) {
  const upsert = useUpsertCommissionRule();
  const [professionalId, setProfessionalId] = useState(editRule?.professional_id || '');
  const [serviceId, setServiceId] = useState(editRule?.service_id || 'default');
  const [commissionType, setCommissionType] = useState(editRule?.commission_type || 'percentage');
  const [commissionValue, setCommissionValue] = useState(String(editRule?.commission_value || ''));
  const [active, setActive] = useState(editRule?.active ?? true);

  const handleSubmit = async () => {
    if (!professionalId) {
      toast.error('Selecione um profissional');
      throw new Error('validation');
    }
    const val = parseFloat(commissionValue);
    if (isNaN(val) || val < 0) {
      toast.error('Valor inválido');
      throw new Error('validation');
    }
    if (commissionType === 'percentage' && val > 100) {
      toast.error('Percentual não pode ser maior que 100%');
      throw new Error('validation');
    }

    try {
      await upsert.mutateAsync({
        id: editRule?.id,
        professional_id: professionalId,
        service_id: serviceId === 'default' ? null : serviceId,
        commission_type: commissionType,
        commission_value: val,
        is_default: serviceId === 'default',
        active,
        effective_from: new Date().toISOString(),
      });
      toast.success(editRule ? 'Regra atualizada' : 'Regra criada');
      onClose();
    } catch (err: any) {
      if (err?.message !== 'validation') {
        toast.error(err.message || 'Erro ao salvar regra');
      }
      throw err;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editRule ? 'Editar Regra' : 'Nova Regra de Comissão'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Profissional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {professionals.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Serviço</Label>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Regra padrão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Regra padrão (todos os serviços)</SelectItem>
                {services.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={commissionType} onValueChange={setCommissionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{commissionType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
              <MoneyInput
                mode={commissionType === 'percentage' ? 'percentage' : 'currency'}
                value={commissionValue ? parseFloat(commissionValue) : null}
                onChange={(val) => setCommissionValue(val !== null ? String(val) : '')}
                placeholder={commissionType === 'percentage' ? 'Ex: 40' : 'Ex: 15,00'}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Regra ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <ActionButton onClick={handleSubmit} loadingLabel="Salvando..." successLabel="Salvo!">
            Salvar
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Settlement Dialog ──────────────────────────────────

interface SettlementDialogProps {
  open: boolean;
  onClose: () => void;
  entries: CommissionEntry[];
  professionalName: string;
  professionalId: string;
}

function SettlementDialog({ open, onClose, entries, professionalName, professionalId }: SettlementDialogProps) {
  const create = useCreateSettlement();
  const [notes, setNotes] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [showEntries, setShowEntries] = useState(false);

  const pendingEntries = useMemo(() => {
    let filtered = entries.filter((e) => e.status === 'pending');
    if (periodStart) {
      filtered = filtered.filter((e) => e.appointment_date >= periodStart);
    }
    if (periodEnd) {
      filtered = filtered.filter((e) => e.appointment_date <= periodEnd + 'T23:59:59');
    }
    return filtered.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
  }, [entries, periodStart, periodEnd]);

  const total = pendingEntries.reduce((s, e) => s + e.commission_amount_cents, 0);
  const totalRevenue = pendingEntries.reduce((s, e) => s + e.service_price_cents, 0);

  const handleSettle = async () => {
    if (!pendingEntries.length) {
      toast.error('Nenhuma comissão pendente no período selecionado');
      throw new Error('no entries');
    }
    const dates = pendingEntries.map((e) => new Date(e.appointment_date));
    const pStart = periodStart || format(new Date(Math.min(...dates.map((d) => d.getTime()))), 'yyyy-MM-dd');
    const pEnd = periodEnd || format(new Date(Math.max(...dates.map((d) => d.getTime()))), 'yyyy-MM-dd');

    try {
      await create.mutateAsync({
        professionalId,
        periodStart: pStart,
        periodEnd: pEnd,
        entryIds: pendingEntries.map((e) => e.id),
        notes: notes.trim() || undefined,
      });
      toast.success('Repasse registrado com sucesso');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar repasse');
      throw err;
    }
  };

  const setPreset = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case 'today':
        setPeriodStart(format(now, 'yyyy-MM-dd'));
        setPeriodEnd(format(now, 'yyyy-MM-dd'));
        break;
      case 'week':
        setPeriodStart(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        setPeriodEnd(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
        break;
      case 'month':
        setPeriodStart(format(startOfMonth(now), 'yyyy-MM-dd'));
        setPeriodEnd(format(endOfMonth(now), 'yyyy-MM-dd'));
        break;
      case 'last_month':
        const lm = subMonths(now, 1);
        setPeriodStart(format(startOfMonth(lm), 'yyyy-MM-dd'));
        setPeriodEnd(format(endOfMonth(lm), 'yyyy-MM-dd'));
        break;
      case 'all':
        setPeriodStart('');
        setPeriodEnd('');
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Repasse — {professionalName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Period presets */}
          <div className="space-y-2">
            <Label>Período do repasse</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'Hoje' },
                { key: 'week', label: 'Esta semana' },
                { key: 'month', label: 'Este mês' },
                { key: 'last_month', label: 'Mês passado' },
                { key: 'all', label: 'Todos pendentes' },
              ].map((p) => (
                <Button key={p.key} variant="outline" size="sm" type="button" onClick={() => setPreset(p.key)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">De</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Atendimentos</p>
                <p className="text-lg font-bold">{pendingEntries.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Receita</p>
                <p className="text-lg font-bold">{formatCents(totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Total a pagar</p>
                <p className="text-lg font-bold text-primary">{formatCents(total)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Preview entries toggle */}
          {pendingEntries.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowEntries(!showEntries)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showEntries ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showEntries ? 'Ocultar' : 'Ver'} atendimentos incluídos ({pendingEntries.length})
              </button>
              {showEntries && (
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Serviço</TableHead>
                        <TableHead className="text-xs text-right">Comissão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs py-1.5">
                            {format(new Date(e.appointment_date), 'dd/MM HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs py-1.5">{e.service_name}</TableCell>
                          <TableCell className="text-xs py-1.5 text-right font-medium">
                            {formatCents(e.commission_amount_cents)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Pagamento via Pix" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <ActionButton onClick={handleSettle} disabled={!pendingEntries.length} loadingLabel="Registrando..." successLabel="Repasse registrado!">
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Confirmar repasse
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Settlement Detail Dialog ───────────────────────────

function SettlementDetailDialog({
  open,
  onClose,
  settlement,
  entries,
  professionalName,
}: {
  open: boolean;
  onClose: () => void;
  settlement: CommissionSettlement;
  entries: CommissionEntry[];
  professionalName: string;
}) {
  const settlementEntries = useMemo(
    () => entries.filter((e) => e.settlement_id === settlement.id).sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()),
    [entries, settlement.id]
  );

  const handleExport = () => {
    const headers = ['Data', 'Serviço', 'Cliente', 'Valor Serviço', 'Comissão', 'Tipo'];
    const rows = settlementEntries.map((e) => [
      format(new Date(e.appointment_date), 'dd/MM/yyyy HH:mm'),
      e.service_name,
      e.customer_name || '',
      (e.service_price_cents / 100).toFixed(2),
      (e.commission_amount_cents / 100).toFixed(2),
      e.commission_type === 'percentage' ? `${e.commission_value}%` : `R$ ${e.commission_value}`,
    ]);
    downloadCSV([headers, ...rows], `repasse-${professionalName}-${format(new Date(settlement.paid_at || settlement.created_at), 'yyyy-MM-dd')}.csv`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Repasse</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Profissional</p>
              <p className="font-semibold">{professionalName}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Período</p>
              <p className="font-semibold text-sm">
                {format(new Date(settlement.period_start), 'dd/MM/yy')} – {format(new Date(settlement.period_end), 'dd/MM/yy')}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs text-muted-foreground">Valor total</p>
              <p className="font-bold text-primary text-lg">{formatCents(settlement.total_amount_cents)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Data do repasse</p>
              <p className="font-semibold text-sm">
                {settlement.paid_at ? format(new Date(settlement.paid_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : '—'}
              </p>
            </div>
          </div>

          {settlement.notes && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">Observação</p>
              <p className="text-sm">{settlement.notes}</p>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Atendimentos incluídos ({settlementEntries.length})</p>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!settlementEntries.length}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              CSV
            </Button>
          </div>

          {settlementEntries.length > 0 ? (
            <div className="border rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Serviço</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Cliente</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlementEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs py-2">{format(new Date(e.appointment_date), 'dd/MM HH:mm')}</TableCell>
                      <TableCell className="text-xs py-2">{e.service_name}</TableCell>
                      <TableCell className="text-xs py-2 hidden sm:table-cell">{e.customer_name || '—'}</TableCell>
                      <TableCell className="text-xs py-2 text-right">{formatCents(e.service_price_cents)}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-medium">{formatCents(e.commission_amount_cents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Detalhes dos atendimentos indisponíveis para repasses antigos.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Settlement History ─────────────────────────────────

function SettlementHistoryTab({
  settlements,
  professionals,
  entries,
  isLoading,
}: {
  settlements: CommissionSettlement[];
  professionals: any[];
  entries: CommissionEntry[];
  isLoading: boolean;
}) {
  const [filterProfessional, setFilterProfessional] = useState('all');
  const [selectedSettlement, setSelectedSettlement] = useState<CommissionSettlement | null>(null);

  const filtered = useMemo(() => {
    if (filterProfessional === 'all') return settlements;
    return settlements.filter((s) => s.professional_id === filterProfessional);
  }, [settlements, filterProfessional]);

  const handleExportSettlements = () => {
    if (!filtered.length) return;
    const headers = ['Profissional', 'Período Início', 'Período Fim', 'Valor Total', 'Atendimentos', 'Data Repasse', 'Observação'];
    const rows = filtered.map((s) => {
      const prof = professionals.find((p: any) => p.id === s.professional_id);
      return [
        prof?.name || '',
        format(new Date(s.period_start), 'dd/MM/yyyy'),
        format(new Date(s.period_end), 'dd/MM/yyyy'),
        (s.total_amount_cents / 100).toFixed(2),
        String(s.entries_count),
        s.paid_at ? format(new Date(s.paid_at), 'dd/MM/yyyy HH:mm') : '',
        s.notes || '',
      ];
    });
    downloadCSV([headers, ...rows], `repasses-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <p className="text-sm text-muted-foreground">Clique em um repasse para ver os atendimentos incluídos.</p>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterProfessional} onValueChange={setFilterProfessional}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Profissional" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos profissionais</SelectItem>
              {professionals.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportSettlements} disabled={!filtered.length}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum repasse registrado</p>
            <p className="text-sm mt-1">Os repasses aparecerão aqui após serem registrados na aba "Resumo por Profissional".</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Atend.</TableHead>
                <TableHead>Data do repasse</TableHead>
                <TableHead className="hidden sm:table-cell">Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const prof = professionals.find((p: any) => p.id === s.professional_id);
                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/70" onClick={() => setSelectedSettlement(s)}>
                    <TableCell className="font-medium">{prof?.name || '—'}</TableCell>
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {selectedSettlement && (
        <SettlementDetailDialog
          open={!!selectedSettlement}
          onClose={() => setSelectedSettlement(null)}
          settlement={selectedSettlement}
          entries={entries}
          professionalName={professionals.find((p: any) => p.id === selectedSettlement.professional_id)?.name || '—'}
        />
      )}
    </div>
  );
}

// ── CSV Helper ─────────────────────────────────────────

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── KPI Card Component ─────────────────────────────────

function KpiCard({ icon: Icon, label, value, subValue, color, bgColor }: {
  icon: any; label: string; value: string; subValue?: string; color: string; bgColor: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn('p-2 rounded-lg shrink-0', bgColor)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight truncate">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {subValue && <p className="text-[10px] text-muted-foreground">{subValue}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Top Ranking Component ──────────────────────────────

function TopRanking({ title, items, maxValue }: {
  title: string;
  items: { name: string; value: number; count: number }[];
  maxValue: number;
}) {
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Award className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 5).map((item, i) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 truncate">
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  i === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {i + 1}
                </span>
                <span className="truncate">{item.name}</span>
              </span>
              <span className="font-semibold whitespace-nowrap ml-2">{formatCents(item.value)}</span>
            </div>
            <Progress value={maxValue > 0 ? (item.value / maxValue) * 100 : 0} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">{item.count} atendimento{item.count !== 1 ? 's' : ''}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function Comissoes() {
  return (
    <FeatureGate feature="commissions">
      <ComissoesContent />
    </FeatureGate>
  );
}

function ComissoesContent() {
  const { data: establishment } = useUserEstablishment();
  const { professionals } = useManageProfessionals(establishment?.id);
  const { data: services = [] } = useServices(establishment?.id);
  const { data: rules = [], isLoading: rulesLoading } = useCommissionRules();
  const { data: settlements = [], isLoading: settlementsLoading } = useCommissionSettlements();

  // Filters
  const [filters, setFilters] = useState<CommissionFilters>({});
  const { data: entries = [], isLoading: entriesLoading } = useCommissionEntries(filters);

  // Dialogs
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [settlementDialog, setSettlementDialog] = useState<{ open: boolean; professionalId: string; professionalName: string }>({ open: false, professionalId: '', professionalName: '' });
  const [expandedProfessional, setExpandedProfessional] = useState<string | null>(null);

  const deleteRule = useDeleteCommissionRule();

  // Aggregated data
  const summary = useMemo(() => aggregateByProfessional(entries), [entries]);
  // Revenue metrics: only count non-voided entries (completed appointments only)
  const activeEntries = useMemo(() => entries.filter((e) => e.status !== 'voided'), [entries]);
  const totalCommission = activeEntries.reduce((s, e) => s + e.commission_amount_cents, 0);
  const totalRevenue = activeEntries.reduce((s, e) => s + e.service_price_cents, 0);
  const pendingTotal = activeEntries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.commission_amount_cents, 0);
  const settledTotal = activeEntries.filter((e) => e.status === 'settled').reduce((s, e) => s + e.commission_amount_cents, 0);
  const avgTicket = activeEntries.length ? Math.round(totalRevenue / activeEntries.length) : 0;

  // Rankings
  const topProfessionals = useMemo(() => {
    return summary
      .map((s) => ({ name: s.professionalName, value: s.totalCommission, count: s.count }))
      .sort((a, b) => b.value - a.value);
  }, [summary]);

  const topServices = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();
    for (const e of entries) {
      const existing = map.get(e.service_name) || { name: e.service_name, value: 0, count: 0 };
      existing.value += e.commission_amount_cents;
      existing.count += 1;
      map.set(e.service_name, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }, [entries]);

  // CSV exports
  const handleExportEntries = () => {
    if (!entries.length) return;
    const headers = ['Data', 'Profissional', 'Serviço', 'Cliente', 'Valor Serviço', 'Comissão', 'Tipo', 'Status'];
    const rows = entries.map((e) => [
      format(new Date(e.appointment_date), 'dd/MM/yyyy HH:mm'),
      e.professional_name,
      e.service_name,
      e.customer_name || '',
      (e.service_price_cents / 100).toFixed(2),
      (e.commission_amount_cents / 100).toFixed(2),
      e.commission_type === 'percentage' ? `${e.commission_value}%` : `R$ ${e.commission_value}`,
      e.status === 'pending' ? 'Pendente' : e.status === 'settled' ? 'Pago' : 'Anulado',
    ]);
    downloadCSV([headers, ...rows], `comissoes-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const handleExportSummary = () => {
    if (!summary.length) return;
    const headers = ['Profissional', 'Atendimentos', 'Receita Bruta', 'Comissão Total', 'Pendente', 'Repassado', 'Ticket Médio'];
    const rows = summary.map((s) => {
      const pendingAmt = entries
        .filter((e) => e.professional_id === s.professionalId && e.status === 'pending')
        .reduce((sum, e) => sum + e.commission_amount_cents, 0);
      const settledAmt = entries
        .filter((e) => e.professional_id === s.professionalId && e.status === 'settled')
        .reduce((sum, e) => sum + e.commission_amount_cents, 0);
      return [
        s.professionalName,
        String(s.count),
        (s.totalRevenue / 100).toFixed(2),
        (s.totalCommission / 100).toFixed(2),
        (pendingAmt / 100).toFixed(2),
        (settledAmt / 100).toFixed(2),
        s.count ? (s.totalRevenue / s.count / 100).toFixed(2) : '0',
      ];
    });
    downloadCSV([headers, ...rows], `resumo-profissionais-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comissões</h1>
          <p className="text-muted-foreground text-sm">Gestão de comissões, repasses e controle financeiro</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportEntries} variant="outline" size="sm" disabled={!entries.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* ── KPI Dashboard ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={DollarSign} label="Receita Total" value={formatCents(totalRevenue)} color="text-emerald-600" bgColor="bg-emerald-50" />
        <KpiCard icon={Calculator} label="Comissão Total" value={formatCents(totalCommission)} color="text-violet-600" bgColor="bg-violet-50" />
        <KpiCard icon={Clock} label="Pendente" value={formatCents(pendingTotal)} color="text-orange-600" bgColor="bg-orange-50" />
        <KpiCard icon={Wallet} label="Já Repassado" value={formatCents(settledTotal)} color="text-teal-600" bgColor="bg-teal-50" />
        <KpiCard icon={BarChart3} label="Ticket Médio" value={formatCents(avgTicket)} color="text-indigo-600" bgColor="bg-indigo-50" />
        <KpiCard icon={Users} label="Atendimentos" value={String(entries.length)} color="text-blue-600" bgColor="bg-blue-50" />
      </div>

      {/* ── Rankings ────────────────────────────────────── */}
      {(topProfessionals.length > 0 || topServices.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TopRanking
            title="Profissionais — Maior Comissão"
            items={topProfessionals}
            maxValue={topProfessionals[0]?.value || 0}
          />
          <TopRanking
            title="Serviços — Maior Comissão"
            items={topServices}
            maxValue={topServices[0]?.value || 0}
          />
        </div>
      )}

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="entries" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Comissões
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Calculator className="h-3.5 w-3.5" />
            Regras
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Por Profissional
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Repasses
          </TabsTrigger>
        </TabsList>

        {/* ── Entries Tab ─────────────────────────────────── */}
        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar cliente, profissional ou serviço..."
                    className="pl-9"
                    value={filters.search || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                  />
                </div>
                <Select value={filters.professionalId || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, professionalId: v === 'all' ? undefined : v }))}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Profissional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {professionals.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.serviceId || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, serviceId: v === 'all' ? undefined : v }))}>
                  <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Serviço" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {services.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
                  <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="settled">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 mt-3">
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1 flex-1">
                  <Label className="text-xs text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          {entriesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="font-medium text-lg">Nenhuma comissão encontrada</p>
                <p className="text-sm mt-1">As comissões são geradas automaticamente quando atendimentos são concluídos.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="hidden sm:table-cell">Serviço</TableHead>
                    <TableHead className="hidden md:table-cell">Cliente</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Valor</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(entry.appointment_date), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">{entry.professional_name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{entry.service_name}</TableCell>
                      <TableCell className="hidden md:table-cell">{entry.customer_name || '—'}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{formatCents(entry.service_price_cents)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCents(entry.commission_amount_cents)}
                        <span className="text-[10px] text-muted-foreground ml-1">
                          ({entry.commission_type === 'percentage' ? `${entry.commission_value}%` : 'fixo'})
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.status === 'settled' ? 'default' : entry.status === 'pending' ? 'secondary' : 'destructive'}>
                          {entry.status === 'pending' ? 'Pendente' : entry.status === 'settled' ? 'Pago' : 'Anulado'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Rules Tab ───────────────────────────────────── */}
        <TabsContent value="rules" className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Configure as regras de comissão por profissional e serviço.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Regras específicas por serviço têm prioridade sobre a regra padrão.</p>
            </div>
            <Button size="sm" onClick={() => { setEditingRule(null); setRuleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova regra
            </Button>
          </div>

          {rulesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Calculator className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="font-medium text-lg">Nenhuma regra configurada</p>
                <p className="text-sm mt-1">Crie regras para calcular comissões automaticamente ao concluir atendimentos.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Vigência</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const prof = professionals.find((p: any) => p.id === rule.professional_id);
                    const serv = services.find((s: any) => s.id === rule.service_id);
                    return (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{prof?.name || '—'}</TableCell>
                        <TableCell>{rule.is_default ? <Badge variant="outline">Padrão</Badge> : serv?.name || '—'}</TableCell>
                        <TableCell>{rule.commission_type === 'percentage' ? 'Percentual' : 'Fixo'}</TableCell>
                        <TableCell className="font-semibold">
                          {rule.commission_type === 'percentage' ? `${rule.commission_value}%` : `R$ ${Number(rule.commission_value).toFixed(2)}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.active ? 'default' : 'secondary'}>
                            {rule.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {format(new Date(rule.effective_from), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => { setEditingRule(rule); setRuleDialogOpen(true); }}>
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                try {
                                  await deleteRule.mutateAsync(rule.id);
                                  toast.success('Regra excluída');
                                } catch {
                                  toast.error('Erro ao excluir regra');
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ── Summary Tab ─────────────────────────────────── */}
        <TabsContent value="summary" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Visão consolidada por profissional com ações de repasse.</p>
            <Button variant="outline" size="sm" onClick={handleExportSummary} disabled={!summary.length}>
              <Download className="h-4 w-4 mr-2" />
              Exportar resumo
            </Button>
          </div>

          {summary.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-40" />
                <p className="font-medium text-lg">Nenhum dado de comissão</p>
                <p className="text-sm mt-1">As comissões serão exibidas aqui após a conclusão de atendimentos.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {summary.map((s) => {
                const isExpanded = expandedProfessional === s.professionalId;
                const profEntries = entries.filter((e) => e.professional_id === s.professionalId);
                const lastSettlement = settlements
                  .filter((st) => st.professional_id === s.professionalId)
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

                return (
                  <Card key={s.professionalId} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {s.professionalName.charAt(0)}
                          </div>
                          <div>
                            <CardTitle className="text-lg">{s.professionalName}</CardTitle>
                            <CardDescription>{s.count} atendimento{s.count !== 1 ? 's' : ''}</CardDescription>
                          </div>
                        </div>
                        {s.pendingCount > 0 && (
                          <Button
                            size="sm"
                            onClick={() => setSettlementDialog({ open: true, professionalId: s.professionalId, professionalName: s.professionalName })}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Registrar repasse ({s.pendingCount})
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Receita bruta</p>
                          <p className="text-base font-semibold">{formatCents(s.totalRevenue)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Comissão total</p>
                          <p className="text-base font-semibold">{formatCents(s.totalCommission)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-orange-50">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Pendente</p>
                          <p className="text-base font-semibold text-orange-600">{formatCents(pendingAmt)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-teal-50">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Repassado</p>
                          <p className="text-base font-semibold text-teal-600">{formatCents(settledAmt)}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Ticket médio</p>
                          <p className="text-base font-semibold">{s.count ? formatCents(Math.round(s.totalRevenue / s.count)) : '—'}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Atendimentos</p>
                          <p className="text-base font-semibold">{s.count}</p>
                        </div>
                      </div>

                      {/* Expandable detail */}
                      <button
                        type="button"
                        onClick={() => setExpandedProfessional(isExpanded ? null : s.professionalId)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? 'Ocultar' : 'Ver'} detalhamento ({profEntries.length})
                      </button>

                      {isExpanded && (
                        <div className="border rounded-lg overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Data</TableHead>
                                <TableHead className="text-xs">Serviço</TableHead>
                                <TableHead className="text-xs hidden sm:table-cell">Cliente</TableHead>
                                <TableHead className="text-xs text-right">Valor</TableHead>
                                <TableHead className="text-xs text-right">Comissão</TableHead>
                                <TableHead className="text-xs">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {profEntries.map((e) => (
                                <TableRow key={e.id}>
                                  <TableCell className="text-xs py-2">
                                    {format(new Date(e.appointment_date), 'dd/MM HH:mm')}
                                  </TableCell>
                                  <TableCell className="text-xs py-2">{e.service_name}</TableCell>
                                  <TableCell className="text-xs py-2 hidden sm:table-cell">{e.customer_name || '—'}</TableCell>
                                  <TableCell className="text-xs py-2 text-right">{formatCents(e.service_price_cents)}</TableCell>
                                  <TableCell className="text-xs py-2 text-right font-medium">{formatCents(e.commission_amount_cents)}</TableCell>
                                  <TableCell className="py-2">
                                    <Badge variant={e.status === 'settled' ? 'default' : 'secondary'} className="text-[10px]">
                                      {e.status === 'pending' ? 'Pendente' : 'Pago'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── History Tab ─────────────────────────────────── */}
        <TabsContent value="history" className="space-y-4">
          <SettlementHistoryTab
            settlements={settlements}
            professionals={professionals}
            entries={entries}
            isLoading={settlementsLoading}
          />
        </TabsContent>
      </Tabs>

      {/* Rule Dialog */}
      {ruleDialogOpen && (
        <RuleFormDialog
          open={ruleDialogOpen}
          onClose={() => { setRuleDialogOpen(false); setEditingRule(null); }}
          professionals={professionals}
          services={services}
          editRule={editingRule}
          establishmentId={establishment?.id || ''}
        />
      )}

      {/* Settlement Dialog */}
      {settlementDialog.open && (
        <SettlementDialog
          open={settlementDialog.open}
          onClose={() => setSettlementDialog({ open: false, professionalId: '', professionalName: '' })}
          entries={entries.filter((e) => e.professional_id === settlementDialog.professionalId)}
          professionalName={settlementDialog.professionalName}
          professionalId={settlementDialog.professionalId}
        />
      )}
    </div>
  );
}
