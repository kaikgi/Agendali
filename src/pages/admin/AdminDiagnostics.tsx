import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUserEstablishment } from "@/hooks/useUserEstablishment";
import { useSubscription } from "@/hooks/useSubscription";
import { useAdminAccess, useAdminStats } from "@/hooks/useAdmin";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { getPlanEntitlements } from "@/lib/planEntitlements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, ShieldAlert, User, Building, CreditCard, Lock, Activity } from "lucide-react";

export default function AdminDiagnostics() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: establishment, isLoading: estLoading, error: estError } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading, error: subError } = useSubscription();
  const { data: adminAccess, isLoading: adminLoading } = useAdminAccess();
  const { role: adminRole, isLoading: permissionsLoading, permissions } = useAdminPermissions();
  const { data: adminStats, isLoading: statsLoading, error: statsError } = useAdminStats();

  const entitlements = establishment ? getPlanEntitlements(
    subscription?.status || establishment?.status,
    subscription?.plan_code || establishment?.plano,
    subscription?.current_period_end,
    (establishment as any)?.trial_ends_at
  ) : null;

  const isLoading = authLoading || profileLoading || estLoading || subLoading || adminLoading || permissionsLoading;

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3">Carregando diagnóstico...</span>
      </div>
    );
  }

  if (!adminAccess?.isAdmin) {
    return (
      <div className="p-8 text-center space-y-4">
        <Lock className="h-12 w-12 text-destructive mx-auto" />
        <h1 className="text-2xl font-bold">Acesso Negado</h1>
        <p className="text-muted-foreground">Esta ferramenta é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Sistema de Diagnóstico
          </h1>
          <p className="text-muted-foreground">Visão técnica profunda do seu usuário e contexto</p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          v1.0.0
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Auth & Profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              Autenticação & Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono text-xs">{user?.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Account Type:</span>
              <Badge variant="secondary">{profile?.account_type || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Admin Role:</span>
              <Badge variant={adminRole !== 'none' ? 'default' : 'outline'}>{adminRole}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Establishment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building className="h-4 w-4 text-emerald-500" />
              Estabelecimento Atual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {estError ? (
              <div className="text-destructive text-xs p-2 bg-destructive/10 rounded">
                Erro: {(estError as any).message}
              </div>
            ) : establishment ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-mono text-xs truncate ml-2">{establishment.id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{establishment.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Slug:</span>
                  <span className="font-medium">/{establishment.slug}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status DB:</span>
                  <Badge variant={establishment.status === 'active' ? 'default' : 'destructive'}>
                    {establishment.status}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhum estabelecimento vinculado.</p>
            )}
          </CardContent>
        </Card>

        {/* Subscription & Plan */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-500" />
              Plano & Assinatura
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subError ? (
              <div className="text-destructive text-xs p-2 bg-destructive/10 rounded">
                Erro: {(subError as any).message}
              </div>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Plano Efetivo:</span>
                  <span className="font-bold">{entitlements?.planLabel || 'Nenhum'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status Sub:</span>
                  <Badge variant={subscription?.status === 'active' ? 'default' : 'secondary'}>
                    {subscription?.status || 'Nenhuma'}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Limite Profissionais:</span>
                  <span className="font-medium">{entitlements?.professionalLimit === Infinity ? 'Ilimitado' : entitlements?.professionalLimit}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Fim Período:</span>
                  <span className="text-xs">{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="permissions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="permissions">Permissões Admin</TabsTrigger>
          <TabsTrigger value="queries">Status das Queries</TabsTrigger>
        </TabsList>
        
        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Capacidades de {adminRole}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {permissions.length > 0 ? (
                  permissions.map((p) => (
                    <Badge key={p} variant="outline" className="bg-primary/5 border-primary/20">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                      {p}
                    </Badge>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">Nenhuma permissão especial concedida.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-orange-500" />
                API Edge Functions (admin-data)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Admin Stats</p>
                  {statsError ? (
                    <div className="text-destructive text-xs p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Falha na query:</p>
                        <p className="font-mono mt-1 break-all">{(statsError as any).message}</p>
                      </div>
                    </div>
                  ) : adminStats ? (
                    <div className="text-xs p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-300">
                      Query OK! Retornou {adminStats.total_establishments} estabelecimentos.
                    </div>
                  ) : (
                    <div className="text-xs p-3 bg-muted rounded-lg italic text-muted-foreground">
                      Query habilitada mas sem dados retornados (null).
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Contexto do Navegador</p>
                  <ScrollArea className="h-32 rounded-md border p-2">
                    <pre className="text-[10px] font-mono">
                      {JSON.stringify({
                        userAgent: navigator.userAgent,
                        location: window.location.href,
                        localStorage: Object.keys(localStorage).filter(k => k.includes('supabase')),
                        cookies: typeof document !== 'undefined' ? document.cookie.length : 0
                      }, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground italic">
          Esta ferramenta é gerada dinamicamente para depuração profunda. Nunca exponha estes dados publicamente.
        </p>
      </div>
    </div>
  );
}