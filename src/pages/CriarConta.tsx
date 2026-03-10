import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { signupSchema, SignupFormData } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { PhoneInput } from '@/components/ui/phone-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getPublicBaseUrl } from '@/lib/publicUrl';

interface InvitationData {
  valid: boolean;
  error?: string;
  invitation_id?: string;
  email?: string;
  plan_code?: string;
}

export default function CriarConta() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [validating, setValidating] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      setInvitation({ valid: false, error: 'Nenhum token de convite fornecido. Você precisa acessar o link enviado por email.' });
      return;
    }

    const validate = async () => {
      const { data, error } = await supabase.rpc('validate_signup_invitation', {
        p_token: token,
      });

      if (error) {
        console.error('Error validating invitation:', error);
        setInvitation({ valid: false, error: 'Erro ao validar o convite. Tente novamente.' });
      } else {
        const result = data as unknown as InvitationData;
        setInvitation(result);
        if (result.valid && result.email) {
          setValue('email', result.email);
        }
      }
      setValidating(false);
    };

    validate();
  }, [token, setValue]);

  const onSubmit = async (data: SignupFormData) => {
    if (!token || !invitation?.valid) return;

    setAuthError(null);
    setIsLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email!,
        password: data.password,
        options: {
          emailRedirectTo: `${getPublicBaseUrl()}/dashboard`,
          data: {
            full_name: data.fullName,
            company_name: data.companyName,
            account_type: 'establishment_owner',
          },
        },
      });

      if (signUpError || !authData.user) {
        throw signUpError || new Error('Erro ao criar conta');
      }

      const userId = authData.user.id;
      const planCode = invitation.plan_code || 'solo';

      // 2. Update phone
      await supabase.from('profiles').update({
        phone: data.phone,
      }).eq('id', userId);

      // 3. Create establishment
      const { data: establishment, error: estError } = await supabase
        .from('establishments')
        .insert({
          owner_user_id: userId,
          name: data.companyName,
          status: 'active',
          plano: planCode,
        })
        .select('id')
        .single();

      if (estError || !establishment) {
        throw estError || new Error('Erro ao criar estabelecimento');
      }

      // 4. Create owner member
      await supabase.from('establishment_members').insert({
        establishment_id: establishment.id,
        user_id: userId,
        role: 'owner',
      });

      // 5. Create default business hours
      const defaultHours = [];
      for (let weekday = 1; weekday <= 6; weekday++) {
        defaultHours.push({
          establishment_id: establishment.id,
          weekday,
          open_time: '09:00',
          close_time: '18:00',
          closed: false,
        });
      }
      defaultHours.push({
        establishment_id: establishment.id,
        weekday: 0,
        open_time: null,
        close_time: null,
        closed: true,
      });
      await supabase.from('business_hours').insert(defaultHours);

      // 6. Consume invitation token
      await supabase.rpc('consume_signup_invitation', { p_token: token });

      // 7. Mark allowed signup as used
      await supabase
        .from('allowed_establishment_signups')
        .update({ used: true })
        .eq('email', invitation.email!.toLowerCase().trim());

      setIsLoading(false);
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Seu estabelecimento está pronto. Bem-vindo ao Agendali!',
      });
      navigate('/dashboard');
    } catch (err: any) {
      setIsLoading(false);
      const message = err?.message || 'Erro ao criar conta';
      setAuthError(message);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: message,
      });
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <Logo />
        <div className="mt-8 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Validando seu convite...</span>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!invitation?.valid) {
    const isExpired = invitation?.error?.includes('expirou');
    const isUsed = invitation?.error?.includes('utilizado');

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Logo />
          <div className="mt-6 space-y-4">
            {isUsed ? (
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto" />
            ) : isExpired ? (
              <Clock className="h-12 w-12 text-muted-foreground mx-auto" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive mx-auto" />
            )}
            <h1 className="text-xl font-bold">
              {isUsed ? 'Convite já utilizado' : isExpired ? 'Convite expirado' : 'Convite inválido'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {invitation?.error || 'Não foi possível validar o convite.'}
            </p>
          </div>
          <div className="space-y-2">
            {isUsed && (
              <Button asChild className="w-full">
                <Link to="/login">Fazer login</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link to="/precos">Ver planos disponíveis</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Valid token — show signup form
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Criar sua conta
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete o cadastro para acessar o Agendali
          </p>
        </div>

        <Alert variant="default" className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-800">
            Pagamento confirmado! Plano <strong className="capitalize">{invitation.plan_code}</strong> ativo para{' '}
            <strong>{invitation.email}</strong>
          </AlertDescription>
        </Alert>

        {authError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" type="text" placeholder="Seu nome" autoComplete="name" {...register('fullName')} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input id="companyName" type="text" placeholder="Nome do seu estabelecimento" autoComplete="organization" {...register('companyName')} />
            {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={invitation.email || ''}
              disabled
              className="bg-muted cursor-not-allowed"
              {...register('email')}
            />
            <p className="text-xs text-muted-foreground">
              O email é vinculado ao seu pagamento e não pode ser alterado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Controller
              name="phone"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <PhoneInput id="phone" placeholder="(11) 99999-9999" value={field.value} onChange={field.onChange} />
              )}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput id="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" {...register('password')} />
            <PasswordStrength password={password} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <PasswordInput id="confirmPassword" placeholder="Repita a senha" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar conta
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta?{' '}
          <Link to="/login" className="font-medium text-foreground hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
