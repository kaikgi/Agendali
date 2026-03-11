import { useState, useMemo } from 'react';
import { FeatureGate } from '@/components/dashboard/FeatureGate';
import { useCommissionRules, useCommissionEntries, useUpsertCommissionRule, useDeleteCommissionRule, useCreateSettlement, aggregateByProfessional, type CommissionFilters, type CommissionEntry } from '@/hooks/useCommissions';
import { useManageProfessionals } from '@/hooks/useManageProfessionals';
import { useServices } from '@/hooks/useServices';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';
import { DollarSign, Users, TrendingUp, Calculator, Plus, Trash2, Lock, Search, Download, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
      return;
    }
    const val = parseFloat(commissionValue);
    if (isNaN(val) || val < 0) {
      toast.error('Valor inválido');
      return;
    }
    if (commissionType === 'percentage' && val > 100) {
      toast.error('Percentual não pode ser maior que 100%');
      return;
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
      toast.error(err.message || 'Erro ao salvar regra');
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
              <Input
                type="number"
                step={commissionType === 'percentage' ? '1' : '0.01'}
                min="0"
                max={commissionType === 'percentage' ? '100' : undefined}
                value={commissionValue}
                onChange={(e) => setCommissionValue(e.target.value)}
                placeholder={commissionType === 'percentage' ? 'Ex: 40' : 'Ex: 15.00'}
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
          <Button onClick={handleSubmit} disabled={upsert.isPending}>
            {upsert.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
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

  const pendingEntries = entries.filter((e) => e.status === 'pending');
  const total = pendingEntries.reduce((s, e) => s + e.commission_amount_cents, 0);

  const dates = pendingEntries.map((e) => new Date(e.appointment_date));
  const periodStart = dates.length ? format(new Date(Math.min(...dates.map((d) => d.getTime()))), 'yyyy-MM-dd') : '';
  const periodEnd = dates.length ? format(new Date(Math.max(...dates.map((d) => d.getTime()))), 'yyyy-MM-dd') : '';

  const handleSettle = async () => {
    if (!pendingEntries.length) return;
    try {
      await create.mutateAsync({
        professionalId,
        periodStart,
        periodEnd,
        entryIds: pendingEntries.map((e) => e.id),
        notes: notes.trim() || undefined,
      });
      toast.success('Repasse registrado com sucesso');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar repasse');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Repasse — {professionalName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Atendimentos</p>
                <p className="text-2xl font-bold">{pendingEntries.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Total a pagar</p>
                <p className="text-2xl font-bold text-primary">{formatCents(total)}</p>
              </CardContent>
            </Card>
          </div>
          {periodStart && (
            <p className="text-sm text-muted-foreground">
              Período: {format(new Date(periodStart), 'dd/MM/yyyy')} a {format(new Date(periodEnd), 'dd/MM/yyyy')}
            </p>
          )}
          <div className="space-y-2">
            <Label>Observações (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: Pagamento via Pix" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSettle} disabled={create.isPending || !pendingEntries.length}>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            {create.isPending ? 'Registrando...' : 'Confirmar repasse'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────

export default function Comissoes() {
  const { hasAccess, isLoading: planLoading, planLabel } = useHasCommissions();
  const { data: establishment } = useUserEstablishment();
  const { professionals } = useManageProfessionals(establishment?.id);
  const { data: services = [] } = useServices(establishment?.id);
  const { data: rules = [], isLoading: rulesLoading } = useCommissionRules();

  // Filters
  const [filters, setFilters] = useState<CommissionFilters>({});
  const { data: entries = [], isLoading: entriesLoading } = useCommissionEntries(filters);

  // Dialogs
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [settlementDialog, setSettlementDialog] = useState<{ open: boolean; professionalId: string; professionalName: string }>({ open: false, professionalId: '', professionalName: '' });

  const deleteRule = useDeleteCommissionRule();

  // Summary
  const summary = useMemo(() => aggregateByProfessional(entries), [entries]);
  const totalCommission = entries.reduce((s, e) => s + e.commission_amount_cents, 0);
  const totalRevenue = entries.reduce((s, e) => s + e.service_price_cents, 0);
  const pendingTotal = entries.filter((e) => e.status === 'pending').reduce((s, e) => s + e.commission_amount_cents, 0);
  const avgTicket = entries.length ? Math.round(totalRevenue / entries.length) : 0;

  // CSV export
  const handleExportCSV = () => {
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
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (planLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <CommissionsLockedState planLabel={planLabel} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Comissões</h1>
          <p className="text-muted-foreground text-sm">Gerencie comissões e repasses dos profissionais</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" size="sm" disabled={!entries.length}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Receita Total
            </div>
            <p className="text-xl font-bold">{formatCents(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calculator className="h-4 w-4" />
              Comissões Total
            </div>
            <p className="text-xl font-bold">{formatCents(totalCommission)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="h-4 w-4" />
              Pendente
            </div>
            <p className="text-xl font-bold text-destructive">{formatCents(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="h-4 w-4" />
              Ticket Médio
            </div>
            <p className="text-xl font-bold">{formatCents(avgTicket)}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Comissões</TabsTrigger>
          <TabsTrigger value="rules">Regras</TabsTrigger>
          <TabsTrigger value="summary">Resumo por Profissional</TabsTrigger>
        </TabsList>

        {/* ── Entries Tab ─────────────────────────────────── */}
        <TabsContent value="entries" className="space-y-4">
          {/* Filters */}
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
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Profissional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos profissionais</SelectItem>
                {professionals.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="settled">Pago</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="w-full sm:w-40"
            />
            <Input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="w-full sm:w-40"
            />
          </div>

          {/* Table */}
          {entriesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : entries.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Calculator className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma comissão encontrada</p>
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
                    <TableHead>Serviço</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.appointment_date), 'dd/MM/yy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{entry.professional_name}</TableCell>
                      <TableCell>{entry.service_name}</TableCell>
                      <TableCell>{entry.customer_name || '—'}</TableCell>
                      <TableCell className="text-right">{formatCents(entry.service_price_cents)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCents(entry.commission_amount_cents)}
                        <span className="text-xs text-muted-foreground ml-1">
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
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Configure as regras de comissão por profissional e serviço.</p>
            <Button size="sm" onClick={() => { setEditingRule(null); setRuleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova regra
            </Button>
          </div>

          {rulesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rules.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Calculator className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma regra de comissão configurada</p>
                <p className="text-sm mt-1">Crie regras para calcular comissões automaticamente.</p>
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
                    <TableHead>Vigência</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const prof = professionals.find((p: any) => p.id === rule.professional_id);
                    const serv = services.find((s: any) => s.id === rule.service_id);
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>{prof?.name || '—'}</TableCell>
                        <TableCell>{rule.is_default ? <Badge variant="outline">Padrão</Badge> : serv?.name || '—'}</TableCell>
                        <TableCell>{rule.commission_type === 'percentage' ? 'Percentual' : 'Fixo'}</TableCell>
                        <TableCell className="font-medium">
                          {rule.commission_type === 'percentage' ? `${rule.commission_value}%` : `R$ ${Number(rule.commission_value).toFixed(2)}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.active ? 'default' : 'secondary'}>
                            {rule.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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
          {summary.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p>Nenhum dado de comissão para exibir</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {summary.map((s) => (
                <Card key={s.professionalId}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{s.professionalName}</CardTitle>
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
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Atendimentos</p>
                        <p className="text-lg font-semibold">{s.count}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Receita bruta</p>
                        <p className="text-lg font-semibold">{formatCents(s.totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Comissão total</p>
                        <p className="text-lg font-semibold">{formatCents(s.totalCommission)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pendente</p>
                        <p className="text-lg font-semibold text-destructive">{s.pendingCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Ticket médio</p>
                        <p className="text-lg font-semibold">{s.count ? formatCents(Math.round(s.totalRevenue / s.count)) : '—'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
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
