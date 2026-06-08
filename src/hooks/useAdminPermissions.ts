import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type AdminRole = "super_admin" | "admin" | "support" | "finance" | "developer";

export type AdminPermission =
  | "view_dashboard"
  | "view_establishments"
  | "manage_establishments"
  | "delete_establishments"
  | "view_subscriptions"
  | "manage_subscriptions"
  | "view_admins"
  | "manage_admins"
  | "view_webhooks"
  | "view_audit_logs"
  | "view_danger_zone"
  | "manage_danger_zone"
  | "view_allowed_emails"
  | "manage_allowed_emails"
  | "view_broadcasts"
  | "manage_broadcasts";

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    "view_dashboard",
    "view_establishments", "manage_establishments", "delete_establishments",
    "view_subscriptions", "manage_subscriptions",
    "view_admins", "manage_admins",
    "view_webhooks",
    "view_audit_logs",
    "view_danger_zone", "manage_danger_zone",
    "view_allowed_emails", "manage_allowed_emails",
    "view_broadcasts", "manage_broadcasts",
  ],
  admin: [
    "view_dashboard",
    "view_establishments", "manage_establishments",
    "view_subscriptions", "manage_subscriptions",
    "view_allowed_emails", "manage_allowed_emails",
  ],
  support: [
    "view_dashboard",
    "view_establishments",
    "view_allowed_emails",
  ],
  finance: [
    "view_dashboard",
    "view_subscriptions",
    "view_establishments",
  ],
  developer: [
    "view_dashboard",
    "view_webhooks",
    "view_audit_logs",
    "view_establishments",
  ],
};

// Maps admin routes to required permissions
export const ROUTE_PERMISSIONS: Record<string, AdminPermission> = {
  "/admin": "view_dashboard",
  "/admin/estabelecimentos": "view_establishments",
  "/admin/assinaturas": "view_subscriptions",
  "/admin/admins": "view_admins",
  "/admin/webhooks": "view_webhooks",
  "/admin/auditoria": "view_audit_logs",
  "/admin/danger-zone": "view_danger_zone",
  "/admin/emails-autorizados": "view_allowed_emails",
  "/admin/disparos": "view_broadcasts",
};

export function useAdminRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-admin-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return "none";
      try {
        const { data, error } = await supabase.rpc("admin_get_my_level");
        if (error) {
          console.warn("[useAdminRole] RPC error (might not be admin):", error.message);
          return "none";
        }
        return (data as string) ?? "none";
      } catch (err) {
        return "none";
      }
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

export function useAdminPermissions() {
  const { data: role, isLoading, error } = useAdminRole();

  const permissions = role && role !== "none"
    ? ROLE_PERMISSIONS[role as AdminRole] || []
    : [];

  const hasPermission = (p: AdminPermission) => permissions.includes(p);
  const isSuperAdmin = role === "super_admin";

  return {
    role: role as AdminRole | "none" | undefined,
    isLoading,
    error,
    permissions,
    hasPermission,
    isSuperAdmin,
  };
}
