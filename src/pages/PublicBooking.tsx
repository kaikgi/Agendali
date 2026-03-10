import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { useEstablishment } from '@/hooks/useEstablishment';
import { useServices, type Service } from '@/hooks/useServices';
import { useProfessionalsByService, type Professional } from '@/hooks/useProfessionals';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { ServiceStep } from '@/components/booking/ServiceStep';
import { ProfessionalStep } from '@/components/booking/ProfessionalStep';
import { DateTimeStep } from '@/components/booking/DateTimeStep';
import { CustomerStep } from '@/components/booking/CustomerStep';
import { BookingSuccess } from '@/components/booking/BookingSuccess';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerFormData } from '@/lib/validations/booking';
import { getManageAppointmentUrl, buildPublicUrl } from '@/lib/publicUrl';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePublicPlanLimits } from '@/hooks/usePlanLimits';
import { PlanLimitAlert } from '@/components/billing/PlanLimitAlert';
import { EstablishmentRatingDisplay } from '@/components/ratings/EstablishmentRatingDisplay';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sendConfirmationEmail } from '@/lib/emailNotifications';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const STEPS = ['Serviço', 'Profissional', 'Data/Hora', 'Dados'];
const BOOKING_STORAGE_KEY = 'booking_state';

type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

function formatSupabaseError(err: unknown): string {
  if (!err || typeof err !== 'object') return 'Erro desconhecido.';
  const e = err as SupabaseLikeError;
  const parts = [e.message, e.details, e.hint, e.code].filter(Boolean);
  return parts.length ? parts.join(' • ') : 'Erro desconhecido.';
}

interface BookingState {
  serviceId?: string;
  professionalId?: string;
  date?: string;
  time?: string;
  step?: number;
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  // Auth state
  const { user, session, loading: isLoadingAuth } = useAuth();
  const { profile, updateProfile } = useProfile();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [pendingCustomerData, setPendingCustomerData] = useState<CustomerFormData | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [manageToken, setManageToken] = useState<string | null>(null);

  const {
    data: establishment,
    isLoading: isLoadingEstablishment,
    error: establishmentError,
  } = useEstablishment(slug);
  const { data: canAcceptBookings, isLoading: isLoadingCanAccept } = usePublicPlanLimits(establishment?.id);
  const { data: services = [] } = useServices(establishment?.id);
  const { data: professionals = [], isLoading: isLoadingProfessionals } = useProfessionalsByService(
    selectedService?.id
  );
  const { data: slotResult, isLoading: isLoadingSlots } = useAvailableSlots({
    establishmentId: establishment?.id,
    professionalId: selectedProfessional?.id,
    serviceDurationMinutes: selectedService?.duration_minutes ?? 30,
    date: selectedDate,
    slotIntervalMinutes: establishment?.slot_interval_minutes ?? 15,
    bufferMinutes: establishment?.buffer_minutes ?? 0,
  });

  // Check if establishment is blocked due to payment status
  const isEstablishmentBlocked = (() => {
    if (!establishment) return false;
    const est = establishment as any;
    if (est.status === 'past_due' || est.status === 'canceled') return true;
    return false;
  })();
  const isAppointmentBlocked = isEstablishmentBlocked || (canAcceptBookings && !canAcceptBookings.canAccept);

