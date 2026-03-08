import { useState, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminEstablishments, type AdminEstablishment } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, Building2, Settings2, AlertTriangle, Filter, Trash2,
  Loader2, CheckCircle2, Clock, XCircle, AlertCircle, Ban,
  ArrowUpDown, ChevronLeft, ChevronRight,
  TrendingUp, ShieldAlert,
} from "lucide-react";
import { format, startOfMonth, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// --- Constants ---
const STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'suspended', label: 'Suspenso' },
];
const PLAN_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'studio', label: 'Studio' },
  { value: 'pro', label: 'Pro' },
];
const CYCLE_OPTIONS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'yearly', label: 'Anual' },
];

const PAGE_SIZE = 20;
type SortKey = 'name' | 'status' | 'plano' | 'professionals_count' | 'services_count' | 'customers_count' | 'appointments_count' | 'created_at';

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
  return <Badge variant="outline" className={`text-[11px] ${map[n] || ''}`}>{plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Nenhum'}</Badge>;
}

function CycleBadge({ cycle }: { cycle: string | undefined }) {
  const labels: Record<string, string> = { yearly: 'Anual', quarterly: 'Trimestral', monthly: 'Mensal' };
  const c = (cycle || '').toLowerCase();
  return c && labels[c]
    ? <Badge variant="secondary" className="text-[10px] font-normal">{labels[c]}</Badge>
    : <span className="text-xs text-muted-foreground">—</span>;
}

function getPlanCode(est: AdminEstablishment): string {
  return est.subscription?.plan_code || est.plano || 'nenhum';
}
function getCycle(est: AdminEstablishment): string {
  return est.subscription?.billing_cycle || '';
}

