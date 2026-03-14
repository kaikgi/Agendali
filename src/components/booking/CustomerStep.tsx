import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { customerFormSchema, CustomerFormData } from '@/lib/validations/booking';
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

interface CustomerStepProps {
  establishment: Establishment;
  onSubmit: (data: CustomerFormData) => Promise<void>;
  isSubmitting: boolean;
  /** Canonical auth data – treated as the single source of truth */
  defaultValues?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  /** When true, email is editable (guest booking) */
  isGuest?: boolean;
}

export function CustomerStep({ establishment, onSubmit, isSubmitting, defaultValues, isGuest = false }: CustomerStepProps) {
  const [policyRead, setPolicyRead] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);

  // Email is canonical (readonly) for logged-in users, editable for guests
  const canonicalEmail = isGuest ? '' : (defaultValues?.email || '');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(
      establishment.require_policy_acceptance
        ? customerFormSchema.refine((data) => data.acceptPolicy === true, {
            message: 'Você precisa aceitar a política de cancelamento',
            path: ['acceptPolicy'],
          })
        : customerFormSchema
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

  // Always show reminder when we have a canonical email
  const showReminderSection = !!canonicalEmail;

  const handlePolicyRead = () => {
    setPolicyRead(true);
    setPolicyModalOpen(false);
  };

  const handleCheckboxChange = (checked: boolean) => {
    if (checked && !policyRead) {
      setPolicyModalOpen(true);
      return;
    }
    setValue('acceptPolicy', checked, { shouldValidate: true });
  };

  const defaultPolicyText = `Política de Cancelamento

Para garantir uma melhor organização da agenda e atendimento a todos os clientes, pedimos atenção às seguintes regras:

• Cancelamentos ou reagendamentos devem ser solicitados com no mínimo ${establishment.reschedule_min_hours || 2} horas de antecedência em relação ao horário agendado.

• Reagendamentos estão sujeitos à disponibilidade de horários na agenda do profissional.

• Em caso de não comparecimento sem aviso prévio, o estabelecimento poderá aplicar restrições ou condições especiais para futuros agendamentos.

• Cancelamentos frequentes ou faltas recorrentes podem resultar em limitações para novos agendamentos.

Ao continuar com o agendamento, você declara estar ciente e de acordo com esta política.`;

  const policyText = establishment.cancellation_policy_text || defaultPolicyText;

  const onFormSubmit = async (data: CustomerFormData) => {
    // Inject canonical email before submitting – never trust form state for email
    const finalData: CustomerFormData = {
      ...data,
      email: canonicalEmail,
    };
    console.log('submit clicked (customer step)', finalData);
    await onSubmit(finalData);
  };

  return (
    <form
      onSubmit={handleSubmit(
        onFormSubmit,
        (formErrors) => {
          console.log('submit blocked by validation', formErrors);
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

        {/* Email – always readonly, canonical from auth */}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={canonicalEmail}
            readOnly
            className="bg-muted cursor-not-allowed"
            tabIndex={-1}
          />
          <p className="text-xs text-muted-foreground">Este email está vinculado à sua conta.</p>
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

        {establishment.require_policy_acceptance && (
          <div className="space-y-3 p-4 bg-muted/50 border rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm">Política de cancelamento</h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Antes de confirmar, leia e aceite nossa política de cancelamento.
            </p>

            <Dialog open={policyModalOpen} onOpenChange={setPolicyModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  className="w-full"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {policyRead ? 'Reler política' : 'Ler política de cancelamento'}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Política de Cancelamento
                  </DialogTitle>
                  <DialogDescription>
                    {establishment.name}
                  </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[60vh] pr-4">
                  <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed space-y-1">
                    {policyText}
                  </div>
                </ScrollArea>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setPolicyModalOpen(false)}
                    className="sm:flex-1"
                  >
                    Fechar
                  </Button>
                  <Button 
                    type="button"
                    onClick={handlePolicyRead}
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
                disabled={!policyRead}
                onCheckedChange={handleCheckboxChange}
                className={!policyRead ? 'opacity-50 cursor-not-allowed' : ''}
              />
              <div className="flex-1">
                <Label 
                  htmlFor="acceptPolicy" 
                  className={`text-sm font-normal ${policyRead ? 'cursor-pointer' : 'cursor-not-allowed text-muted-foreground'}`}
                >
                  Li e aceito a política de cancelamento
                </Label>
                {!policyRead && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Você precisa ler a política antes de aceitar
                  </p>
                )}
              </div>
            </div>

            {policyRead && acceptPolicy && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Política aceita</span>
              </div>
            )}

            {errors.acceptPolicy && (
              <p className="text-sm text-destructive">{errors.acceptPolicy.message}</p>
            )}
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {isSubmitting ? 'Confirmando…' : 'Confirmar agendamento'}
      </Button>
    </form>
  );
}
