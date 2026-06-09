import { useEffect, useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CompletionPromptDialog } from '@/components/completion/CompletionPromptDialog';
import { NotificationBell } from './NotificationBell';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { BlockedAccessModal } from './BlockedAccessModal';
import { getPlanEntitlements } from '@/lib/planEntitlements';
import { useAdminAccess } from '@/hooks/useAdmin';
import { useProfile } from '@/hooks/useProfile';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardLayout() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError } = useProfile();
  const { data: establishment, isLoading: estLoading, error: estError } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading, error: subError } = useSubscription();
  const { data: adminAccess, isLoading: adminLoading, error: adminError } = useAdminAccess();

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (authLoading || profileLoading || estLoading || subLoading || adminLoading) {
        console.warn('[DashboardLayout] Data loading timeout reached');
        setTimedOut(true);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [authLoading, profileLoading, estLoading, subLoading, adminLoading]);

  const isActuallyLoading = (authLoading || profileLoading || estLoading || subLoading || adminLoading) && !timedOut;

  if (isActuallyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando painel...</p>
          <div className="text-[10px] text-muted-foreground opacity-50 flex flex-col items-center gap-1">
            {estLoading && <span>Carregando dados da empresa...</span>}
            {subLoading && <span>Verificando assinatura...</span>}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle critical establishment error
  if (estError || subError || adminError || profileError) {
    const error = estError || subError || adminError || profileError;
    const errorMsg = (error as any)?.message || 'Erro de conexão';
    
    // Safety check for session issues in internal routes
    const isAuthError = errorMsg.toLowerCase().includes('jwt') || 
                       errorMsg.toLowerCase().includes('refresh_token') ||
                       errorMsg.toLowerCase().includes('session_not_found');

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Erro ao carregar dados</h2>
            <p className="text-muted-foreground text-sm">
              {isAuthError 
                ? 'Sua sessão expirou ou é inválida. Por favor, saia e entre novamente.'
                : 'Não conseguimos recuperar os dados necessários no momento. Verifique sua conexão.'}
            </p>
            <div className="text-xs font-mono bg-muted p-2 rounded break-all mt-4 max-h-20 overflow-y-auto">
              {errorMsg}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              Tentar novamente
            </Button>
            {isAuthError && (
              <Button variant="outline" onClick={() => (window as any).location.href = '/login'} className="w-full">
                Ir para Login
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Determine if access is blocked
  const estStatus = (establishment as any)?.status || '';
  const subStatus = subscription?.status || '';
  const planCode = subscription?.plan_code || subscription?.plan || (establishment as any)?.plano;
  const periodEnd = subscription?.current_period_end;
  const trialEndsAt = (establishment as any)?.trial_ends_at;

  const entitlements = getPlanEntitlements(subStatus || estStatus, planCode, periodEnd, trialEndsAt);
  
  // Access is blocked if the plan label is "Sem plano" (meaning invalid/expired status)
  // Super Admin is never blocked.
  const isSuperAdmin = adminAccess?.isAdmin;
  const isBlocked = !isSuperAdmin && establishment && entitlements.professionalLimit === 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 bg-background sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationBell />
          </header>
          <div className="flex-1 p-4 sm:p-6 overflow-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Payment Blocked Paywall */}
      {isBlocked && <BlockedAccessModal reason={estStatus || 'no_establishment'} />}

      {/* Completion Prompt Dialog */}
      <CompletionPromptDialog 
        establishmentId={establishment?.id} 
        userType="establishment" 
      />
    </SidebarProvider>
  );
}
