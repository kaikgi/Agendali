import { Outlet } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { CompletionPromptDialog } from '@/components/completion/CompletionPromptDialog';
import { NotificationBell } from './NotificationBell';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { BlockedAccessModal } from './BlockedAccessModal';

export function DashboardLayout() {
  const { user } = useAuth();
  const { data: establishment } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  // Determine if access is blocked
  const estStatus = (establishment as any)?.status || '';
  const subStatus = subscription?.status || '';
  const isBlocked = !subLoading && (
    !establishment ||
    estStatus === 'past_due' ||
    estStatus === 'canceled' ||
    (subStatus !== 'active' && estStatus !== 'active')
  );

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
      {!subLoading && isBlocked && <BlockedAccessModal reason={estStatus || 'no_establishment'} />}

      {/* Completion Prompt Dialog */}
      <CompletionPromptDialog 
        establishmentId={establishment?.id} 
        userType="establishment" 
      />
    </SidebarProvider>
  );
}
