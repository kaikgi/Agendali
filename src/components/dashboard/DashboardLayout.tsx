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
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardLayout() {
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: establishment, isLoading: estLoading, error: estError, refetch: refetchEst } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: adminAccess, isLoading: adminLoading } = useAdminAccess();

  const isActuallyLoading = authLoading || profileLoading || estLoading || subLoading || adminLoading;

  if (isActuallyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Handle critical establishment error
  if (estError) {
    const errorMsg = (estError as any)?.message || 'Erro de conexão';
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Erro ao carregar estabelecimento</h2>
            <p className="text-muted-foreground text-sm">
              Não conseguimos recuperar os dados da sua empresa no momento.
            </p>
            <div className="text-xs font-mono bg-muted p-2 rounded break-all mt-4">
              {errorMsg}
            </div>
          </div>
          <Button onClick={() => refetchEst()} className="w-full">
            Tentar novamente
          </Button>
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
