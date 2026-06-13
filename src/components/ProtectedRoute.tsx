import { useEffect, useState } from 'react';
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

  // Declarado aqui para estar disponível nos useEffects abaixo
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    console.log('[PROTECTED ROUTE] logs detalhados', {
      pathname: location.pathname,
      authLoading,
      userExiste: !!user,
      profileLoading,
      profileExiste: !!profile,
      profileError: profileError?.message,
      timedOut
    });
  }, [authLoading, profileLoading, user, profile, profileError, location.pathname, timedOut]);

  useEffect(() => {
    // Only start timeout if loading is active
    if (!authLoading && !profileLoading) return;

    const timer = setTimeout(() => {
      if ((authLoading || profileLoading)) {
        console.warn('[PROTECTED ROUTE] Loading timeout reached after 12s - forcing timeout state');
        setTimedOut(true);
      }
    }, 12000);
    return () => clearTimeout(timer);
  }, [authLoading, profileLoading, user]);

  // Show loading state while auth or profile is being verified
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

  // Critical error or timeout
  if (profileError || (timedOut && (authLoading || profileLoading))) {
    const errorMsg = profileError?.message || (timedOut ? 'Tempo limite de verificação excedido (15s).' : 'Erro de carregamento');
    const isAuthError = errorMsg.toLowerCase().includes('jwt') || 
                       errorMsg.toLowerCase().includes('refresh_token') ||
                       errorMsg.toLowerCase().includes('session_not_found');

    console.error('[PROTECTED ROUTE] erro detectado', { errorMsg, timedOut, authLoading, profileLoading });
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="p-3 bg-destructive/10 rounded-full w-fit mx-auto">
            <RefreshCw className="h-10 w-10 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">Erro de Carregamento</h2>
            <p className="text-muted-foreground text-sm">
              {isAuthError 
                ? 'Sua sessão expirou ou é inválida. Por favor, faça login novamente.' 
                : 'Não conseguimos validar seu acesso. Isso pode ocorrer por instabilidade na rede ou sessão expirada.'}
            </p>
            <div className="text-[10px] font-mono bg-muted p-2 rounded break-all mt-2 opacity-70">
              ID: {user?.id || 'no-user'} | Msg: {errorMsg}
            </div>
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

  if (!user && !authLoading) {
    console.log('[PROTECTED ROUTE] redirecionando para login', { motivoDoRedirect: 'Usuário não autenticado e loading de auth finalizado' });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Block customers from accessing establishment dashboard
  if (profile?.account_type === 'customer') {
    console.log('[PROTECTED ROUTE] redirecionando para área do cliente', { motivoDoBloqueio: 'Conta de cliente tentando acessar rotas do estabelecimento' });
    return <Navigate to="/client" replace />;
  }

  return <>{children}</>;
}
