import { lazy, Suspense } from "react";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster as HookToaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ClientProtectedRoute } from "@/components/ClientProtectedRoute";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
// Public/institutional and auth pages load eagerly — these are the first thing an
// anonymous visitor (the booking page, most of our traffic) hits, so they should not
// wait on code the visitor may never need (dashboard, admin panel, client portal).
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CriarConta from "./pages/CriarConta";
import ForgotPassword from "./pages/ForgotPassword";
import Entrar from "./pages/Entrar";
import ResetPassword from "./pages/ResetPassword";
import Activate from "./pages/auth/Activate";
import ReenviarLink from "./pages/ReenviarLink";
import PublicBooking from "./pages/PublicBooking";
import ManageAppointment from "./pages/ManageAppointment";
import NotFound from "./pages/NotFound";
import Recursos from "./pages/Recursos";
import Precos from "./pages/Precos";
import Sobre from "./pages/Sobre";
import Contato from "./pages/Contato";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import PoliticaCookies from "./pages/PoliticaCookies";
import Seguranca from "./pages/Seguranca";
import SolicitacaoPrivacidade from "./pages/SolicitacaoPrivacidade";

// Everything below is behind a login (establishment dashboard, client portal,
// professional portal, admin panel) — code-split per section so each persona
// only downloads the JS their own area needs.
const DashboardLayout = lazy(() => import("./components/dashboard/DashboardLayout").then((m) => ({ default: m.DashboardLayout })));
const DashboardHome = lazy(() => import("./pages/dashboard/DashboardHome"));
const Agenda = lazy(() => import("./pages/dashboard/Agenda"));
const Clientes = lazy(() => import("./pages/dashboard/Clientes"));
const Profissionais = lazy(() => import("./pages/dashboard/Profissionais"));
const Servicos = lazy(() => import("./pages/dashboard/Servicos"));
const Horarios = lazy(() => import("./pages/dashboard/Horarios"));
const Bloqueios = lazy(() => import("./pages/dashboard/Bloqueios"));
const Avaliacoes = lazy(() => import("./pages/dashboard/Avaliacoes"));
const Configuracoes = lazy(() => import("./pages/dashboard/Configuracoes"));
const Assinatura = lazy(() => import("./pages/dashboard/Assinatura"));
const Comissoes = lazy(() => import("./pages/dashboard/Comissoes"));
const Pagamentos = lazy(() => import("./pages/dashboard/Pagamentos"));
const Relatorios = lazy(() => import("./pages/dashboard/Relatorios"));

const ClientLayout = lazy(() => import("./pages/client/ClientLayout"));
const ClientDashboard = lazy(() => import("./pages/client/ClientDashboard"));
const ClientAppointments = lazy(() => import("./pages/client/ClientAppointments"));
const ClientProfile = lazy(() => import("./pages/client/ClientProfile"));
const ClientHistory = lazy(() => import("./pages/client/ClientHistory"));
const ClientLogin = lazy(() => import("./pages/client/ClientLogin"));
const ClientSignup = lazy(() => import("./pages/client/ClientSignup"));
const ClientSearch = lazy(() => import("./pages/client/ClientSearch"));
const ClientForgotPassword = lazy(() => import("./pages/client/ClientForgotPassword"));
const ClientResetPassword = lazy(() => import("./pages/client/ClientResetPassword"));

const ProfessionalPortalLogin = lazy(() => import("./pages/professional/ProfessionalPortalLogin"));
const ProfessionalPortalAgenda = lazy(() => import("./pages/professional/ProfessionalPortalAgenda"));

