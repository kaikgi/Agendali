import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

interface ClientProtectedRouteProps {
  children: React.ReactNode;
}

export function ClientProtectedRoute({ children }: ClientProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const location = useLocation();

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Verificando acesso do cliente...</p>
      </div>
    );
  }

  if (!user) {
    console.log('[ClientProtectedRoute] No user found, redirecting to client login');
    return <Navigate to="/cliente/login" state={{ from: location }} replace />;
  }

  // Block establishment owners from accessing client area
  if (profile?.account_type === 'establishment_owner') {
    console.warn('[ClientProtectedRoute] Establishment owner tried to access client area');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
