import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAdminEstablishments, useUpdateEstablishment, type AdminEstablishment } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Building2, Settings2, Loader2, CheckCircle2, Clock, XCircle,
  AlertCircle, Ban, Play, Users, Scissors, CalendarDays, RefreshCw,
  Trash2, CreditCard, BarChart3, History, ShieldAlert, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { PLANS, formatCentsBRL } from "@/lib/hardcodedPlans";

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

// --- Badge helpers ---
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active': return <Badge className="bg-green-600/15 text-green-700 border-green-600/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Ativo</Badge>;
    case 'past_due': return <Badge className="bg-amber-600/15 text-amber-700 border-amber-600/30"><AlertCircle className="h-3 w-3 mr-1" /> Past Due</Badge>;
    case 'canceled': return <Badge className="bg-red-600/15 text-red-700 border-red-600/30"><XCircle className="h-3 w-3 mr-1" /> Cancelado</Badge>;
    case 'suspended': return <Badge className="bg-orange-600/15 text-orange-700 border-orange-600/30"><Ban className="h-3 w-3 mr-1" /> Suspenso</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function PlanBadge({ plan }: { plan: string }) {
  const n = (plan || '').toLowerCase();
  switch (n) {
    case 'pro': return <Badge className="bg-purple-600/15 text-purple-700 border-purple-600/30 font-semibold">Pro</Badge>;
    case 'studio': return <Badge className="bg-primary/15 text-primary border-primary/30 font-semibold">Studio</Badge>;
    case 'solo': return <Badge className="bg-zinc-600/15 text-zinc-700 border-zinc-600/30 font-semibold">Solo</Badge>;
    default: return <Badge variant="outline">{plan || 'Nenhum'}</Badge>;
  }
}

function CycleBadge({ cycle }: { cycle: string | undefined }) {
  switch ((cycle || '').toLowerCase()) {
    case 'yearly': return <Badge variant="outline" className="text-xs">Anual</Badge>;
    case 'quarterly': return <Badge variant="outline" className="text-xs">Trimestral</Badge>;
    case 'monthly': return <Badge variant="outline" className="text-xs">Mensal</Badge>;
    default: return <span className="text-xs text-muted-foreground">—</span>;
  }
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 px-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function getPlanCode(est: AdminEstablishment): string {
  return est.subscription?.plan_code || est.plano || 'nenhum';
}
function getCycle(est: AdminEstablishment): string {
  return est.subscription?.billing_cycle || '';
}

// --- Event type label ---
function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    payment_confirmed: 'Pagamento confirmado',
    subscription_updated: 'Assinatura atualizada',
    subscription_renewed: 'Renovação',
    subscription_canceled: 'Cancelamento',
    payment_failed: 'Falha no pagamento',
    plan_changed: 'Mudança de plano',
    update_establishment: 'Alteração administrativa',
  };
  return map[type] || type;
}

function eventTypeColor(type: string): string {
  if (type.includes('cancel')) return 'border-red-400 bg-red-50 dark:bg-red-950/30';
  if (type.includes('fail')) return 'border-amber-400 bg-amber-50 dark:bg-amber-950/30';
  if (type.includes('payment') || type.includes('renew')) return 'border-green-400 bg-green-50 dark:bg-green-950/30';
  return 'border-muted bg-muted/30';
  return 'border-muted bg-muted/30';
}

// --- Hook: Fetch subscription events ---
function useSubscriptionEvents(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['admin-subscription-events', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return [];
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { action: 'list_subscription_events', establishment_id: establishmentId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.events || []) as Array<{
        id: string;
        event_type: string;
        plan: string;
        billing_cycle: string;
        occurred_at: string;
        amount_cents: number | null;
        provider: string | null;
        metadata: Record<string, any>;
      }>;
    },
    enabled: !!establishmentId,
    staleTime: 15000,
  });
}

// --- MRR estimate for a single establishment ---
function estimateMRR(est: AdminEstablishment): number {
  const planCode = getPlanCode(est);
  const cycle = getCycle(est) || 'monthly';
  const plan = PLANS.find(p => p.code === planCode);
  if (!plan || est.status !== 'active') return 0;
  const price = plan.prices[cycle as keyof typeof plan.prices] || plan.prices.monthly;
  if (cycle === 'yearly') return Math.round(price / 12);
  if (cycle === 'quarterly') return Math.round(price / 3);
  return price;
}

