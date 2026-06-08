import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ScrollText,
  Shield,
  AlertTriangle,
  Trash2,
  UserPlus,
  UserCog,
  Ban,
  RotateCcw,
  CreditCard,
  Building2,
  Search,
  Calendar,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Action Config ───
const ACTION_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  admin_add: { label: "Admin adicionado", icon: UserPlus, color: "text-green-600" },
  admin_role_change: { label: "Role alterada", icon: UserCog, color: "text-blue-600" },
  admin_suspend: { label: "Admin suspenso", icon: Ban, color: "text-amber-600" },
  admin_reactivate: { label: "Admin reativado", icon: RotateCcw, color: "text-green-600" },
  admin_remove: { label: "Admin removido", icon: Trash2, color: "text-destructive" },
  admin_update: { label: "Admin atualizado", icon: UserCog, color: "text-blue-600" },
  update_establishment: { label: "Estabelecimento atualizado", icon: Building2, color: "text-blue-600" },
  update_subscription: { label: "Assinatura alterada", icon: CreditCard, color: "text-purple-600" },
  hard_delete_establishment: { label: "Exclusão permanente", icon: Trash2, color: "text-destructive" },
  danger_zone_preview: { label: "Danger Zone (prévia)", icon: AlertTriangle, color: "text-amber-600" },
  danger_zone_execute: { label: "Danger Zone (execução)", icon: Trash2, color: "text-destructive" },
  danger_zone_error: { label: "Danger Zone (erro)", icon: AlertTriangle, color: "text-destructive" },
  set_plan: { label: "Plano definido", icon: CreditCard, color: "text-purple-600" },
};

const getActionConfig = (action: string) =>
  ACTION_CONFIG[action] || { label: action, icon: FileText, color: "text-muted-foreground" };

interface AuditLog {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  admin_name: string | null;
  action: string;
  target_establishment_id: string | null;
  target_owner_user_id: string | null;
  metadata: any;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function AdminAuditLogs() {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [adminFilter, setAdminFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-audit-logs", actionFilter, adminFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      const params: Record<string, any> = {
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      };
      if (actionFilter && actionFilter !== "all") params.p_action = actionFilter;
      if (dateFrom) params.p_date_from = new Date(dateFrom).toISOString();
      if (dateTo) params.p_date_to = new Date(dateTo + "T23:59:59").toISOString();

      const { data, error } = await supabase.rpc("get_admin_audit_logs" as any, params);
      if (error) throw error;
      return (data || []) as AuditLog[];
    },
  });

  // Filter by admin email/name client-side (since it's already resolved)
  const logs = useMemo(() => {
    if (!data) return [];
    if (!adminFilter.trim()) return data;
    const q = adminFilter.toLowerCase();
    return data.filter(
      (l) =>
        l.admin_email?.toLowerCase().includes(q) ||
        l.admin_name?.toLowerCase().includes(q)
    );
  }, [data, adminFilter]);

  // Stats
  const stats = useMemo(() => {
    if (!data) return { total: 0, critical: 0, today: 0, uniqueAdmins: 0 };
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const criticalActions = ["hard_delete_establishment", "danger_zone_execute", "admin_remove"];
    return {
      total: data.length,
      critical: data.filter((l) => criticalActions.includes(l.action)).length,
      today: data.filter((l) => l.created_at.startsWith(todayStr)).length,
      uniqueAdmins: new Set(data.map((l) => l.admin_user_id)).size,
    };
  }, [data]);

  // Unique actions for filter
  const availableActions = useMemo(() => {
    const actions = new Set(data?.map((l) => l.action) || []);
    return Array.from(actions).sort();
  }, [data]);

  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
        <p className="text-destructive font-medium">Erro ao carregar logs</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6" />
            Logs de Auditoria
          </h1>
          <p className="text-muted-foreground text-sm">
            Registro imutável de todas as ações administrativas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : stats.total}</p>
                <p className="text-xs text-muted-foreground">Total de logs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-destructive/10">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : stats.critical}</p>
                <p className="text-xs text-muted-foreground">Ações críticas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10">
                <Calendar className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : stats.today}</p>
                <p className="text-xs text-muted-foreground">Hoje</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? "—" : stats.uniqueAdmins}</p>
                <p className="text-xs text-muted-foreground">Admins ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por admin..."
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as ações" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {availableActions.map((a) => (
              <SelectItem key={a} value={a}>
                {getActionConfig(a).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
          className="w-[160px]"
          placeholder="De"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
          className="w-[160px]"
          placeholder="Até"
        />
        {(actionFilter !== "all" || dateFrom || dateTo || adminFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setActionFilter("all");
              setDateFrom("");
              setDateTo("");
              setAdminFilter("");
              setPage(0);
            }}
          >
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum log encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ação</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead className="hidden md:table-cell">Entidade</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const config = getActionConfig(log.action);
                    const Icon = config.icon;
                    const isCritical = [
                      "hard_delete_establishment",
                      "danger_zone_execute",
                      "admin_remove",
                    ].includes(log.action);

                    return (
                      <TableRow key={log.id} className={isCritical ? "bg-destructive/5" : ""}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                            <span className="text-sm font-medium">{config.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{log.admin_name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{log.admin_email || log.admin_user_id.slice(0, 8)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {log.target_establishment_id ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.target_establishment_id.slice(0, 8)}…
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">
                            {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {logs.length} registro{logs.length !== 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(data?.length || 0) < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Detalhes do Log
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Ação</p>
                  <Badge className="font-mono">{selectedLog.action}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Data</p>
                  <p>{format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Admin</p>
                  <p className="font-medium">{selectedLog.admin_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{selectedLog.admin_email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Admin ID</p>
                  <p className="font-mono text-xs break-all">{selectedLog.admin_user_id}</p>
                </div>
                {selectedLog.target_establishment_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-1">Estabelecimento alvo</p>
                    <p className="font-mono text-xs break-all">{selectedLog.target_establishment_id}</p>
                  </div>
                )}
                {selectedLog.target_owner_user_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-1">Owner alvo</p>
                    <p className="font-mono text-xs break-all">{selectedLog.target_owner_user_id}</p>
                  </div>
                )}
                {selectedLog.ip && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">IP</p>
                    <p className="font-mono text-xs">{selectedLog.ip}</p>
                  </div>
                )}
                {selectedLog.user_agent && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-1">User Agent</p>
                    <p className="text-xs break-all">{selectedLog.user_agent}</p>
                  </div>
                )}
              </div>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Metadata</p>
                  <pre className="text-xs p-3 bg-muted rounded-lg overflow-x-auto max-h-48">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
