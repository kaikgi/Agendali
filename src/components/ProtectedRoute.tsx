import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading: authLoading, clearLocalSession } = useAuth();
  const { profile, isLoading: profileLoading, error: profileError } = useProfile();
  const location = useLocation();

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Verificando acesso...</p>
      </div>
    );
  }

  // Handle profile fetch error (potential session corruption)
  if (profileError) {
    console.error('[ProtectedRoute] Profile error:', profileError);
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-3 bg-destructive/10 rounded-full w-fit mx-auto">
            <RefreshCw className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Erro de Autenticação</h2>
            <p className="text-muted-foreground text-sm">
              Não conseguimos validar sua sessão. Isso pode acontecer se sua conexão cair ou se os dados do navegador estiverem corrompidos.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              Tentar Recarregar
            </Button>
            <Button variant="outline" onClick={() => clearLocalSession()} className="w-full">
              Limpar Sessão e Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block customers from accessing establishment dashboard
  if (profile?.account_type === 'customer') {
    return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
}
