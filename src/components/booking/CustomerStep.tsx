import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerFormSchema, CustomerFormData } from '@/lib/validations/booking';
import { generateBookingTerms, type TermsParams, type GeneratedTerms } from '@/lib/bookingTerms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, CheckCircle2, Bell, CreditCard, Banknote } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Establishment } from '@/hooks/useEstablishment';

export type PaymentMethodChoice = 'online' | 'cash';

export interface PaymentConfigForTerms {
  enabled: boolean;
  deposit_required?: boolean;
  deposit_type?: string;
  deposit_value?: number;
  full_payment_online?: boolean;
  require_manual_confirmation?: boolean;
  refund_on_cancellation?: boolean;
  refund_deadline_hours?: number;
}

interface CustomerStepProps {
  establishment: Establishment;
  onSubmit: (data: CustomerFormData, terms: GeneratedTerms, paymentMethod: PaymentMethodChoice) => Promise<void>;
  isSubmitting: boolean;
  defaultValues?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  isGuest?: boolean;
  paymentConfig?: PaymentConfigForTerms | null;
  servicePriceCents?: number | null;
}

export function CustomerStep({ establishment, onSubmit, isSubmitting, defaultValues, isGuest = false, paymentConfig, servicePriceCents }: CustomerStepProps) {
  const [termsRead, setTermsRead] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);

  const requiresOnlinePayment = !!(
    paymentConfig?.enabled &&
    (paymentConfig?.deposit_required || paymentConfig?.full_payment_online) &&
    servicePriceCents
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice>('online');

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => {});
  }, []);

  const canonicalEmail = isGuest ? '' : (defaultValues?.email || '');

  // Default reminder from establishment config
  const defaultReminder = (establishment as any).reminder_hours_before ?? 3;

  // When the customer opts to pay cash in person, the online payment terms don't apply
  const payingOnline = requiresOnlinePayment && paymentMethod === 'online';

  const generatedTerms = useMemo<GeneratedTerms>(() => {
    const params: TermsParams = {
      establishmentName: establishment.name,
      rescheduleMinHours: establishment.reschedule_min_hours || 2,
      depositRequired: (payingOnline && paymentConfig?.deposit_required) || false,
      depositType: (paymentConfig?.deposit_type as 'fixed' | 'percentage') || 'fixed',
      depositValue: paymentConfig?.deposit_value || 0,
      fullPaymentOnline: (payingOnline && paymentConfig?.full_payment_online) || false,
      refundOnCancellation: paymentConfig?.refund_on_cancellation || false,
      refundDeadlineHours: paymentConfig?.refund_deadline_hours || 24,
      servicePriceCents: servicePriceCents || 0,
    };
    return generateBookingTerms(params);
  }, [establishment, paymentConfig, servicePriceCents, payingOnline]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(
      customerFormSchema.refine((data) => data.acceptPolicy === true && privacyAccepted, {
        message: 'Você precisa aceitar os termos de agendamento e a política de privacidade',
        path: ['acceptPolicy'],
      })
    ),
    defaultValues: {
      name: defaultValues?.name || '',
      phone: defaultValues?.phone || '',
      email: canonicalEmail,
      notes: '',
      acceptPolicy: false,
      reminderHours: defaultReminder > 0 ? defaultReminder : null,
    },
  });

  const acceptPolicy = watch('acceptPolicy');
  const reminderHours = watch('reminderHours');
  const watchedEmail = watch('email');
  const showReminderSection = isGuest ? !!watchedEmail : !!canonicalEmail;

  const handleTermsRead = () => {
    setTermsRead(true);
    setTermsModalOpen(false);
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (checked && !termsRead) {
      setTermsModalOpen(true);
      return;
    }
    setValue('acceptPolicy', checked, { shouldValidate: true });
  };

  const onFormSubmit = async (data: CustomerFormData) => {
    const finalData: CustomerFormData = {
      ...data,
      email: isGuest ? data.email : canonicalEmail,
    };
    
    // Add IP and User Agent to metadata
    const enrichedTerms = {
      ...generatedTerms,
      params: {
        ...generatedTerms.params,
        ip_address: ipAddress,
        user_agent: navigator.userAgent,
        accepted_at: new Date().toISOString()
      }
    };

    console.log('[CustomerStep] submit', { termsType: enrichedTerms.type, paymentMethod });
    await onSubmit(finalData, enrichedTerms, requiresOnlinePayment ? paymentMethod : 'online');
  };

  const termsTypeLabel = generatedTerms.type === 'deposit'
    ? 'Termos de Agendamento (com sinal)'
    : generatedTerms.type === 'full_payment_online'
    ? 'Termos de Agendamento (pagamento integral)'
    : 'Termos de Agendamento';

  return (
    <form
      onSubmit={handleSubmit(
        onFormSubmit,
        (formErrors) => {
          console.log('[CustomerStep] validation errors', formErrors);
          const firstErrorField = Object.keys(formErrors)[0];
          if (firstErrorField) {
            const el = document.getElementById(firstErrorField);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus();
          }
        }
      )}
      className="space-y-6"
    >
      <h2 className="text-lg font-semibold">Seus dados</h2>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo *</Label>
          <Input id="name" placeholder="Seu nome" {...register('name')} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone *</Label>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <PhoneInput
                id="phone"
                placeholder="(11) 99999-9999"
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>

        {/* Email – readonly for logged-in users, editable for guests */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          {isGuest ? (
            <>
              <Input id="email" type="email" placeholder="seu@email.com" {...register('email')} />
              <p className="text-xs text-muted-foreground">Opcional. Usado para confirmação e lembretes.</p>
            </>
          ) : (
            <>
              <Input id="email" type="email" value={canonicalEmail} readOnly className="bg-muted cursor-not-allowed" tabIndex={-1} />
              <p className="text-xs text-muted-foreground">Este email está vinculado à sua conta.</p>
            </>
          )}
        </div>

        {establishment.ask_notes && (
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" placeholder="Alguma informação adicional?" rows={3} {...register('notes')} />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
          </div>
        )}

        {/* Compact reminder preference */}
        {showReminderSection && (
          <div className="flex items-center gap-3">
            <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
            <Label className="text-sm shrink-0">Lembrete:</Label>
            <Select
              value={reminderHours === null ? 'none' : String(reminderHours)}
              onValueChange={(v) => setValue('reminderHours', v === 'none' ? null : Number(v))}
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem lembrete</SelectItem>
                <SelectItem value="1">1h antes</SelectItem>
                <SelectItem value="2">2h antes</SelectItem>
                <SelectItem value="3">3h antes</SelectItem>
                <SelectItem value="6">6h antes</SelectItem>
                <SelectItem value="12">12h antes</SelectItem>
                <SelectItem value="24">24h antes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Payment method choice, only when the establishment requires online payment */}
        {requiresOnlinePayment && (
          <div className="space-y-2">
            <Label>Como você quer pagar?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('online')}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors',
                  paymentMethod === 'online'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <CreditCard className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Pagar online agora</p>
                  <p className="text-xs text-muted-foreground">Via Mercado Pago</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-colors',
                  paymentMethod === 'cash'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <Banknote className="h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-medium">Dinheiro no local</p>
                  <p className="text-xs text-muted-foreground">Pague ao chegar</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Terms of Service */}
        <div className="space-y-3 p-4 bg-muted/50 border rounded-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="font-medium text-sm">{termsTypeLabel}</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            Antes de confirmar, leia e aceite os termos de agendamento.
          </p>

          <Dialog open={termsModalOpen} onOpenChange={setTermsModalOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full">
                <FileText className="mr-2 h-4 w-4" />
                {termsRead ? 'Reler termos' : 'Ler termos de agendamento'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  {termsTypeLabel}
                </DialogTitle>
                <DialogDescription>{establishment.name}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed space-y-1">
                  {generatedTerms.text}
                </div>
              </ScrollArea>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => setTermsModalOpen(false)} className="sm:flex-1">
                  Fechar
                </Button>
                <Button type="button" onClick={handleTermsRead} className="sm:flex-1">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Li e entendi
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="acceptPolicy"
              checked={acceptPolicy}
              disabled={!termsRead}
              onCheckedChange={handleCheckboxChange}
              className={!termsRead ? 'opacity-50 cursor-not-allowed' : ''}
            />
            <div className="flex-1">
              <Label
                htmlFor="acceptPolicy"
                className={`text-sm font-normal ${termsRead ? 'cursor-pointer' : 'cursor-not-allowed text-muted-foreground'}`}
              >
                Li e aceito os termos de agendamento
              </Label>
              {!termsRead && (
                <p className="text-xs text-muted-foreground mt-1">
                  Você precisa ler os termos antes de aceitar
                </p>
              )}
            </div>
          </div>

          {termsRead && acceptPolicy && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Termos aceitos</span>
            </div>
          )}

          {errors.acceptPolicy && (
            <p className="text-sm text-destructive">{errors.acceptPolicy.message}</p>
          )}
          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="acceptPrivacy"
              checked={privacyAccepted}
              onCheckedChange={(checked) => setPrivacyAccepted(checked as boolean)}
            />
            <div className="flex-1">
              <Label htmlFor="acceptPrivacy" className="text-sm font-normal cursor-pointer">
                Aceito a <Link to="/privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link> e autorizo o processamento dos meus dados para este agendamento.
              </Label>
            </div>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Confirmando…' : 'Confirmar agendamento'}
      </Button>
    </form>
  );
}
