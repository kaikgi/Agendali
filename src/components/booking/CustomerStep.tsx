import { useState, useMemo } from 'react';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, FileText, CheckCircle2, Bell, BellOff } from 'lucide-react';
import type { Establishment } from '@/hooks/useEstablishment';

const REMINDER_OPTIONS = [
  { value: null, label: 'Não quero lembrete', icon: BellOff },
  { value: 1, label: '1 hora antes', icon: Bell },
  { value: 2, label: '2 horas antes', icon: Bell },
  { value: 3, label: '3 horas antes', icon: Bell },
  { value: 6, label: '6 horas antes', icon: Bell },
  { value: 12, label: '12 horas antes', icon: Bell },
  { value: 24, label: '24 horas antes', icon: Bell },
] as const;

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
  onSubmit: (data: CustomerFormData, terms: GeneratedTerms) => Promise<void>;
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
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const canonicalEmail = isGuest ? '' : (defaultValues?.email || '');

  // Generate dynamic terms based on establishment config and payment mode
  const generatedTerms = useMemo<GeneratedTerms>(() => {
    const params: TermsParams = {
      establishmentName: establishment.name,
      rescheduleMinHours: establishment.reschedule_min_hours || 2,
      depositRequired: paymentConfig?.enabled && paymentConfig?.deposit_required || false,
      depositType: (paymentConfig?.deposit_type as 'fixed' | 'percentage') || 'fixed',
      depositValue: paymentConfig?.deposit_value || 0,
      fullPaymentOnline: paymentConfig?.enabled && paymentConfig?.full_payment_online || false,
      refundOnCancellation: paymentConfig?.refund_on_cancellation || false,
      refundDeadlineHours: paymentConfig?.refund_deadline_hours || 24,
      servicePriceCents: servicePriceCents || 0,
    };
    return generateBookingTerms(params);
  }, [establishment, paymentConfig, servicePriceCents]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(
      customerFormSchema.refine((data) => data.acceptPolicy === true, {
        message: 'Você precisa aceitar os termos de agendamento',
        path: ['acceptPolicy'],
      })
    ),
    defaultValues: {
      name: defaultValues?.name || '',
      phone: defaultValues?.phone || '',
      email: canonicalEmail,
      notes: '',
      acceptPolicy: false,
      reminderHours: 2,
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
    console.log('[CustomerStep] submit', { termsType: generatedTerms.type });
    await onSubmit(finalData, generatedTerms);
  };

  // Label for terms type
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
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email')}
              />
              <p className="text-xs text-muted-foreground">Opcional. Usado para enviar confirmação e lembretes.</p>
            </>
          ) : (
            <>
              <Input
                id="email"
                type="email"
                value={canonicalEmail}
                readOnly
                className="bg-muted cursor-not-allowed"
                tabIndex={-1}
              />
              <p className="text-xs text-muted-foreground">Este email está vinculado à sua conta.</p>
            </>
          )}
        </div>

        {establishment.ask_notes && (
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Alguma informação adicional?"
              rows={3}
              {...register('notes')}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
          </div>
        )}

        {/* Reminder preference */}
        {showReminderSection && (
          <div className="space-y-3 p-4 bg-muted/50 border rounded-lg">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Lembrete por email</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Escolha com quanto tempo de antecedência deseja receber um lembrete.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {REMINDER_OPTIONS.map((option) => {
                const isSelected = reminderHours === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setValue('reminderHours', option.value)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Terms of Service - Always shown */}
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
              >
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
                <DialogDescription>
                  {establishment.name}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed space-y-1">
                  {generatedTerms.text}
                </div>
              </ScrollArea>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTermsModalOpen(false)}
                  className="sm:flex-1"
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  onClick={handleTermsRead}
                  className="sm:flex-1"
                >
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
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Confirmando…' : 'Confirmar agendamento'}
      </Button>
    </form>
  );
}