  // After successful login, proceed with pending booking
  useEffect(() => {
    if (session && pendingCustomerData && !isSubmitting) {
      // User just logged in with pending booking data
      handleConfirmedSubmit(pendingCustomerData);
    }
  }, [session, pendingCustomerData]);

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setSelectedProfessional(null);
    setSelectedDate(undefined);
    setSelectedTime(null);
    setCurrentStep(1);
  };

  const handleProfessionalSelect = (professional: Professional) => {
    setSelectedProfessional(professional);
    setSelectedDate(undefined);
    setSelectedTime(null);
    setCurrentStep(2);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setCurrentStep(3);
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      
      if (error) throw error;
      
      setShowLoginModal(false);
      toast({
        title: 'Login realizado',
        description: 'Você foi autenticado com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no login',
        description: error instanceof Error ? error.message : 'Email ou senha incorretos.',
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: buildPublicUrl(`/${slug}`),
          data: {
            full_name: signupName,
            phone: signupPhone,
            account_type: 'customer',
          },
        },
      });
      
      if (error) throw error;
      
      // Profile is auto-created by database trigger (handle_new_user)
      
      setShowLoginModal(false);
      toast({
        title: 'Conta criada',
        description: 'Sua conta foi criada com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no cadastro',
        description: error instanceof Error ? error.message : 'Não foi possível criar a conta.',
      });
    } finally {
      setIsAuthLoading(false);
    }
  };


  // Called after login to complete booking
  const handleConfirmedSubmit = async (customerData: CustomerFormData) => {
    if (isSubmitting) return;
    if (!establishment || !selectedService || !selectedProfessional || !selectedDate || !selectedTime || !slug) {
      return;
    }

    setIsSubmitting(true);
    setPendingCustomerData(null);

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startAt = new Date(selectedDate);
      startAt.setHours(hours, minutes, 0, 0);

      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + selectedService.duration_minutes);

      // Get current user ID for customer_user_id
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const { data, error } = await supabase.rpc('public_create_appointment', {
        p_slug: slug,
        p_service_id: selectedService.id,
        p_professional_id: selectedProfessional.id,
        p_start_at: startAt.toISOString(),
        p_end_at: endAt.toISOString(),
        p_customer_name: customerData.name,
        p_customer_phone: customerData.phone,
        p_customer_email: customerData.email || null,
        p_customer_notes: customerData.notes || null,
        p_customer_user_id: currentUser?.id || null,
      });

      if (error) {
        console.log('RPC error:', error);
        throw new Error(error.message || 'Erro ao criar agendamento');
      }

      const result = data?.[0];
      if (result?.manage_token) {
        setManageToken(result.manage_token);
      }

      // Save reminder preference on the appointment
      if (result?.appointment_id && customerData.reminderHours != null) {
        const { error: updateErr } = await supabase
          .from('appointments')
          .update({ customer_reminder_hours: customerData.reminderHours })
          .eq('id', result.appointment_id);
        if (updateErr) console.warn('[booking] Failed to save reminder preference:', updateErr);
        else console.log('[booking] Reminder preference saved:', customerData.reminderHours);
      }

      // Create email jobs in the queue (confirmation + reminder)
      if (result?.appointment_id && customerData.email) {
        console.log('[booking] Creating email jobs...', {
          appointment_id: result.appointment_id,
          establishment_id: establishment.id,
          customer_email: customerData.email,
          customer_name: customerData.name,
          appointment_start: startAt.toISOString(),
          reminder_hours: customerData.reminderHours ?? null,
        });

        const { data: jobResult, error: jobErr } = await supabase.rpc('create_appointment_email_jobs', {
          p_appointment_id: result.appointment_id,
          p_establishment_id: establishment.id,
          p_customer_email: customerData.email,
          p_customer_name: customerData.name,
          p_appointment_start: startAt.toISOString(),
          p_customer_reminder_hours: customerData.reminderHours ?? null,
        });

        if (jobErr) {
          console.error('[booking] FAILED to create email jobs:', jobErr);
        } else {
          console.log('[booking] Email jobs created successfully:', jobResult);
        }
      } else if (result?.appointment_id && !customerData.email) {
        console.log('[booking] No customer email provided, skipping email job creation');
      }

      // Also send immediate confirmation email via edge function (fire and forget)
      if (result?.appointment_id) {
        sendConfirmationEmail(result.appointment_id).catch((emailErr) => {
          console.warn('[booking] Failed to send immediate confirmation email:', emailErr);
        });
      }

      setIsSuccess(true);
    } catch (error) {
      console.log('Booking error (raw):', error);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível concluir o agendamento. Tente novamente.';
      toast({
        variant: 'destructive',
        title: 'Erro ao agendar',
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (customerData: CustomerFormData) => {
    console.log('[booking] submit clicked', {
      slug,
      customerData,
      selectedServiceId: selectedService?.id,
      selectedProfessionalId: selectedProfessional?.id,
      selectedDate,
      selectedTime,
      session: !!session,
    });

    if (isSubmitting) return;

    if (!establishment || !selectedService || !selectedProfessional || !selectedDate || !selectedTime || !slug) {
      toast({
        variant: 'destructive',
        title: 'Campos incompletos',
        description: 'Escolha serviço, profissional, data/hora e preencha seus dados.',
      });
      return;
    }

    // Proceed directly — login is NOT required for public booking
    await handleConfirmedSubmit(customerData);
  };

  if (isLoadingEstablishment || isLoadingAuth || isLoadingCanAccept) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (establishmentError || !establishment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Estabelecimento não encontrado</h1>
        <p className="text-muted-foreground mb-6">
          O link pode estar incorreto ou o agendamento está desativado.
        </p>
        <Button asChild variant="outline">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    );
  }

  // Show friendly message if establishment is blocked
  if (isAppointmentBlocked) {
    const blockReason = isEstablishmentBlocked
      ? 'Estabelecimento temporariamente indisponível para novos agendamentos online.'
      : canAcceptBookings?.reason || 'Agendamento temporariamente indisponível.';

    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="container max-w-lg mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              {establishment.logo_url && (
                <img
                  src={establishment.logo_url}
                  alt={establishment.name}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
              )}
              <div>
                <h1 className="font-bold">{establishment.name}</h1>
                <p className="text-sm text-muted-foreground">Agendamento online</p>
              </div>
            </div>
          </div>
        </header>
        <div className="container max-w-lg mx-auto px-4 py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{isEstablishmentBlocked ? 'Agenda indisponível' : 'Agendamento temporariamente indisponível'}</AlertTitle>
            <AlertDescription>{blockReason}</AlertDescription>
          </Alert>
          <div className="text-center mt-4">
            <Button asChild variant="outline">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess && selectedService && selectedProfessional && selectedDate && selectedTime) {
    const manageUrl = manageToken && establishment.slug
      ? getManageAppointmentUrl(establishment.slug, manageToken)
      : null;

    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-lg mx-auto px-4 py-8">
          <BookingSuccess
            serviceName={selectedService.name}
            professionalName={selectedProfessional.name}
            date={selectedDate}
            time={selectedTime}
            establishmentName={establishment.name}
            manageUrl={manageUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {establishment.logo_url && (
                <img
                  src={establishment.logo_url}
                  alt={establishment.name}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
              )}
              <div>
                <h1 className="font-bold">{establishment.name}</h1>
                <p className="text-sm text-muted-foreground">Agendamento online</p>
                <EstablishmentRatingDisplay 
                  establishmentId={establishment.id} 
                  size="sm"
                  className="mt-1"
                />
              </div>
            </div>
            {session ? (
              <div className="text-sm text-muted-foreground">
                <span className="hidden sm:inline">Olá, </span>
                <span className="font-medium text-foreground">
                  {profile?.full_name || user?.email?.split('@')[0] || 'Cliente'}
                </span>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowLoginModal(true)}>
                <LogIn className="w-4 h-4 mr-2" />
                Entrar
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-lg mx-auto px-4 py-6">
        <StepIndicator currentStep={currentStep} steps={STEPS} />

        {currentStep > 0 && (
          <Button variant="ghost" size="sm" className="mb-4" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        )}

        {currentStep === 0 && (
          <ServiceStep
            services={services}
            selectedServiceId={selectedService?.id ?? null}
            onSelect={handleServiceSelect}
            establishmentId={establishment?.id}
          />
        )}

        {currentStep === 1 && (
          <ProfessionalStep
            professionals={professionals}
            selectedProfessionalId={selectedProfessional?.id ?? null}
            onSelect={handleProfessionalSelect}
            isLoading={isLoadingProfessionals}
          />
        )}

        {currentStep === 2 && (
          <DateTimeStep
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectDate={handleDateSelect}
            onSelectTime={handleTimeSelect}
            slotResult={slotResult}
            isLoadingSlots={isLoadingSlots}
            maxFutureDays={establishment.max_future_days}
          />
        )}

        {currentStep === 3 && (
          <CustomerStep 
            establishment={establishment} 
            onSubmit={handleSubmit} 
            isSubmitting={isSubmitting}
            defaultValues={
              profile ? {
                name: profile.full_name || '',
                phone: profile.phone || '',
                email: user?.email || '',
              } : undefined
            }
          />
        )}
      </main>

      {/* Login Modal */}
      <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Faça login para continuar
            </DialogTitle>
            <DialogDescription>
              Para confirmar seu agendamento, você precisa estar logado.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as 'login' | 'signup')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isAuthLoading}>
                  {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>

            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo *</Label>
                  <Input
                    id="signup-name"
                    placeholder="Seu nome"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Telefone *</Label>
                  <PhoneInput
                    id="signup-phone"
                    placeholder="(11) 99999-9999"
                    value={signupPhone}
                    onChange={(val) => setSignupPhone(val)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha *</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isAuthLoading}>
                  {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar conta e agendar
                </Button>
              </form>

            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
