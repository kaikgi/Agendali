import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdmin";
import { Loader2 } from "lucide-react";

export function AdminProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const { data: adminAccess, isLoading: adminLoading } = useAdminAccess();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground animate-pulse">Verificando credenciais admin...</p>
      </div>
    );
  }

  if (!user) {
    console.log('[AdminProtectedRoute] No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (!adminAccess?.isAdmin) {
    console.warn('[AdminProtectedRoute] User is not admin, redirecting to home');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;

}
