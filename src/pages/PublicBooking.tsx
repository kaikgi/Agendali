import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, LogIn, AlertCircle, CheckCircle2, CreditCard, Clock, XCircle } from 'lucide-react';
import { useEstablishment } from '@/hooks/useEstablishment';
import { useServices, type Service } from '@/hooks/useServices';
import { useProfessionalsByService, type Professional } from '@/hooks/useProfessionals';
import { useAvailableSlots } from '@/hooks/useAvailableSlots';
import { usePaymentConfigForBooking, useCreatePayment } from '@/hooks/usePayments';
import { StepIndicator } from '@/components/booking/StepIndicator';
import { ServiceStep } from '@/components/booking/ServiceStep';
import { ProfessionalStep } from '@/components/booking/ProfessionalStep';
import { DateTimeStep } from '@/components/booking/DateTimeStep';
import { CustomerStep } from '@/components/booking/CustomerStep';
import { BookingSuccess } from '@/components/booking/BookingSuccess';
import { PaymentStep, calculatePaymentAmount, type PaymentConfig } from '@/components/booking/PaymentStep';
import { Button } from '@/components/ui/button';
import { PhoneInput } from '@/components/ui/phone-input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { CustomerFormData } from '@/lib/validations/booking';
import type { GeneratedTerms } from '@/lib/bookingTerms';
import { getManageAppointmentUrl, buildPublicUrl } from '@/lib/publicUrl';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePublicPlanLimits } from '@/hooks/usePlanLimits';
import { PlanLimitAlert } from '@/components/billing/PlanLimitAlert';
import { EstablishmentRatingDisplay } from '@/components/ratings/EstablishmentRatingDisplay';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength, isPasswordStrong } from '@/components/ui/password-strength';

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
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [authError, setAuthError] = useState<string | null>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [manageToken, setManageToken] = useState<string | null>(null);
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);

  // Payment return state
  const [paymentReturnStatus, setPaymentReturnStatus] = useState<'success' | 'failure' | 'pending' | null>(null);

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

  // Payment config for selected service
  const {
    data: paymentConfig,
    isLoading: isLoadingPaymentConfig,
    error: paymentConfigError,
  } = usePaymentConfigForBooking(slug, selectedService?.id);

  const createPayment = useCreatePayment();

  const requiresPayment = useMemo(() => {
    if (!paymentConfig?.enabled) return false;
    if (!selectedService?.price_cents) return false;
    return paymentConfig.deposit_required || paymentConfig.full_payment_online;
  }, [paymentConfig, selectedService]);

  // Dynamic steps based on payment requirement
  const steps = useMemo(() => {
    const base = ['Serviço', 'Profissional', 'Data/Hora', 'Dados'];
    if (requiresPayment) base.push('Pagamento');
    return base;
  }, [requiresPayment]);

  // Check if establishment is blocked
  const isEstablishmentBlocked = (() => {
    if (!establishment) return false;
    const est = establishment as any;
    if (est.status === 'past_due' || est.status === 'canceled') return true;
    return false;
  })();
  const isAppointmentBlocked = isEstablishmentBlocked || (canAcceptBookings && !canAcceptBookings.canAccept);

  // Handle payment return from Mercado Pago
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const aptId = searchParams.get('apt');

    if (paymentStatus && aptId) {
      setPaymentReturnStatus(paymentStatus as 'success' | 'failure' | 'pending');
      setCreatedAppointmentId(aptId);
      // Clean URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('payment');
      newParams.delete('apt');
      setSearchParams(newParams, { replace: true });
    }
  }, []);

  // After successful login, proceed with pending booking
  useEffect(() => {
    if (session && pendingCustomerData && !isSubmitting) {
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
    setAuthError(null);
    setIsAuthLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      
      if (error) throw error;
      
      setShowLoginModal(false);
      setAuthError(null);
      toast({ title: 'Login realizado', description: 'Você foi autenticado com sucesso.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Email ou senha incorretos.';
      setAuthError(msg.includes('Invalid login') ? 'Email ou senha incorretos.' : msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!signupName.trim()) { setAuthError('Nome é obrigatório.'); return; }
    const phoneDigits = signupPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) { setAuthError('Telefone deve ter DDD + 8 ou 9 dígitos.'); return; }
    if (!signupEmail.trim()) { setAuthError('Email é obrigatório.'); return; }
    if (!isPasswordStrong(signupPassword)) { setAuthError('Senha deve conter maiúscula, minúscula, número e caractere especial (mín. 8 caracteres).'); return; }

    setIsAuthLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: {
          emailRedirectTo: buildPublicUrl(`/${slug}`),
          data: { full_name: signupName.trim(), phone: phoneDigits, account_type: 'customer' },
        },
      });
      
      if (error) throw error;
      
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: signupEmail, password: signupPassword,
        });
        if (signInError) {
          setShowLoginModal(false);
          toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar a conta e depois volte para agendar.' });
          return;
        }
      }
      
      setShowLoginModal(false);
      setAuthError(null);
      toast({ title: 'Conta criada', description: 'Sua conta foi criada com sucesso. Continue para agendar.' });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Não foi possível criar a conta.';
      setAuthError(msg.includes('already registered') || msg.includes('already been registered')
        ? 'Este email já possui uma conta. Faça login na aba "Entrar".' : msg);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Store terms for persistence after appointment creation
  const [pendingTerms, setPendingTerms] = useState<GeneratedTerms | null>(null);

  const handleConfirmedSubmit = async (customerData: CustomerFormData, terms?: GeneratedTerms) => {
    if (terms) setPendingTerms(terms);
    if (isSubmitting) {
      console.warn('[Booking] handleConfirmedSubmit: already submitting, skipping');
      return;
    }
    if (!establishment || !selectedService || !selectedProfessional || !selectedDate || !selectedTime || !slug) {
      console.warn('[Booking] handleConfirmedSubmit: missing required data', {
        establishment: !!establishment, selectedService: !!selectedService,
        selectedProfessional: !!selectedProfessional, selectedDate: !!selectedDate,
        selectedTime, slug,
      });
      return;
    }

    console.log('[Booking] handleConfirmedSubmit: starting', {
      requiresPayment,
      paymentConfigEnabled: paymentConfig?.enabled,
      depositRequired: paymentConfig?.deposit_required,
      fullPaymentOnline: paymentConfig?.full_payment_online,
      slug,
    });
    setIsSubmitting(true);
    setPendingCustomerData(null);

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startAt = new Date(selectedDate);
      startAt.setHours(hours, minutes, 0, 0);
      const endAt = new Date(startAt);
      endAt.setMinutes(endAt.getMinutes() + selectedService.duration_minutes);

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const canonicalEmail = customerData.email || currentUser?.email || user?.email || '';
      const canonicalName = customerData.name || profile?.full_name || '';
      const canonicalPhone = customerData.phone || profile?.phone || '';
      const canonicalUserId = currentUser?.id || null;

      console.log('[Booking] Calling RPC public_create_appointment', {
        service: selectedService.id, professional: selectedProfessional.id,
        startAt: startAt.toISOString(), requiresPayment,
      });

      const { data, error } = await supabase.rpc('public_create_appointment', {
        p_slug: slug,
        p_service_id: selectedService.id,
        p_professional_id: selectedProfessional.id,
        p_start_at: startAt.toISOString(),
        p_end_at: endAt.toISOString(),
        p_customer_name: canonicalName,
        p_customer_phone: canonicalPhone,
        p_customer_email: canonicalEmail || null,
        p_customer_notes: customerData.notes || null,
        p_customer_user_id: canonicalUserId,
        p_customer_reminder_hours: customerData.reminderHours ?? null,
        p_requires_payment: requiresPayment,
      });

      if (error) {
        console.error('[Booking] RPC error:', error);
        throw new Error(error.message || 'Erro ao criar agendamento');
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.error('[Booking] RPC returned empty data:', data);
        throw new Error('Resposta vazia do servidor. Tente novamente.');
      }

      console.log('[Booking] RPC success:', data);
      const result = Array.isArray(data) ? data[0] : data;
      const appointmentId = result?.appointment_id as string | undefined;

      if (!appointmentId) {
        console.error('[Booking] RPC did not return appointment_id:', result);
        throw new Error('Agendamento criado sem appointment_id. Não foi possível iniciar pagamento.');
      }

      if (result?.manage_token) {
        setManageToken(result.manage_token);
      }

      setCreatedAppointmentId(appointmentId);

      // If payment is required, validate appointment status strictly.
      // Never silently skip payment when status lookup fails.
      if (requiresPayment) {
        const { data: apt, error: aptError } = await supabase
          .from('appointments')
          .select('status')
          .eq('id', appointmentId)
          .maybeSingle();

        if (aptError) {
          console.error('[Booking] Failed to read appointment status for payment:', aptError);
          throw new Error(`Falha ao validar status para pagamento: ${aptError.message}`);
        }

        if (!apt?.status) {
          console.error('[Booking] Appointment status not found after creation', { appointmentId });
          throw new Error('Agendamento criado, mas o status de pagamento não pôde ser validado.');
        }

        if (apt.status === 'pending_payment') {
          console.log('[Booking] Payment required, moving to payment step');
          setCurrentStep(4);
          return;
        }

        console.log('[Booking] Payment bypassed or not required by server status', { status: apt.status });
        setIsSuccess(true);
        return;
      }

      console.log('[Booking] No payment required, booking complete');
      setIsSuccess(true);
    } catch (error) {
      console.error('[Booking] handleConfirmedSubmit error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível concluir o agendamento. Tente novamente.';
      toast({ variant: 'destructive', title: 'Erro ao agendar', description: errorMessage });
    } finally {
      console.log('[Booking] handleConfirmedSubmit: finished, setting isSubmitting=false');
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (customerData: CustomerFormData) => {
    console.log('[Booking] handleSubmit called', { isSubmitting, hasSession: !!session });
    if (isSubmitting) return;

    if (paymentConfigError) {
      toast({
        variant: 'destructive',
        title: 'Erro no checkout',
        description: 'Não foi possível carregar a configuração de pagamento. Tente novamente.',
      });
      return;
    }

    if (isLoadingPaymentConfig) {
      toast({
        title: 'Aguarde um instante',
        description: 'Estamos carregando a configuração de pagamento deste serviço.',
      });
      return;
    }

    // Allow guest booking — no session required

    if (!establishment || !selectedService || !selectedProfessional || !selectedDate || !selectedTime || !slug) {
      console.warn('[Booking] Missing fields', { establishment: !!establishment, selectedService: !!selectedService, selectedProfessional: !!selectedProfessional, selectedDate: !!selectedDate, selectedTime, slug });
      toast({ variant: 'destructive', title: 'Campos incompletos', description: 'Escolha serviço, profissional, data/hora e preencha seus dados.' });
      return;
    }

    await handleConfirmedSubmit(customerData);
  };

  const handlePayment = async () => {
    if (!createdAppointmentId || !establishment || !selectedService || !paymentConfig) {
      console.warn('[Booking] handlePayment: missing data', { createdAppointmentId, establishment: !!establishment, selectedService: !!selectedService, paymentConfig: !!paymentConfig });
      toast({ variant: 'destructive', title: 'Erro', description: 'Dados incompletos para pagamento. Tente novamente.' });
      return;
    }

    console.log('[Booking] handlePayment: starting');
    setIsPaymentProcessing(true);
    try {
      const payment = calculatePaymentAmount(paymentConfig as PaymentConfig, selectedService.price_cents || 0);

      console.log('[Booking] Creating payment', { amount: payment.amount, type: payment.type });
      const result = await createPayment.mutateAsync({
        establishment_id: establishment.id,
        appointment_id: createdAppointmentId,
        amount_cents: payment.amount,
        payment_type: payment.type,
        payer_email: user?.email || undefined,
        service_name: selectedService.name,
        customer_name: profile?.full_name || user?.email?.split('@')[0] || 'Cliente',
        slug: slug,
      });

      if (result.payment_url) {
        console.log('[Booking] Redirecting to payment URL:', result.payment_url);
        // Use top-level navigation to escape iframe if needed
        const targetWindow = window.top || window.parent || window;
        targetWindow.location.href = result.payment_url;
      } else {
        console.error('[Booking] No payment_url in response:', result);
        throw new Error('URL de pagamento não recebida');
      }
    } catch (err) {
      console.error('[Booking] handlePayment error:', err);
      setIsPaymentProcessing(false);
      toast({
        variant: 'destructive',
        title: 'Erro no pagamento',
        description: err instanceof Error ? err.message : 'Falha ao iniciar pagamento. Tente novamente.',
      });
      throw err;
    }
  };

  // ── Payment Return Screen ──
  if (paymentReturnStatus) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-lg mx-auto px-4 py-8">
          <PaymentReturnScreen
            status={paymentReturnStatus}
            appointmentId={createdAppointmentId}
            slug={slug}
            onRetry={() => {
              setPaymentReturnStatus(null);
              // Re-enter payment step if possible
              if (createdAppointmentId && selectedService && selectedProfessional && selectedDate && selectedTime) {
                setCurrentStep(4);
              }
            }}
            onDone={() => {
              setPaymentReturnStatus(null);
              setIsSuccess(true);
            }}
          />
        </div>
      </div>
    );
  }

  // ── Loading ──
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
        <p className="text-muted-foreground mb-6">O link pode estar incorreto ou o agendamento está desativado.</p>
        <Button asChild variant="outline"><Link to="/">Voltar ao início</Link></Button>
      </div>
    );
  }

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
                <img src={establishment.logo_url} alt={establishment.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
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
            <Button asChild variant="outline"><Link to="/">Voltar ao início</Link></Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Success Screen ──
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
            pendingApproval={!establishment.auto_confirm_bookings || (requiresPayment && paymentConfig?.require_manual_confirmation)}
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
                <img src={establishment.logo_url} alt={establishment.name} className="w-10 h-10 rounded-full object-cover" loading="lazy" />
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
        <StepIndicator currentStep={currentStep} steps={steps} />

        {currentStep > 0 && currentStep < 4 && (
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

        {currentStep === 3 && !session && (
          <div className="space-y-6">
            <div className="p-4 border border-border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LogIn className="w-4 h-4" />
                <span>Já tem conta? <button type="button" className="text-primary underline" onClick={() => { setAuthTab('login'); setShowLoginModal(true); }}>Entrar</button> ou <button type="button" className="text-primary underline" onClick={() => { setAuthTab('signup'); setShowLoginModal(true); }}>Criar conta</button></span>
              </div>
            </div>
            <CustomerStep 
              key="guest"
              establishment={{...establishment, ask_email: true}} 
              onSubmit={handleSubmit} 
              isSubmitting={isSubmitting}
              isGuest
              defaultValues={{
                name: '',
                phone: '',
                email: '',
              }}
            />
          </div>
        )}

        {currentStep === 3 && session && (
          <CustomerStep 
            key={`${user?.id}-${profile?.full_name}-${profile?.phone}`}
            establishment={{...establishment, ask_email: true}} 
            onSubmit={handleSubmit} 
            isSubmitting={isSubmitting}
            defaultValues={{
              name: profile?.full_name || user?.user_metadata?.full_name || '',
              phone: profile?.phone || user?.user_metadata?.phone || '',
              email: user?.email || '',
            }}
          />
        )}

        {currentStep === 4 && requiresPayment && selectedService && selectedProfessional && selectedDate && selectedTime && (
          <PaymentStep
            serviceName={selectedService.name}
            servicePriceCents={selectedService.price_cents}
            professionalName={selectedProfessional.name}
            date={selectedDate}
            time={selectedTime}
            paymentConfig={paymentConfig as PaymentConfig}
            onPay={handlePayment}
            onSkip={() => setIsSuccess(true)}
            isProcessing={isPaymentProcessing}
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
              <form onSubmit={(e) => { setAuthError(null); handleLogin(e); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <PasswordInput id="login-password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                {authError && authTab === 'login' && <p className="text-sm text-destructive">{authError}</p>}
                <Button type="submit" className="w-full" disabled={isAuthLoading}>
                  {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isAuthLoading ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo *</Label>
                  <Input id="signup-name" placeholder="Seu nome" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Telefone *</Label>
                  <PhoneInput id="signup-phone" placeholder="(11) 99999-9999" value={signupPhone} onChange={(val) => setSignupPhone(val)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <Input id="signup-email" type="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha *</Label>
                  <PasswordInput id="signup-password" placeholder="Mínimo 8 caracteres" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                  {signupPassword && <PasswordStrength password={signupPassword} />}
                </div>
                {authError && authTab === 'signup' && <p className="text-sm text-destructive">{authError}</p>}
                <Button type="submit" className="w-full" disabled={isAuthLoading}>
                  {isAuthLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isAuthLoading ? 'Criando conta...' : 'Criar conta e agendar'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Payment Return Screen ──────────────────────────────────

function PaymentReturnScreen({
  status,
  appointmentId,
  slug,
  onRetry,
  onDone,
}: {
  status: 'success' | 'failure' | 'pending';
  appointmentId: string | null;
  slug: string | undefined;
  onRetry: () => void;
  onDone: () => void;
}) {
  // Check if establishment requires manual confirmation
  const [requiresManualConfirmation, setRequiresManualConfirmation] = useState(false);

  useEffect(() => {
    if (status === 'success' && slug) {
      // Fetch establishment to check manual confirmation
      supabase.from('establishments').select('id').eq('slug', slug).single().then(({ data: est }) => {
        if (est) {
          supabase.from('payment_settings').select('require_manual_confirmation').eq('establishment_id', est.id).maybeSingle().then(({ data: ps }) => {
            if (ps?.require_manual_confirmation) setRequiresManualConfirmation(true);
          });
        }
      });
    }
  }, [status, slug]);

  if (status === 'success') {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="flex justify-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${requiresManualConfirmation ? 'bg-amber-100' : 'bg-primary/10'}`}>
            {requiresManualConfirmation ? (
              <Clock className="w-10 h-10 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-10 h-10 text-primary" />
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold">
            {requiresManualConfirmation ? 'Pagamento aprovado!' : 'Pagamento aprovado!'}
          </h2>
          <p className="text-muted-foreground mt-2">
            {requiresManualConfirmation
              ? 'Seu pagamento foi processado com sucesso. Seu agendamento agora aguarda aprovação do estabelecimento. Você receberá uma notificação quando for confirmado.'
              : 'Seu pagamento foi processado com sucesso. Seu agendamento foi confirmado.'
            }
          </p>
        </div>
        <div className="space-y-3 max-w-sm mx-auto">
          <Button className="w-full" onClick={onDone}>
            {requiresManualConfirmation ? 'Ver meus agendamentos' : 'Ver detalhes do agendamento'}
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="text-center space-y-6 py-12">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
            <Clock className="w-10 h-10 text-accent-foreground" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold">Pagamento pendente</h2>
          <p className="text-muted-foreground mt-2">
            Seu pagamento está sendo processado. Você receberá uma confirmação assim que for aprovado.
          </p>
        </div>
        <div className="space-y-3 max-w-sm mx-auto">
          <Button className="w-full" onClick={onDone}>
            Ver meus agendamentos
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    );
  }

  // failure
  return (
    <div className="text-center space-y-6 py-12">
      <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-destructive" />
          </div>
      </div>
      <div>
        <h2 className="text-2xl font-bold">Pagamento não aprovado</h2>
        <p className="text-muted-foreground mt-2">
          Houve um problema com o pagamento. Seu agendamento foi criado, mas ainda precisa de pagamento para ser confirmado.
        </p>
      </div>
      <div className="space-y-3 max-w-sm mx-auto">
        <Button className="w-full" onClick={onRetry}>
          <CreditCard className="w-4 h-4 mr-2" />
          Tentar novamente
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
