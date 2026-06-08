import { Outlet, NavLink, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Building2, 
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Skull,
  Users,
  Shield,
  Webhook,
  CreditCard,
  ScrollText,
  Mail,
  Send,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPermissions, type AdminPermission } from "@/hooks/useAdminPermissions";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const adminNavItems: { to: string; label: string; icon: React.ComponentType<any>; end: boolean; danger?: boolean; permission: AdminPermission }[] = [
  { to: "/admin", label: "Visão Geral", icon: LayoutDashboard, end: true, permission: "view_dashboard" },
  { to: "/admin/estabelecimentos", label: "Estabelecimentos", icon: Building2, end: false, permission: "view_establishments" },
  { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard, end: false, permission: "view_subscriptions" },
  { to: "/admin/admins", label: "Administradores", icon: Users, end: false, permission: "view_admins" },
  { to: "/admin/emails-autorizados", label: "Emails Autorizados", icon: Mail, end: false, permission: "view_allowed_emails" },
  { to: "/admin/webhooks", label: "Webhooks", icon: Webhook, end: false, permission: "view_webhooks" },
  { to: "/admin/auditoria", label: "Auditoria", icon: ScrollText, end: false, permission: "view_audit_logs" },
  { to: "/admin/disparos", label: "Disparos", icon: Send, end: false, permission: "view_broadcasts" },
  { to: "/admin/legal", label: "Documentos Legais", icon: Shield, end: false, permission: "manage_establishments" },
  { to: "/admin/danger-zone", label: "Danger Zone", icon: Skull, end: false, danger: true, permission: "view_danger_zone" },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  support: "Suporte",
  finance: "Financeiro",
  developer: "Dev",
};

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role, hasPermission } = useAdminPermissions();

  const visibleItems = adminNavItems.filter(item => hasPermission(item.permission));

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const roleLabel = ROLE_LABELS[role || ""] || "Admin";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-bold text-white tracking-wide">{roleLabel}</span>
        </div>
        <Button variant="ghost" size="icon" className="text-zinc-300 hover:text-white hover:bg-zinc-800" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </header>

      {/* Dark Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-200 ease-in-out flex flex-col",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo Area */}
        <div className="hidden lg:flex h-16 items-center px-5 border-b border-zinc-800 gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Shield className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <span className="text-sm font-bold text-white tracking-wide block">{roleLabel}</span>
            <span className="text-[10px] text-zinc-500 font-mono">Agendali Control</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 pt-16 lg:pt-3 space-y-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-3 pt-2 pb-1">Menu</p>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  item.danger
                    ? isActive
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
                    : isActive
                      ? "bg-zinc-800 text-white border border-zinc-700"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 space-y-1">
          <Link to="/dashboard" onClick={() => setSidebarOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">
              <ArrowLeft size={14} />
              Voltar ao Estabelecimento
            </Button>
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800" onClick={handleSignOut}>
            <LogOut size={14} />
            Sair
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