// === MAIN ===
export default function AdminEstablishmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const updateEstablishment = useUpdateEstablishment();

  const { data, isLoading } = useAdminEstablishments();
  const est = useMemo(() => data?.establishments?.find(e => e.id === id) || null, [data, id]);

  const { data: events, isLoading: eventsLoading } = useSubscriptionEvents(est?.id);

  // Edit form state
  const [editPlan, setEditPlan] = useState('');
  const [editCycle, setEditCycle] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // Delete state
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteAuth, setDeleteAuth] = useState(false);
  const [deleteStorage, setDeleteStorage] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (est) {
      setEditPlan(getPlanCode(est));
      setEditCycle(getCycle(est) || 'monthly');
      setEditStatus(est.status);
    }
  }, [est]);

  const handleSaveSubscription = async () => {
    if (!est) return;
    try {
      await updateEstablishment.mutateAsync({
        establishment_id: est.id,
        plano: editPlan,
        billing_cycle: editCycle,
        status: editStatus,
      });
      toast.success("Assinatura atualizada com sucesso");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar");
    }
  };

  const handleQuickAction = async (action: 'suspend' | 'reactivate' | 'cancel') => {
    if (!est) return;
    try {
      const statusMap = { suspend: 'past_due', reactivate: 'active', cancel: 'canceled' } as const;
      await updateEstablishment.mutateAsync({ establishment_id: est.id, status: statusMap[action] });
      toast.success(`Estabelecimento ${action === 'suspend' ? 'suspenso' : action === 'reactivate' ? 'reativado' : 'cancelado'}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro na ação");
    }
  };

  const handleDelete = async () => {
    if (!est || deleteConfirm !== 'EXCLUIR') return;
    setDeleting(true);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("admin-delete-establishment", {
        body: { establishment_id: est.id, delete_auth_user: deleteAuth, delete_storage_files: deleteStorage },
      });
      if (fnError) throw fnError;
      if (result?.error) throw new Error(result.error);
      toast.success(`"${est.name}" excluído permanentemente`);
      queryClient.invalidateQueries({ queryKey: ["admin-establishments"] });
      navigate('/admin/estabelecimentos');
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!est) {
    return (
      <div className="text-center py-16 space-y-4">
        <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground">Estabelecimento não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/admin/estabelecimentos')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const mrr = estimateMRR(est);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin/estabelecimentos')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            {est.name}
            <StatusBadge status={est.status} />
          </h1>
          <p className="text-sm text-muted-foreground">/{est.slug} · {est.owner_email}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">Profissionais</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{est.professionals_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Serviços</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{est.services_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Clientes</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{est.customers_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Agendamentos</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">{est.appointments_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">MRR estimado</span>
            </div>
            <p className="text-2xl font-bold tabular-nums mt-1">R$ {formatCentsBRL(mrr)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5 hidden sm:block" /> Overview</TabsTrigger>
          <TabsTrigger value="subscription" className="gap-1.5 text-xs sm:text-sm"><CreditCard className="h-3.5 w-3.5 hidden sm:block" /> Assinatura</TabsTrigger>
          <TabsTrigger value="usage" className="gap-1.5 text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5 hidden sm:block" /> Uso</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs sm:text-sm"><History className="h-3.5 w-3.5 hidden sm:block" /> Logs</TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5 text-xs sm:text-sm"><ShieldAlert className="h-3.5 w-3.5 hidden sm:block" /> Ações</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW === */}
        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle className="text-lg">Informações Gerais</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Nome" value={est.name} />
              <InfoRow label="Slug" value={`/${est.slug}`} />
              <InfoRow label="Email do Owner" value={est.owner_email} />
              <Separator className="my-2" />
              <InfoRow label="Plano" value={<PlanBadge plan={getPlanCode(est)} />} />
              <InfoRow label="Ciclo" value={<CycleBadge cycle={getCycle(est)} />} />
              <InfoRow label="Status" value={<StatusBadge status={est.status} />} />
              {est.subscription?.current_period_end && (
                <InfoRow label="Validade Assinatura" value={format(new Date(est.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })} />
              )}
              <Separator className="my-2" />
              <InfoRow label="Criado em" value={format(new Date(est.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
              <InfoRow label="Booking Ativo" value={est.booking_enabled ? <Badge className="bg-green-600/15 text-green-700 border-green-600/30">Sim</Badge> : <Badge variant="outline">Não</Badge>} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ASSINATURA === */}
        <TabsContent value="subscription">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Current subscription info */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Assinatura Atual</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {est.subscription ? (
                  <>
                    <InfoRow label="Plano" value={<PlanBadge plan={est.subscription.plan_code} />} />
                    <InfoRow label="Ciclo" value={<CycleBadge cycle={est.subscription.billing_cycle} />} />
                    <InfoRow label="Status" value={<Badge variant="outline">{est.subscription.status}</Badge>} />
                    <InfoRow label="Provider" value={est.subscription.provider || '—'} />
                    <InfoRow label="Provider Ref" value={est.subscription.provider_ref || '—'} />
                    <InfoRow label="Email Comprador" value={est.subscription.buyer_email || '—'} />
                    {est.subscription.current_period_start && (
                      <InfoRow label="Início do Período" value={format(new Date(est.subscription.current_period_start), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                    )}
                    {est.subscription.current_period_end && (
                      <InfoRow label="Fim do Período" value={format(new Date(est.subscription.current_period_end), "dd/MM/yyyy HH:mm", { locale: ptBR })} />
                    )}
                    <InfoRow label="Cancelar ao fim" value={est.subscription.cancel_at_period_end ? 'Sim' : 'Não'} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic py-4">Nenhuma assinatura vinculada.</p>
                )}
              </CardContent>
            </Card>

            {/* Edit subscription */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Alterar Assinatura</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Plano</Label>
                  <Select value={editPlan} onValueChange={setEditPlan}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLAN_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Ciclo</Label>
                  <Select value={editCycle} onValueChange={setEditCycle}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CYCLE_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleSaveSubscription} disabled={updateEstablishment.isPending} className="w-full">
                  {updateEstablishment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>

                <Separator />

                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações Rápidas</p>
                <div className="grid gap-2">
                  {est.status === 'active' && (
                    <Button variant="outline" size="sm" className="justify-start text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleQuickAction('suspend')} disabled={updateEstablishment.isPending}>
                      <Ban className="h-4 w-4 mr-2" /> Suspender
                    </Button>
                  )}
                  {est.status !== 'canceled' && (
                    <Button variant="outline" size="sm" className="justify-start text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleQuickAction('cancel')} disabled={updateEstablishment.isPending}>
                      <XCircle className="h-4 w-4 mr-2" /> Cancelar
                    </Button>
                  )}
                  {(est.status === 'canceled' || est.status === 'past_due') && (
                    <Button variant="outline" size="sm" className="justify-start text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleQuickAction('reactivate')} disabled={updateEstablishment.isPending}>
                      <Play className="h-4 w-4 mr-2" /> Reativar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === USO DO SISTEMA === */}
        <TabsContent value="usage">
          <Card>
            <CardHeader><CardTitle className="text-lg">Uso do Sistema</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Users className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                  <p className="text-3xl font-bold tabular-nums">{est.professionals_count}</p>
                  <p className="text-xs text-muted-foreground mt-1">Profissionais</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Scissors className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                  <p className="text-3xl font-bold tabular-nums">{est.services_count}</p>
                  <p className="text-xs text-muted-foreground mt-1">Serviços</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Users className="h-6 w-6 mx-auto text-green-600 mb-2" />
                  <p className="text-3xl font-bold tabular-nums">{est.customers_count}</p>
                  <p className="text-xs text-muted-foreground mt-1">Clientes</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <CalendarDays className="h-6 w-6 mx-auto text-amber-600 mb-2" />
                  <p className="text-3xl font-bold tabular-nums">{est.appointments_count}</p>
                  <p className="text-xs text-muted-foreground mt-1">Agendamentos</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <CreditCard className="h-6 w-6 mx-auto text-emerald-600 mb-2" />
                  <p className="text-3xl font-bold tabular-nums">R$ {formatCentsBRL(mrr)}</p>
                  <p className="text-xs text-muted-foreground mt-1">MRR Estimado</p>
                </div>
              </div>

              {/* Plan limits check */}
              {(() => {
                const planCode = getPlanCode(est);
                const plan = PLANS.find(p => p.code === planCode);
                if (!plan) return null;
                const limit = plan.maxProfessionals;
                if (limit === null) return null;
                const over = est.professionals_count > limit;
                return (
                  <div className={`mt-4 p-3 rounded-lg border text-sm ${over ? 'border-red-300 bg-red-50 dark:bg-red-950/20 text-red-700' : 'border-green-300 bg-green-50 dark:bg-green-950/20 text-green-700'}`}>
                    {over
                      ? <><AlertCircle className="h-4 w-4 inline mr-1" /> Acima do limite: {est.professionals_count}/{limit} profissionais</>
                      : <><CheckCircle2 className="h-4 w-4 inline mr-1" /> Dentro do limite: {est.professionals_count}/{limit} profissionais</>
                    }
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === LOGS === */}
        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle className="text-lg">Histórico de Eventos</CardTitle></CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : events && events.length > 0 ? (
                <div className="relative space-y-0">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                  {events.map((ev, idx) => (
                    <div key={ev.id} className="relative pl-10 pb-4">
                      {/* Dot */}
                      <div className={`absolute left-2.5 top-2 h-3 w-3 rounded-full border-2 ${
                        ev.event_type.includes('cancel') || ev.event_type.includes('fail') ? 'border-red-500 bg-red-100' :
                        ev.event_type.includes('payment') || ev.event_type.includes('renew') ? 'border-green-500 bg-green-100' :
                        'border-muted-foreground bg-muted'
                      }`} />

                      <div className={`rounded-lg border p-3 ${eventTypeColor(ev.event_type)}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold">{eventTypeLabel(ev.event_type)}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {format(new Date(ev.occurred_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <Badge variant="outline" className="text-[10px]">{ev.plan}</Badge>
                          <Badge variant="outline" className="text-[10px]">{ev.billing_cycle}</Badge>
                          {ev.provider && <Badge variant="outline" className="text-[10px]">{ev.provider}</Badge>}
                          {ev.amount_cents != null && ev.amount_cents > 0 && (
                            <Badge variant="outline" className="text-[10px]">R$ {formatCentsBRL(ev.amount_cents)}</Badge>
                          )}
                        </div>
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <div className="mt-2 text-[11px] text-muted-foreground font-mono bg-background/50 rounded p-2 max-h-24 overflow-auto">
                            {Object.entries(ev.metadata).map(([k, v]) => (
                              <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === AÇÕES ADMINISTRATIVAS === */}
        <TabsContent value="actions">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-lg">Ações Rápidas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {est.status !== 'active' && (
                  <Button variant="outline" className="w-full justify-start text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => handleQuickAction('reactivate')} disabled={updateEstablishment.isPending}>
                    <Play className="h-4 w-4 mr-2" /> Reativar Conta
                  </Button>
                )}
                {est.status === 'active' && (
                  <Button variant="outline" className="w-full justify-start text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleQuickAction('suspend')} disabled={updateEstablishment.isPending}>
                    <Ban className="h-4 w-4 mr-2" /> Suspender Conta
                  </Button>
                )}
                {(est.status === 'canceled' || est.status === 'past_due') && (
                  <Button variant="outline" className="w-full justify-start text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleQuickAction('reactivate')} disabled={updateEstablishment.isPending}>
                    <Play className="h-4 w-4 mr-2" /> Reativar Conta
                  </Button>
                )}
                {est.status !== 'canceled' && (
                  <Button variant="outline" className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleQuickAction('cancel')} disabled={updateEstablishment.isPending}>
                    <XCircle className="h-4 w-4 mr-2" /> Cancelar Conta
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-lg text-destructive flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5" /> Zona de Perigo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ações irreversíveis. Tenha certeza antes de prosseguir.
                </p>
                <Button variant="destructive" className="w-full justify-start" onClick={() => setShowDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir Permanentemente
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={showDelete} onOpenChange={() => !deleting && setShowDelete(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" /> Excluir Permanentemente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{est.name}</strong> (/{est.slug}). Esta ação é <strong>irreversível</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="del-auth" checked={deleteAuth} onCheckedChange={(c) => setDeleteAuth(!!c)} />
                <Label htmlFor="del-auth" className="text-sm">Também excluir usuário (auth)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="del-storage" checked={deleteStorage} onCheckedChange={(c) => setDeleteStorage(!!c)} />
                <Label htmlFor="del-storage" className="text-sm">Também remover arquivos (storage)</Label>
              </div>
            </div>
            <div className="space-y-2 border-t pt-4">
              <Label className="text-sm text-destructive font-semibold">Digite EXCLUIR para confirmar:</Label>
              <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="EXCLUIR" className="font-mono border-destructive/30" autoComplete="off" />
            </div>
          </div>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== 'EXCLUIR' || deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {deleting ? "Excluindo..." : "🔥 Excluir"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
