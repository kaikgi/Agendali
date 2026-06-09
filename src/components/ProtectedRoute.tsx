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

  console.log('[ProtectedRoute] Rendering:', { 
    authLoading, 
    profileLoading, 
    hasUser: !!user, 
    hasProfile: !!profile,
    profileError: profileError?.message,
    path: location.pathname 
  });

  // Use a ref to track if we've already timed out
  const [timedOut, setTimedOut] = (window as any).React.useState(false);

  (window as any).React.useEffect(() => {
    const timer = setTimeout(() => {
      if (authLoading || profileLoading) {
        console.warn('[ProtectedRoute] Loading timeout reached');
        setTimedOut(true);
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [authLoading, profileLoading]);

  if ((authLoading || profileLoading) && !timedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Verificando acesso...</p>
        <div className="text-[10px] text-muted-foreground opacity-50 mt-4 flex flex-col items-center gap-1">
          <span>{authLoading ? "Aguardando autenticação..." : "Carregando perfil..."}</span>
          <button 
            onClick={() => window.location.reload()}
            className="underline hover:text-primary mt-2"
          >
            Recarregar página se travar
          </button>
        </div>
      </div>
    );
  }

  // Handle profile fetch error (potential session corruption) or timeout
  if (profileError || (timedOut && (authLoading || profileLoading))) {
    console.error('[ProtectedRoute] Access verification failed:', { profileError, timedOut, authLoading, profileLoading });
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-3 bg-destructive/10 rounded-full w-fit mx-auto">
            <RefreshCw className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Erro de Carregamento</h2>
            <p className="text-muted-foreground text-sm">
              Não conseguimos validar seu acesso ou carregar seu perfil. Isso pode ocorrer por instabilidade na rede ou sessão expirada.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} className="w-full">
              Tentar Recarregar
            </Button>
            <Button variant="outline" onClick={() => (window as any).location.href = '/login'} className="w-full">
              Voltar ao Login
            </Button>
            <Button variant="ghost" onClick={() => clearLocalSession()} className="w-full text-xs text-muted-foreground">
              Limpar dados locais e sair
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