// --- Metric Card ---
function MetricCard({ title, value, icon: Icon, color, loading, subtitle }: {
  title: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; loading: boolean; subtitle?: string;
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
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => onSort(sortKey)}
    >
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
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-12 rounded-full" />
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-4 w-8 ml-auto" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// === MAIN COMPONENT ===
export default function AdminEstablishments() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [cycleFilter, setCycleFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [deleteEst, setDeleteEst] = useState<AdminEstablishment | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteAuthUser, setDeleteAuthUser] = useState(false);
  const [deleteStorageFiles, setDeleteStorageFiles] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, isLoading, error } = useAdminEstablishments(debouncedSearch || undefined);
  const queryClient = useQueryClient();

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(value), 400);
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(0);
  }, [sortKey]);

  const handleOpenManage = (est: AdminEstablishment) => {
    navigate(`/admin/estabelecimentos/${est.id}`);
  };

  const handleOpenDelete = (est: AdminEstablishment) => {
    setDeleteEst(est);
    setDeleteConfirmText("");
    setDeleteAuthUser(false);
    setDeleteStorageFiles(false);
  };

  const handleDelete = async () => {
    if (!deleteEst || deleteConfirmText !== "EXCLUIR") return;
    setDeleting(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("admin-delete-establishment", {
        body: { establishment_id: deleteEst.id, delete_auth_user: deleteAuthUser, delete_storage_files: deleteStorageFiles },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      toast.success(`"${deleteEst.name}" excluído permanentemente`);
      setDeleteEst(null);
      queryClient.invalidateQueries({ queryKey: ["admin-establishments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  const { metrics, paginatedData, totalFiltered, totalPages } = useMemo(() => {
    const establishments = data?.establishments || [];
    const now = new Date();
    const monthStart = startOfMonth(now);
    const total = establishments.length;
    const active = establishments.filter(e => e.status === 'active').length;
    const canceled = establishments.filter(e => e.status === 'canceled').length;
    const pastDue = establishments.filter(e => e.status === 'past_due').length;
    const newThisMonth = establishments.filter(e => isAfter(new Date(e.created_at), monthStart)).length;

    let filtered = establishments.filter((est) => {
      if (statusFilter !== 'all' && est.status !== statusFilter) return false;
      if (planFilter !== 'all' && getPlanCode(est) !== planFilter) return false;
      if (cycleFilter !== 'all' && getCycle(est) !== cycleFilter) return false;
      return true;
    });

    filtered.sort((a, b) => {
      let aVal: any = sortKey === 'plano' ? getPlanCode(a) : (a as any)[sortKey] ?? '';
      let bVal: any = sortKey === 'plano' ? getPlanCode(b) : (b as any)[sortKey] ?? '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return {
      metrics: { total, active, canceled, pastDue, newThisMonth },
      paginatedData, totalFiltered, totalPages,
    };
  }, [data, statusFilter, planFilter, cycleFilter, sortKey, sortDir, page]);

  const diagnostics = useMemo(() => {
    if (!data?.establishments) return [];
    const issues: { est: AdminEstablishment; issue: string }[] = [];
    for (const est of data.establishments) {
      const plan = getPlanCode(est);
      if (est.status === 'active' && !est.subscription) issues.push({ est, issue: 'Ativo sem assinatura' });
      if (est.subscription && est.plano && est.subscription.plan_code !== est.plano && est.plano !== 'nenhum')
        issues.push({ est, issue: `Plano divergente: est=${est.plano} vs sub=${est.subscription.plan_code}` });
      if (plan === 'solo' && est.professionals_count > 1) issues.push({ est, issue: `Solo com ${est.professionals_count} profissionais` });
      if (plan === 'studio' && est.professionals_count > 4) issues.push({ est, issue: `Studio com ${est.professionals_count} profissionais` });
    }
    return issues;
  }, [data]);

  const canDelete = deleteConfirmText === "EXCLUIR";

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="p-3 rounded-full bg-destructive/10"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
        <p className="text-destructive font-semibold">Erro ao carregar estabelecimentos</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">{(error as Error)?.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estabelecimentos</h1>
        <p className="text-sm text-muted-foreground">Centro de controle de todos os estabelecimentos do sistema</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <MetricCard title="Total" value={String(metrics.total)} icon={Building2} color="text-foreground" loading={isLoading} />
        <MetricCard title="Ativos" value={String(metrics.active)} icon={CheckCircle2} color="text-emerald-600" loading={isLoading} />
        <MetricCard title="Past Due" value={String(metrics.pastDue)} icon={AlertCircle} color="text-amber-600" loading={isLoading} />
        <MetricCard title="Cancelados" value={String(metrics.canceled)} icon={XCircle} color="text-red-600" loading={isLoading} />
        <MetricCard title="Novos (mês)" value={String(metrics.newThisMonth)} icon={TrendingUp} color="text-emerald-600" loading={isLoading} />
        {diagnostics.length > 0 && (
          <MetricCard title="Inconsistências" value={String(diagnostics.length)} icon={ShieldAlert} color="text-orange-600" loading={isLoading} />
        )}
      </div>

      {/* Diagnostics */}
      {diagnostics.length > 0 && (
        <Card className="border-orange-400/30 bg-orange-50/30 dark:bg-orange-950/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <ShieldAlert className="h-4 w-4 text-orange-600 shrink-0" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                {diagnostics.length} inconsistência{diagnostics.length !== 1 ? 's' : ''} detectada{diagnostics.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1.5">
              {diagnostics.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs gap-2">
                  <button onClick={() => handleOpenManage(d.est)} className="text-muted-foreground hover:text-foreground hover:underline transition-colors truncate text-left">
                    {d.est.name} <span className="text-muted-foreground/60">({d.est.slug})</span>
                  </button>
                  <span className="text-orange-600 dark:text-orange-400 font-medium shrink-0">{d.issue}</span>
                </div>
              ))}
              {diagnostics.length > 5 && (
                <p className="text-[11px] text-muted-foreground">...e mais {diagnostics.length - 5}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-3">
            <div className="relative flex-1 w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, slug ou e-mail..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
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
          {/* Mobile card list */}
          <div className="block lg:hidden space-y-3">
            {paginatedData.map((est) => (
              <Card key={est.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{est.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">/{est.slug} · {est.owner_email}</p>
                    </div>
                    <StatusBadge status={est.status} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    <PlanBadge plan={getPlanCode(est)} />
                    <CycleBadge cycle={getCycle(est)} />
                    <span className="text-xs text-muted-foreground">{est.professionals_count} prof · {est.services_count} serv · {est.appointments_count} agend</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenManage(est)} className="gap-1.5 h-8 text-xs flex-1">
                      <Settings2 className="h-3.5 w-3.5" /> Gerenciar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(est)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {/* Desktop table */}
          <Card className="hidden lg:block">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortableHeader label="Estabelecimento" sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Plano" sortKey="plano" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <TableHead className="whitespace-nowrap">Ciclo</TableHead>
                    <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Prof." sortKey="professionals_count" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Serv." sortKey="services_count" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Clientes" sortKey="customers_count" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Agend." sortKey="appointments_count" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableHeader label="Criado" sortKey="created_at" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((est) => (
                    <TableRow key={est.id} className="group">
                      <TableCell className="max-w-[220px]">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{est.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">/{est.slug} · {est.owner_email}</p>
                        </div>
                      </TableCell>
                      <TableCell><PlanBadge plan={getPlanCode(est)} /></TableCell>
                      <TableCell><CycleBadge cycle={getCycle(est)} /></TableCell>
                      <TableCell><StatusBadge status={est.status} /></TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{est.professionals_count}</TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{est.services_count}</TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{est.customers_count}</TableCell>
                      <TableCell className="tabular-nums text-center text-sm">{est.appointments_count}</TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                        {format(new Date(est.created_at), "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" onClick={() => handleOpenManage(est)} className="gap-1.5 h-8 text-xs">
                            <Settings2 className="h-3.5 w-3.5" /> Gerenciar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenDelete(est)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
                    <Button
                      key={pageIdx}
                      variant={pageIdx === page ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setPage(pageIdx)}
                    >
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
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search || statusFilter !== 'all' || planFilter !== 'all' || cycleFilter !== 'all'
                ? 'Nenhum estabelecimento encontrado com esses filtros'
                : 'Nenhum estabelecimento cadastrado'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hard Delete Modal */}
      <AlertDialog open={!!deleteEst} onOpenChange={() => !deleting && setDeleteEst(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{deleteEst?.name}</strong> (/{deleteEst?.slug}). Esta ação é <strong>irreversível</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="delete-auth" checked={deleteAuthUser} onCheckedChange={(c) => setDeleteAuthUser(!!c)} />
                <Label htmlFor="delete-auth" className="text-sm">Também excluir usuário (auth)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="delete-storage" checked={deleteStorageFiles} onCheckedChange={(c) => setDeleteStorageFiles(!!c)} />
                <Label htmlFor="delete-storage" className="text-sm">Também remover arquivos (storage)</Label>
              </div>
            </div>
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm text-destructive font-semibold">Digite EXCLUIR para confirmar:</Label>
              <Input value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="EXCLUIR" className="font-mono border-destructive/30 focus-visible:ring-destructive/30" autoComplete="off" />
            </div>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setDeleteEst(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleting ? "Excluindo..." : "Excluir Permanentemente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
