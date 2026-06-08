import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdmin";
import { Loader2 } from "lucide-react";

export function AdminProtectedRoute() {
  const { user, loading: authLoading } = useAuth();
  const { data: adminAccess, isLoading: adminLoading } = useAdminAccess();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!adminAccess?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
