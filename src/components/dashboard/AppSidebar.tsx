import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCircle,
  Scissors,
  BarChart3,
  Settings,
  LogOut,
  ExternalLink,
  Clock,
  CalendarOff,
  Copy,
  Check,
  CreditCard,
  Star,
  Zap,
  Percent,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAccess } from '@/hooks/useAdmin';
import { useUserEstablishment } from '@/hooks/useUserEstablishment';
import { usePlanFeatures } from '@/hooks/useFeatureAccess';
import type { FeatureFlag } from '@/lib/planEntitlements';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getPublicUrl, PUBLIC_BASE_URL } from '@/lib/publicUrl';

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  requiredFeature?: FeatureFlag;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Agenda', url: '/dashboard/agenda', icon: Calendar },
  { title: 'Clientes', url: '/dashboard/clientes', icon: UserCircle },
  { title: 'Profissionais', url: '/dashboard/profissionais', icon: Users },
  { title: 'Serviços', url: '/dashboard/servicos', icon: Scissors },
  { title: 'Comissões', url: '/dashboard/comissoes', icon: Percent, requiredFeature: 'commissions' },
  { title: 'Relatórios', url: '/dashboard/relatorios', icon: BarChart3, requiredFeature: 'advanced_reports' },
  { title: 'Pagamentos', url: '/dashboard/pagamentos', icon: CreditCard },
  { title: 'Horários', url: '/dashboard/horarios', icon: Clock },
  { title: 'Bloqueios', url: '/dashboard/bloqueios', icon: CalendarOff },
  { title: 'Avaliações', url: '/dashboard/avaliacoes', icon: Star },
  { title: 'Assinatura', url: '/dashboard/assinatura', icon: Zap },
  { title: 'Configurações', url: '/dashboard/configuracoes', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut } = useAuth();
  const { data: establishment } = useUserEstablishment();
  const { data: adminAccess } = useAdminAccess();
  const { features } = usePlanFeatures();
  const { state } = useSidebar();
  const { toast } = useToast();
  const collapsed = state === 'collapsed';
  const [copied, setCopied] = useState(false);
  const isAdmin = adminAccess?.isAdmin ?? false;

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!establishment?.slug) return;
    
    // Use single source of truth for public URL
    const link = getPublicUrl(establishment.slug);
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast({ title: 'Link copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 flex-shrink-0">
            {establishment?.logo_url ? (
              <AvatarImage src={establishment.logo_url} alt={establishment.name} />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-sm">
              {establishment?.name?.charAt(0).toUpperCase() || 'A'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-sm truncate">
                {establishment?.name || 'AgendaI'}
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const locked = item.requiredFeature && !features[item.requiredFeature];
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      tooltip={locked ? `${item.title} (upgrade necessário)` : item.title}
                    >
                      <Link to={item.url} className={cn(locked && 'opacity-60')}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {locked && !collapsed && (
                          <Lock className="h-3 w-3 ml-auto text-muted-foreground" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {establishment && (
          <SidebarGroup>
            <SidebarGroupLabel>Link Público</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex items-center gap-1">
                    <SidebarMenuButton
                      asChild
                      tooltip="Abrir página de agendamento"
                      className="flex-1"
                    >
                      <a
                        href={getPublicUrl(establishment.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="truncate">/{establishment.slug}</span>
                      </a>
                    </SidebarMenuButton>
                    {!collapsed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleCopyLink}
                        title="Copiar link"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        {isAdmin && (
          <Link to="/admin">
            <Button
              variant="default"
              size={collapsed ? "icon" : "default"}
              className={cn(
                "w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-md",
                collapsed && "justify-center"
              )}
              title="Painel Super Admin"
            >
              <Zap className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Painel Super Admin</span>}
            </Button>
          </Link>
        )}
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {establishment?.name || 'Minha conta'}
              </p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="flex-shrink-0"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