const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminEstablishments = lazy(() => import("./pages/admin/AdminEstablishments"));
const AdminEstablishmentDetail = lazy(() => import("./pages/admin/AdminEstablishmentDetail"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminAdmins = lazy(() => import("./pages/admin/AdminAdmins"));
const AdminDangerZone = lazy(() => import("./pages/admin/AdminDangerZone"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminWhatsAppAnalytics = lazy(() => import("./pages/admin/AdminWhatsAppAnalytics"));
const AdminBroadcasts = lazy(() => import("./pages/admin/AdminBroadcasts"));
const AdminAllowedEmails = lazy(() => import("./pages/admin/AdminAllowedEmails"));
const AdminWebhooks = lazy(() => import("./pages/admin/AdminWebhooks"));
const AdminSettingsSaaS = lazy(() => import("./pages/admin/AdminSettingsSaaS"));
const AdminLegalDocuments = lazy(() => import("./pages/admin/AdminLegalDocuments"));
const AdminDiagnostics = lazy(() => import("./pages/admin/AdminDiagnostics"));
import { AdminPermissionGuard } from "./components/AdminPermissionGuard";
const ResponsiveTestPage = lazy(() => import("./pages/dev/ResponsiveTest"));

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SonnerToaster />
        <HookToaster />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              {/* Home */}
              <Route path="/" element={<Index />} />
              
              {/* Institutional pages */}
              <Route path="/recursos" element={<Recursos />} />
              <Route path="/precos" element={<Precos />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/contato" element={<Contato />} />
              <Route path="/termos" element={<Termos />} />
              <Route path="/privacidade" element={<Privacidade />} />
              <Route path="/politica-de-cookies" element={<PoliticaCookies />} />
              <Route path="/seguranca" element={<Seguranca />} />
              <Route path="/privacidade/solicitacao" element={<SolicitacaoPrivacidade />} />
              
              {/* Dev tools */}
              <Route path="/dev/responsive" element={<ResponsiveTestPage />} />
              
              {/* Auth pages */}
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Signup />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/criar-conta" element={<CriarConta />} />
              <Route path="/esqueci-senha" element={<ForgotPassword />} />
              <Route path="/resetar-senha" element={<ResetPassword />} />
              <Route path="/auth/activate" element={<Activate />} />
              <Route path="/reenviar-link" element={<ReenviarLink />} />
              
              {/* Client Login & Signup */}
              <Route path="/cliente/login" element={<ClientLogin />} />
              <Route path="/cliente/cadastro" element={<ClientSignup />} />
              <Route path="/cliente/signup" element={<ClientSignup />} />
              <Route path="/cliente/esqueci-senha" element={<ClientForgotPassword />} />
              <Route path="/cliente/resetar-senha" element={<ClientResetPassword />} />
              <Route path="/client/login" element={<ClientLogin />} />
              <Route path="/client/signup" element={<ClientSignup />} />
              
              {/* Client Portal (protected) */}
              <Route
                path="/client"
                element={
                  <ClientProtectedRoute>
                    <ClientLayout />
                  </ClientProtectedRoute>
                }
              >
                <Route index element={<ClientDashboard />} />
                <Route path="search" element={<ClientSearch />} />
                <Route path="appointments" element={<ClientAppointments />} />
                <Route path="history" element={<ClientHistory />} />
                <Route path="profile" element={<ClientProfile />} />
              </Route>
              
              {/* Establishment Dashboard (protected) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardHome />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="profissionais" element={<Profissionais />} />
                <Route path="servicos" element={<Servicos />} />
                <Route path="horarios" element={<Horarios />} />
                <Route path="bloqueios" element={<Bloqueios />} />
                <Route path="avaliacoes" element={<Avaliacoes />} />
                <Route path="assinatura" element={<Assinatura />} />
                <Route path="comissoes" element={<Comissoes />} />
                <Route path="pagamentos" element={<Pagamentos />} />
                <Route path="relatorios" element={<Relatorios />} />
                <Route path="configuracoes" element={<Configuracoes />} />
              </Route>
              
              {/* Admin Panel (protected) */}
              <Route path="/admin-panel" element={<Navigate to="/admin" replace />} />
              <Route path="/admin" element={<AdminProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="estabelecimentos" element={<AdminPermissionGuard permission="view_establishments"><AdminEstablishments /></AdminPermissionGuard>} />
                  <Route path="estabelecimentos/:id" element={<AdminPermissionGuard permission="view_establishments"><AdminEstablishmentDetail /></AdminPermissionGuard>} />
                  <Route path="configuracoes" element={<AdminPermissionGuard permission="manage_establishments"><AdminSettingsSaaS /></AdminPermissionGuard>} />
                  <Route path="mensagens" element={<AdminMessages />} />
                  <Route path="assinaturas" element={<AdminPermissionGuard permission="view_subscriptions"><AdminSubscriptions /></AdminPermissionGuard>} />
                  <Route path="admins" element={<AdminPermissionGuard permission="view_admins"><AdminAdmins /></AdminPermissionGuard>} />
                  <Route path="auditoria" element={<AdminPermissionGuard permission="view_audit_logs"><AdminAuditLogs /></AdminPermissionGuard>} />
                  <Route path="whatsapp" element={<AdminWhatsAppAnalytics />} />
                  <Route path="disparos" element={<AdminPermissionGuard permission="view_broadcasts"><AdminBroadcasts /></AdminPermissionGuard>} />
                  <Route path="emails-autorizados" element={<AdminPermissionGuard permission="view_allowed_emails"><AdminAllowedEmails /></AdminPermissionGuard>} />
                  <Route path="webhooks" element={<AdminPermissionGuard permission="view_webhooks"><AdminWebhooks /></AdminPermissionGuard>} />
                  <Route path="legal" element={<AdminPermissionGuard permission="manage_establishments"><AdminLegalDocuments /></AdminPermissionGuard>} />
                  <Route path="danger-zone" element={<AdminPermissionGuard permission="view_danger_zone"><AdminDangerZone /></AdminPermissionGuard>} />
                  <Route path="diagnostico" element={<AdminDiagnostics />} />
                </Route>
              </Route>
              
              {/* Professional Portal */}
              <Route path="/:establishmentSlug/p/:professionalSlug" element={<ProfessionalPortalLogin />} />
              <Route path="/:establishmentSlug/p/:professionalSlug/agenda" element={<ProfessionalPortalAgenda />} />
              
              {/* Public booking routes - MUST be last */}
              <Route path="/agendar/:slug" element={<PublicBooking />} />
              <Route path="/agendar/:slug/gerenciar/:token" element={<ManageAppointment />} />
              <Route path="/:slug" element={<PublicBooking />} />
              <Route path="/:slug/gerenciar/:token" element={<ManageAppointment />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
