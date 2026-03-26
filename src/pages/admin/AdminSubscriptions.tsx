import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CreditCard, AlertTriangle, Search, Filter, Settings2, Loader2,
  CheckCircle2, Clock, XCircle, AlertCircle, DollarSign, TrendingUp,
  ArrowUpDown, ChevronLeft, ChevronRight, History, Ban, Play,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PLANS } from "@/lib/hardcodedPlans";

// --- Types ---
interface EnrichedSubscription {
  id: string; plan_code: string; plan: string; status: string; billing_cycle: string;
  current_period_start: string; current_period_end: string;
  provider: string | null; provider_ref: string | null; buyer_email: string | null;
  cancel_at_period_end: boolean; owner_user_id: string; establishment_id: string | null;
  created_at: string; updated_at: string;
  establishment_name: string; establishment_slug: string; owner_email: string;
}

interface SubscriptionEvent {
  id: string; establishment_id: string; plan: string; billing_cycle: string;
  event_type: string; amount_cents: number | null;
  provider: string | null; provider_ref: string | null;
  metadata: Record<string, unknown>; occurred_at: string;
}

// --- Constants ---
const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'past_due', label: 'Past Due' }, { value: 'canceled', label: 'Cancelado' },
  { value: 'suspended', label: 'Suspenso' },
];
const PLAN_OPTIONS = [
  { value: 'solo', label: 'Solo' }, { value: 'studio', label: 'Studio' }, { value: 'pro', label: 'Pro' },
];
const CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Mensal' }, { value: 'quarterly', label: 'Trimestral' }, { value: 'yearly', label: 'Anual' },
];
const PROVIDER_OPTIONS = [
  { value: 'kiwify', label: 'Kiwify' }, { value: 'admin', label: 'Admin' }, { value: 'internal', label: 'Internal' },
];
const PAGE_SIZE = 20;
type SortKey = 'establishment_name' | 'plan_code' | 'status' | 'billing_cycle' | 'current_period_end' | 'created_at' | 'updated_at';

