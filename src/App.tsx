import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ClientProtectedRoute } from "@/components/ClientProtectedRoute";
import { AdminProtectedRoute } from "@/components/AdminProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CriarConta from "./pages/CriarConta";
import ForgotPassword from "./pages/ForgotPassword";
import Entrar from "./pages/Entrar";
import ResetPassword from "./pages/ResetPassword";
import Activate from "./pages/auth/Activate";
import PublicBooking from "./pages/PublicBooking";
import ManageAppointment from "./pages/ManageAppointment";
import NotFound from "./pages/NotFound";
import Recursos from "./pages/Recursos";
import Precos from "./pages/Precos";
import Sobre from "./pages/Sobre";
import Contato from "./pages/Contato";
import Termos from "./pages/Termos";
import Privacidade from "./pages/Privacidade";
import { DashboardLayout } from "./components/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import Agenda from "./pages/dashboard/Agenda";
import Clientes from "./pages/dashboard/Clientes";
import Profissionais from "./pages/dashboard/Profissionais";
import Servicos from "./pages/dashboard/Servicos";
import Horarios from "./pages/dashboard/Horarios";
import Bloqueios from "./pages/dashboard/Bloqueios";
import Avaliacoes from "./pages/dashboard/Avaliacoes";
import Configuracoes from "./pages/dashboard/Configuracoes";
import Assinatura from "./pages/dashboard/Assinatura";
import Comissoes from "./pages/dashboard/Comissoes";
import Pagamentos from "./pages/dashboard/Pagamentos";
import ClientLayout from "./pages/client/ClientLayout";
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientAppointments from "./pages/client/ClientAppointments";
import ClientProfile from "./pages/client/ClientProfile";
import ClientHistory from "./pages/client/ClientHistory";
import ClientLogin from "./pages/client/ClientLogin";
import ClientSignup from "./pages/client/ClientSignup";
import ClientSearch from "./pages/client/ClientSearch";
import ClientForgotPassword from "./pages/client/ClientForgotPassword";
import ClientResetPassword from "./pages/client/ClientResetPassword";
import ProfessionalPortalLogin from "./pages/professional/ProfessionalPortalLogin";
import ProfessionalPortalAgenda from "./pages/professional/ProfessionalPortalAgenda";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEstablishments from "./pages/admin/AdminEstablishments";
import AdminEstablishmentDetail from "./pages/admin/AdminEstablishmentDetail";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminAdmins from "./pages/admin/AdminAdmins";
import AdminDangerZone from "./pages/admin/AdminDangerZone";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminWhatsAppAnalytics from "./pages/admin/AdminWhatsAppAnalytics";
import AdminAllowedEmails from "./pages/admin/AdminAllowedEmails";
import AdminWebhooks from "./pages/admin/AdminWebhooks";
import AdminSettingsSaaS from "./pages/admin/AdminSettingsSaaS";
import { AdminPermissionGuard } from "./components/AdminPermissionGuard";
import ResponsiveTestPage from "./pages/dev/ResponsiveTest";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
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
              
              {/* Dev tools */}
              <Route path="/dev/responsive" element={<ResponsiveTestPage />} />
              
              {/* Auth pages */}
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Signup />} />
              <Route path="/criar-conta" element={<CriarConta />} />
              <Route path="/esqueci-senha" element={<ForgotPassword />} />
              <Route path="/resetar-senha" element={<ResetPassword />} />
              <Route path="/auth/activate" element={<Activate />} />
              
              {/* Client Login & Signup */}
              <Route path="/cliente/login" element={<ClientLogin />} />
              <Route path="/cliente/cadastro" element={<ClientSignup />} />
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
                <Route path="configuracoes" element={<Configuracoes />} />
              </Route>
              
              {/* Admin Panel (protected) */}
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
                  <Route path="emails-autorizados" element={<AdminPermissionGuard permission="view_allowed_emails"><AdminAllowedEmails /></AdminPermissionGuard>} />
                  <Route path="webhooks" element={<AdminPermissionGuard permission="view_webhooks"><AdminWebhooks /></AdminPermissionGuard>} />
                  <Route path="danger-zone" element={<AdminPermissionGuard permission="view_danger_zone"><AdminDangerZone /></AdminPermissionGuard>} />
                </Route>
              </Route>
              
              {/* Professional Portal */}
              <Route path="/:establishmentSlug/p/:professionalSlug" element={<ProfessionalPortalLogin />} />
              <Route path="/:establishmentSlug/p/:professionalSlug/agenda" element={<ProfessionalPortalAgenda />} />
              
              {/* Public booking routes - MUST be last */}
              <Route path="/:slug" element={<PublicBooking />} />
              <Route path="/:slug/gerenciar/:token" element={<ManageAppointment />} />
              
              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
