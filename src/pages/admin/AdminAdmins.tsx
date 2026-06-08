import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Trash2,
  Shield,
  Crown,
  Loader2,
  Search,
  MoreHorizontal,
  Copy,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  UserX,
  Pencil,
  Ban,
  RotateCcw,
  ShieldCheck,
  Headphones,
  DollarSign,
  Code,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

// ─── Types ───
interface AdminUser {
  user_id: string;
  email: string | null;
  name: string | null;
  role: string;
  level: string | null;
  status: string;
  last_access_at: string | null;
  created_by: string | null;
  created_by_email: string | null;
  user_created_at: string | null;
}

const ROLES = [
  { value: "super_admin", label: "Super Admin", icon: Crown, color: "bg-primary text-primary-foreground" },
  { value: "admin", label: "Admin", icon: Shield, color: "bg-secondary text-secondary-foreground" },
  { value: "support", label: "Suporte", icon: Headphones, color: "bg-accent text-accent-foreground" },
  { value: "finance", label: "Financeiro", icon: DollarSign, color: "bg-muted text-muted-foreground" },
  { value: "developer", label: "Desenvolvedor", icon: Code, color: "bg-muted text-muted-foreground" },
] as const;

const STATUSES = [
  { value: "ativo", label: "Ativo", variant: "default" as const },
  { value: "suspenso", label: "Suspenso", variant: "destructive" as const },
  { value: "removido", label: "Removido", variant: "outline" as const },
] as const;

// ─── Hooks ───
// useMyAdminLevel removed - using useAdminPermissions instead

function useAdminUsers() {
  return useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_admin_users" as any);
      if (error) throw error;
      return (data || []) as AdminUser[];
    },
  });
}

