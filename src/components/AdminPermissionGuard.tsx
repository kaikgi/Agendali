import { Navigate } from "react-router-dom";
import { useAdminPermissions, type AdminPermission } from "@/hooks/useAdminPermissions";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX } from "lucide-react";

interface AdminPermissionGuardProps {
  permission: AdminPermission;
  children: React.ReactNode;
}

export function AdminPermissionGuard({ permission, children }: AdminPermissionGuardProps) {
  const { hasPermission, isLoading } = useAdminPermissions();

  if (isLoading) return null;

  if (!hasPermission(permission)) {
    return (
      <Card className="border-destructive/30 max-w-lg mx-auto mt-12">
        <CardContent className="py-8 text-center space-y-3">
          <ShieldX className="h-10 w-10 mx-auto text-destructive" />
          <p className="font-semibold text-lg">Acesso negado</p>
          <p className="text-sm text-muted-foreground">
            Você não tem permissão para acessar esta seção. Entre em contato com um Super Admin.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