// --- Badge Components ---
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
    active: { className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" />, label: "Ativo" },
    past_due: { className: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400", icon: <AlertCircle className="h-3 w-3" />, label: "Past Due" },
    canceled: { className: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400", icon: <XCircle className="h-3 w-3" />, label: "Cancelado" },
    suspended: { className: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400", icon: <Ban className="h-3 w-3" />, label: "Suspenso" },
  };
  const s = map[status];
  if (!s) return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
  return <Badge variant="outline" className={`gap-1 text-[11px] font-medium ${s.className}`}>{s.icon} {s.label}</Badge>;
}

function PlanBadge({ plan }: { plan: string }) {
  const n = (plan || '').toLowerCase();
  const map: Record<string, string> = {
    pro: "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400 font-semibold",
    studio: "bg-primary/10 text-primary border-primary/20 font-semibold",
    solo: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20 dark:text-zinc-400 font-semibold",
  };
  return <Badge variant="outline" className={`text-[11px] ${map[n] || ''}`}>{plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : '—'}</Badge>;
}

function CycleBadge({ cycle }: { cycle: string }) {
  const labels: Record<string, string> = { yearly: 'Anual', quarterly: 'Trimestral', monthly: 'Mensal' };
  const c = (cycle || '').toLowerCase();
  return c && labels[c]
    ? <Badge variant="secondary" className="text-[10px] font-normal">{labels[c]}</Badge>
    : <span className="text-xs text-muted-foreground">—</span>;
}

function ProviderBadge({ provider }: { provider: string | null }) {
  const p = (provider || '').toLowerCase();
  const map: Record<string, string> = {
    kiwify: "text-emerald-600 dark:text-emerald-400",
    admin: "text-amber-600 dark:text-amber-400",
    internal: "text-muted-foreground",
  };
  return <span className={`text-xs font-medium ${map[p] || 'text-muted-foreground'}`}>{provider || '—'}</span>;
}

// --- MRR ---
function calculateMRR(subs: EnrichedSubscription[]): number {
  let mrr = 0;
  for (const sub of subs) {
    if (sub.status !== 'active') continue;
    const plan = PLANS.find(p => p.code === (sub.plan_code || sub.plan || '').toLowerCase());
    if (!plan) continue;
    const cycle = (sub.billing_cycle || 'monthly').toLowerCase();
    if (cycle === 'yearly') mrr += plan.prices.yearly / 12;
    else if (cycle === 'quarterly') mrr += plan.prices.quarterly / 3;
    else mrr += plan.prices.monthly;
  }
  return mrr;
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

// --- Event Labels ---
function getEventLabel(eventType: string): { label: string; dotColor: string } {
  const map: Record<string, { label: string; dotColor: string }> = {
    payment_confirmed: { label: 'Pagamento confirmado', dotColor: 'bg-emerald-500' },
    subscription_updated: { label: 'Assinatura atualizada', dotColor: 'bg-amber-500' },
    plan_changed: { label: 'Plano alterado', dotColor: 'bg-violet-500' },
    cycle_changed: { label: 'Ciclo alterado', dotColor: 'bg-indigo-500' },
    renewed: { label: 'Renovação', dotColor: 'bg-emerald-500' },
    canceled: { label: 'Cancelamento', dotColor: 'bg-red-500' },
    suspended: { label: 'Suspensão', dotColor: 'bg-orange-500' },
    reactivated: { label: 'Reativação', dotColor: 'bg-emerald-500' },
    payment_failed: { label: 'Falha no pagamento', dotColor: 'bg-red-500' },
    refunded: { label: 'Reembolso', dotColor: 'bg-amber-500' },
    update_subscription: { label: 'Atualização admin', dotColor: 'bg-amber-500' },
  };
  return map[eventType] || { label: eventType, dotColor: 'bg-muted-foreground' };
}

// --- Metric Card ---
function MetricCard({ title, value, icon: Icon, color, subtitle, loading }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; subtitle?: string; loading: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-3.5 w-20" />
              </div>
            ) : (
              <>
                <p className={`text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</p>
                <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">{title}</p>
                {subtitle && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <div className="shrink-0 p-2 rounded-lg bg-muted/60">
            <Icon className={`h-4 w-4 ${color || 'text-muted-foreground'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Sortable Header ---
function SortableHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string; sortKey: SortKey; currentSort: SortKey; currentDir: 'asc' | 'desc'; onSort: (key: SortKey) => void;
}) {
  const isActive = currentSort === sortKey;
  return (
    <TableHead className="cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap" onClick={() => onSort(sortKey)}>
      <div className="flex items-center gap-1">
        <span className={isActive ? 'text-foreground font-semibold' : ''}>{label}</span>
        <ArrowUpDown className={`h-3 w-3 shrink-0 ${isActive ? 'text-foreground' : 'text-muted-foreground/30'}`} />
      </div>
    </TableHead>
  );
}

// --- Table Skeleton ---
function TableSkeleton() {
  return (
    <Card>
      <div className="p-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-12 rounded-full" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24 rounded-md ml-auto" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// --- Info Row ---
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

// === MAIN COMPONENT ===
export default function AdminSubscriptions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [manageSub, setManageSub] = useState<EnrichedSubscription | null>(null);
  const [manageTab, setManageTab] = useState('details');
  const [editForm, setEditForm] = useState({ plan_code: '', status: '', billing_cycle: '', provider_ref: '' });

  // --- Data ---
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-subscriptions-enriched"],
    queryFn: async () => {
      console.log('[AdminSubscriptions] Fetching...');
      const { data, error } = await supabase.functions.invoke('admin-data', { body: { action: 'list_subscriptions' } });
      if (error) {
        console.error('[AdminSubscriptions] invoke error:', error);
        throw new Error(error.message || 'Erro ao carregar assinaturas');
      }
      if (data?.error) {
        console.error('[AdminSubscriptions] data error:', data.error);
        throw new Error(data.error);
      }
      console.log('[AdminSubscriptions] OK, count:', data?.subscriptions?.length);
      return data.subscriptions as EnrichedSubscription[];
    },
    staleTime: 15000,
    retry: 2,
  });

  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["admin-subscription-events", manageSub?.establishment_id],
    queryFn: async () => {
      if (!manageSub?.establishment_id) return [];
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { action: 'list_subscription_events', establishment_id: manageSub.establishment_id },
      });
      if (error) throw error;
      return (data?.events || []) as SubscriptionEvent[];
    },
    enabled: !!manageSub?.establishment_id,
    staleTime: 10000,
  });

  const updateSubscription = useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('admin-data', { body: { action: 'update_subscription', ...params } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions-enriched"] });
      queryClient.invalidateQueries({ queryKey: ["admin-establishments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscription-events"] });
    },
  });

  const handleOpenManage = (sub: EnrichedSubscription) => {
    setManageSub(sub);
    setManageTab('details');
    setEditForm({
      plan_code: sub.plan_code || sub.plan || 'solo',
      status: sub.status,
      billing_cycle: sub.billing_cycle || 'monthly',
      provider_ref: sub.provider_ref || '',
    });
  };

  const handleSave = async () => {
    if (!manageSub) return;
    try {
      await updateSubscription.mutateAsync({
        subscription_id: manageSub.id, plan_code: editForm.plan_code,
        status: editForm.status, billing_cycle: editForm.billing_cycle, skip_period_reset: true,
      });
      toast.success("Assinatura atualizada");
      setManageSub(null);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar");
    }
  };

  const handleQuickAction = async (action: 'suspend' | 'reactivate' | 'cancel') => {
    if (!manageSub) return;
    const statusMap = { suspend: 'suspended', reactivate: 'active', cancel: 'canceled' };
    try {
      await updateSubscription.mutateAsync({
        subscription_id: manageSub.id, status: statusMap[action],
        skip_period_reset: action === 'reactivate' ? undefined : true,
      });
      toast.success(`Assinatura ${action === 'suspend' ? 'suspensa' : action === 'reactivate' ? 'reativada' : 'cancelada'}`);
      setManageSub(null);
    } catch (err: any) {
      toast.error(err?.message || "Erro na ação");
    }
  };

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  }, [sortKey]);

  // --- Filter + Sort + Paginate ---
  const { totalFiltered, totalPages, paginatedData, metrics } = useMemo(() => {
    if (!data) return { totalFiltered: 0, totalPages: 0, paginatedData: [], metrics: null };

    let result = data.filter((sub) => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (planFilter !== 'all' && (sub.plan_code || sub.plan) !== planFilter) return false;
      if (cycleFilter !== 'all' && sub.billing_cycle !== cycleFilter) return false;
      if (providerFilter !== 'all' && (sub.provider || '') !== providerFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (sub.establishment_name || '').toLowerCase().includes(q) ||
          (sub.establishment_slug || '').toLowerCase().includes(q) ||
          (sub.owner_email || '').toLowerCase().includes(q) ||
          (sub.buyer_email || '').toLowerCase().includes(q);
      }
      return true;
    });

    result.sort((a, b) => {
      let aVal = (a as any)[sortKey] || '';
      let bVal = (b as any)[sortKey] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const total = data.length;
    const active = data.filter(s => s.status === 'active').length;
    const canceled = data.filter(s => s.status === 'canceled').length;
    const pastDue = data.filter(s => s.status === 'past_due').length;
    const mrr = calculateMRR(data);

    const totalFiltered = result.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const paginatedData = result.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return { totalFiltered, totalPages, paginatedData, metrics: { total, active, canceled, pastDue, mrr } };
  }, [data, statusFilter, planFilter, cycleFilter, providerFilter, search, sortKey, sortDir, page]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="p-3 rounded-full bg-destructive/10"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
        <p className="text-destructive font-semibold">Erro ao carregar assinaturas</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinaturas</h1>
        <p className="text-sm text-muted-foreground">Gerencie todas as assinaturas da plataforma</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard title="Total" value={String(metrics?.total ?? 0)} icon={CreditCard} color="text-foreground" loading={isLoading} />
        <MetricCard title="Ativas" value={String(metrics?.active ?? 0)} icon={CheckCircle2} color="text-emerald-600" loading={isLoading} />
        <MetricCard title="Canceladas" value={String(metrics?.canceled ?? 0)} icon={XCircle} color="text-red-600" loading={isLoading} />
        <MetricCard title="Past Due" value={String(metrics?.pastDue ?? 0)} icon={AlertCircle} color="text-amber-600" loading={isLoading} />
        <MetricCard title="MRR Estimado" value={metrics ? formatBRL(metrics.mrr) : '—'} icon={TrendingUp} color="text-emerald-600" loading={isLoading} />
      </div>

      {/* Filters */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar nome, email ou slug..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9 text-sm" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[115px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[105px] h-8 text-xs"><SelectValue placeholder="Plano" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos planos</SelectItem>
                  {PLAN_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cycleFilter} onValueChange={(v) => { setCycleFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[115px] h-8 text-xs"><SelectValue placeholder="Ciclo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos ciclos</SelectItem>
                  {CYCLE_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={providerFilter} onValueChange={(v) => { setProviderFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[115px] h-8 text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PROVIDER_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap ml-auto">
              {totalFiltered} resultado{totalFiltered !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : paginatedData.length > 0 ? (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHeader label="Estabelecimento" sortKey="establishment_name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Plano" sortKey="plan_code" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Ciclo" sortKey="billing_cycle" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <TableHead className="whitespace-nowrap">Provider</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">Início</TableHead>
                    <SortableHeader label="Próx. Cobrança" sortKey="current_period_end" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Criada" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Atualizada" sortKey="updated_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((sub) => (
                    <TableRow key={sub.id} className="group">
                      <TableCell className="max-w-[200px]">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{sub.establishment_name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{sub.establishment_slug}</p>
                        </div>
                      </TableCell>
                      <TableCell><PlanBadge plan={sub.plan_code || sub.plan} /></TableCell>
                      <TableCell><StatusBadge status={sub.status} /></TableCell>
                      <TableCell><CycleBadge cycle={sub.billing_cycle} /></TableCell>
                      <TableCell><ProviderBadge provider={sub.provider} /></TableCell>
                      <TableCell className="max-w-[150px]">
                        <p className="text-xs truncate text-muted-foreground">{sub.buyer_email || sub.owner_email || '—'}</p>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {sub.current_period_start ? format(new Date(sub.current_period_start), "dd/MM/yy", { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums whitespace-nowrap">
                        {sub.current_period_end ? format(new Date(sub.current_period_end), "dd/MM/yyyy", { locale: ptBR }) : '—'}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {format(new Date(sub.created_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {format(new Date(sub.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleOpenManage(sub)} className="gap-1.5 h-8 text-xs">
                          <Settings2 className="h-3.5 w-3.5" /> Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground tabular-nums">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalFiltered)} de {totalFiltered}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pageIdx = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <Button key={pageIdx} variant={pageIdx === page ? "default" : "outline"} size="sm" className="h-8 w-8 p-0 text-xs" onClick={() => setPage(pageIdx)}>
                      {pageIdx + 1}
                    </Button>
                  );
                })}
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="p-3 rounded-full bg-muted/60 w-fit mx-auto mb-4">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== 'all' || planFilter !== 'all' || cycleFilter !== 'all' || providerFilter !== 'all'
                ? 'Nenhuma assinatura encontrada com esses filtros'
                : 'Nenhuma assinatura cadastrada'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Manage Modal */}
      <Dialog open={!!manageSub} onOpenChange={() => setManageSub(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Gerenciar Assinatura
            </DialogTitle>
            <DialogDescription>{manageSub?.establishment_name} — {manageSub?.owner_email}</DialogDescription>
          </DialogHeader>

          <Tabs value={manageTab} onValueChange={setManageTab} className="flex-1 min-h-0">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="edit">Editar</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {/* Details */}
            <TabsContent value="details" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <InfoRow label="Plano" value={<PlanBadge plan={manageSub?.plan_code || manageSub?.plan || ''} />} />
                <InfoRow label="Status" value={<StatusBadge status={manageSub?.status || ''} />} />
                <InfoRow label="Ciclo" value={<CycleBadge cycle={manageSub?.billing_cycle || ''} />} />
                <InfoRow label="Provider" value={<ProviderBadge provider={manageSub?.provider || null} />} />
                <InfoRow label="Provider Ref" value={<span className="font-mono text-xs">{manageSub?.provider_ref || '—'}</span>} />
                <InfoRow label="Buyer Email" value={<span className="text-xs truncate">{manageSub?.buyer_email || '—'}</span>} />
                <InfoRow label="Início" value={manageSub?.current_period_start ? format(new Date(manageSub.current_period_start), "dd/MM/yyyy", { locale: ptBR }) : '—'} />
                <InfoRow label="Próx. Cobrança" value={manageSub?.current_period_end ? format(new Date(manageSub.current_period_end), "dd/MM/yyyy", { locale: ptBR }) : '—'} />
                <InfoRow label="Criada" value={manageSub?.created_at ? format(new Date(manageSub.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'} />
                <InfoRow label="Atualizada" value={manageSub?.updated_at ? format(new Date(manageSub.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'} />
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ações Rápidas</p>
                <div className="flex flex-wrap gap-2">
                  {manageSub?.status !== 'canceled' && (
                    <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => handleQuickAction('cancel')} disabled={updateSubscription.isPending}>
                      {updateSubscription.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-1" />} Cancelar
                    </Button>
                  )}
                  {manageSub?.status === 'active' && (
                    <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => handleQuickAction('suspend')} disabled={updateSubscription.isPending}>
                      <Ban className="h-3.5 w-3.5 mr-1" /> Suspender
                    </Button>
                  )}
                  {(manageSub?.status === 'canceled' || manageSub?.status === 'suspended' || manageSub?.status === 'past_due') && (
                    <Button variant="outline" size="sm" className="h-8 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50" onClick={() => handleQuickAction('reactivate')} disabled={updateSubscription.isPending}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Reativar
                    </Button>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Edit */}
            <TabsContent value="edit" className="mt-4 space-y-4">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Plano</Label>
                  <Select value={editForm.plan_code} onValueChange={(v) => setEditForm({ ...editForm, plan_code: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{PLAN_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ciclo</Label>
                  <Select value={editForm.billing_cycle} onValueChange={(v) => setEditForm({ ...editForm, billing_cycle: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{CYCLE_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Provider Ref</Label>
                  <Input value={editForm.provider_ref} onChange={(e) => setEditForm({ ...editForm, provider_ref: e.target.value })} placeholder="Referência" className="font-mono text-sm h-9" />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setManageSub(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={updateSubscription.isPending}>
                  {updateSubscription.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {updateSubscription.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* History */}
            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[340px] pr-3">
                {eventsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : events && events.length > 0 ? (
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                    {events.map((ev) => {
                      const { label, dotColor } = getEventLabel(ev.event_type);
                      return (
                        <div key={ev.id} className="relative pb-5 last:pb-0">
                          <div className="absolute -left-6 top-1.5 h-[18px] w-[18px] rounded-full border-2 bg-background border-border flex items-center justify-center">
                            <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                          </div>
                          <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium">{label}</span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {format(new Date(ev.occurred_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <PlanBadge plan={ev.plan} />
                              <CycleBadge cycle={ev.billing_cycle} />
                              {ev.amount_cents ? <span className="font-medium">{formatBRL(ev.amount_cents)}</span> : null}
                              {ev.provider && <span>via {ev.provider}</span>}
                            </div>
                            {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                              <div className="mt-2 text-[11px] text-muted-foreground font-mono bg-background/60 rounded p-2 max-h-20 overflow-auto border border-border/30">
                                {Object.entries(ev.metadata).map(([k, v]) => (
                                  <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <History className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