// ─── Component ───
export default function AdminAdmins() {
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<AdminUser | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("admin");
  const [createIfMissing, setCreateIfMissing] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "suspend" | "reactivate";
    admin: AdminUser;
  } | null>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isSuperAdmin, hasPermission, role: myLevel, isLoading: myLevelLoading, error: myLevelError } = useAdminPermissions();
  const { data: admins, isLoading, error, refetch } = useAdminUsers();

  // ─── Mutations ───
  const addAdmin = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-add-user", {
        body: { email: newEmail.trim(), level: newRole === "super_admin" ? "master" : "standard", role: newRole, name: newName.trim(), createIfMissing, created_by: user?.id },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.message || "Erro desconhecido");
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      resetAddForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAdmin = useMutation({
    mutationFn: async ({ userId, updates, auditAction }: { userId: string; updates: Record<string, any>; auditAction?: string }) => {
      const { error } = await supabase
        .from("admin_users")
        .update(updates)
        .eq("user_id", userId);
      if (error) throw error;
      // Audit log
      if (auditAction) {
        await supabase.from("admin_audit_logs").insert({
          admin_user_id: user!.id,
          action: auditAction,
          metadata: { target_user_id: userId, updates },
        });
      }
    },
    onSuccess: () => {
      toast.success("Administrador atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      setEditAdmin(null);
      setConfirmAction(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const activeAdmins = admins?.filter(a => a.status === "ativo") || [];
      if (activeAdmins.length <= 1) throw new Error("Não é possível remover o último administrador ativo");
      // Audit log before delete
      await supabase.from("admin_audit_logs").insert({
        admin_user_id: user!.id,
        action: "admin_remove",
        metadata: { target_user_id: userId },
      });
      const { error } = await supabase
        .from("admin_users")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Administrador removido");
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      setConfirmAction(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Helpers ───
  const resetAddForm = () => {
    setIsAddOpen(false);
    setNewEmail("");
    setNewName("");
    setNewRole("admin");
    setCreateIfMissing(false);
  };

  const filtered = useMemo(() => {
    if (!admins) return [];
    if (!search.trim()) return admins;
    const q = search.toLowerCase();
    return admins.filter(
      (a) =>
        a.email?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.user_id?.toLowerCase().includes(q)
    );
  }, [admins, search]);

  // ─── Stats ───
  const stats = useMemo(() => {
    if (!admins) return { total: 0, superAdmins: 0, active: 0, suspended: 0 };
    return {
      total: admins.length,
      superAdmins: admins.filter(a => a.role === "super_admin").length,
      active: admins.filter(a => a.status === "ativo").length,
      suspended: admins.filter(a => a.status === "suspenso").length,
    };
  }, [admins]);

  const getRoleMeta = (role: string) => ROLES.find(r => r.value === role) || ROLES[1];

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success("ID copiado");
  };

  // ─── Loading / Error ───
  if (myLevelLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (myLevelError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="py-6 text-center space-y-2">
          <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
          <p className="text-sm text-destructive font-medium">Erro ao verificar nível de admin</p>
          <p className="text-xs text-muted-foreground">{(myLevelError as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Administradores
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os administradores do sistema
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) resetAddForm(); else setIsAddOpen(true); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Administrador</DialogTitle>
                <DialogDescription>
                  Preencha os dados do novo administrador do sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1">
                  <Label htmlFor="add-name">Nome</Label>
                  <Input id="add-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do administrador" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-email">Email</Label>
                  <Input id="add-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@exemplo.com" />
                </div>
                <div className="space-y-1">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          <span className="flex items-center gap-2">
                            <r.icon className="h-3.5 w-3.5" />
                            {r.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="createIfMissing" checked={createIfMissing} onCheckedChange={(c) => setCreateIfMissing(c === true)} />
                  <Label htmlFor="createIfMissing" className="text-sm">Criar usuário e enviar convite se não existir</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetAddForm}>Cancelar</Button>
                <Button onClick={() => addAdmin.mutate()} disabled={!newEmail.trim() || addAdmin.isPending}>
                  {addAdmin.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Info for non-super */}
      {!isSuperAdmin && (
        <Card className="bg-muted/50 border-muted">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Você é <strong>{getRoleMeta(myLevel || "admin").label}</strong>. Ações de gerenciamento são restritas ao Super Admin.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.superAdmins}</p>
                <p className="text-xs text-muted-foreground">Super Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-green-500/10">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-destructive/10">
                <UserX className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.suspended}</p>
                <p className="text-xs text-muted-foreground">Suspensos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, email ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/30">
          <CardContent className="py-4 flex items-center justify-between">
            <p className="text-sm text-destructive">{(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-1" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              {search ? "Nenhum admin encontrado para essa busca" : "Nenhum administrador cadastrado"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {!isLoading && !error && filtered.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Último acesso</TableHead>
                  <TableHead className="hidden md:table-cell">Criado em</TableHead>
                  <TableHead className="hidden lg:table-cell">Criado por</TableHead>
                  {isSuperAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((admin) => {
                  const roleMeta = getRoleMeta(admin.role);
                  const RoleIcon = roleMeta.icon;
                  return (
                    <TableRow key={admin.user_id} className={admin.status !== "ativo" ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{admin.name || "—"}</TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyId(admin.email || admin.user_id)}
                          className="text-sm hover:underline text-left"
                          title="Copiar"
                        >
                          {admin.email || "—"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleMeta.color}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {roleMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {admin.status === "ativo" && <Badge variant="default"><ShieldCheck className="h-3 w-3 mr-1" />Ativo</Badge>}
                        {admin.status === "suspenso" && <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Suspenso</Badge>}
                        {admin.status === "removido" && <Badge variant="outline"><Trash2 className="h-3 w-3 mr-1" />Removido</Badge>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {admin.last_access_at ? format(new Date(admin.last_access_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {admin.user_created_at ? format(new Date(admin.user_created_at), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {admin.created_by_email || "—"}
                      </TableCell>
                      {isSuperAdmin && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setEditAdmin(admin);
                                setNewName(admin.name || "");
                                setNewRole(admin.role);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {admin.status === "ativo" && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ type: "suspend", admin })}>
                                  <Ban className="h-4 w-4 mr-2" /> Suspender
                                </DropdownMenuItem>
                              )}
                              {admin.status === "suspenso" && (
                                <DropdownMenuItem onClick={() => setConfirmAction({ type: "reactivate", admin })}>
                                  <RotateCcw className="h-4 w-4 mr-2" /> Reativar
                                </DropdownMenuItem>
                              )}
                              {admin.status !== "removido" && (
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setConfirmAction({ type: "remove", admin })}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Remover
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editAdmin} onOpenChange={(open) => { if (!open) setEditAdmin(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Administrador</DialogTitle>
            <DialogDescription>{editAdmin?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome" />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-2">
                        <r.icon className="h-3.5 w-3.5" />
                        {r.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAdmin(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editAdmin) return;
                updateAdmin.mutate({
                  userId: editAdmin.user_id,
                  updates: {
                    name: newName.trim() || null,
                    role: newRole,
                    level: newRole === "super_admin" ? "master" : "standard",
                  },
                  auditAction: editAdmin.role !== newRole ? "admin_role_change" : "admin_update",
                });
              }}
              disabled={updateAdmin.isPending}
            >
              {updateAdmin.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "remove" && "Remover administrador"}
              {confirmAction?.type === "suspend" && "Suspender administrador"}
              {confirmAction?.type === "reactivate" && "Reativar administrador"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "remove" && `Tem certeza que deseja remover ${confirmAction.admin.email || confirmAction.admin.name}?`}
              {confirmAction?.type === "suspend" && `Tem certeza que deseja suspender o acesso de ${confirmAction.admin.email || confirmAction.admin.name}?`}
              {confirmAction?.type === "reactivate" && `Deseja reativar o acesso de ${confirmAction.admin.email || confirmAction.admin.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.type === "remove" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.type === "remove") {
                  removeAdmin.mutate(confirmAction.admin.user_id);
                } else if (confirmAction.type === "suspend") {
                  updateAdmin.mutate({ userId: confirmAction.admin.user_id, updates: { status: "suspenso" }, auditAction: "admin_suspend" });
                } else if (confirmAction.type === "reactivate") {
                  updateAdmin.mutate({ userId: confirmAction.admin.user_id, updates: { status: "ativo" }, auditAction: "admin_reactivate" });
                }
              }}
            >
              {(removeAdmin.isPending || updateAdmin.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
