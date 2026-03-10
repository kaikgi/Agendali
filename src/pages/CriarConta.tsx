import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Ban } from 'lucide-react';
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

interface TokenValidation {
  valid: boolean;
  reason: string;
  email: string | null;
  plan_id: string | null;
  order_id: string | null;
  expires_at: string | null;
}

export default function CriarConta() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [validating, setValidating] = useState(true);
  const [tokenData, setTokenData] = useState<TokenValidation | null>(null);
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
      setTokenData({ valid: false, reason: 'not_found', email: null, plan_id: null, order_id: null, expires_at: null });
      return;
    }

    const validate = async () => {
      try {
        const { data, error } = await supabase.rpc('check_signup_token', { p_token: token });

        if (error) {
          console.error('Error validating token:', error);
          setTokenData({ valid: false, reason: 'error', email: null, plan_id: null, order_id: null, expires_at: null });
        } else if (data && data.length > 0) {
          const result = data[0] as TokenValidation;
          setTokenData(result);
          if (result.valid && result.email) {
            setValue('email', result.email);
          }
        } else {
          setTokenData({ valid: false, reason: 'not_found', email: null, plan_id: null, order_id: null, expires_at: null });
        }
      } catch (err) {
        console.error('Token validation error:', err);
        setTokenData({ valid: false, reason: 'error', email: null, plan_id: null, order_id: null, expires_at: null });
      }
      setValidating(false);
    };

    validate();
  }, [token, setValue]);

  const onSubmit = async (data: SignupFormData) => {
    if (!token || !tokenData?.valid || !tokenData.email) return;

    setAuthError(null);
    setIsLoading(true);

    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: tokenData.email,
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
      const planCode = tokenData.plan_id || 'solo';

      // 2. Update phone
      await supabase.from('profiles').update({ phone: data.phone }).eq('id', userId);

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

      // 6. Consume token
      await supabase.rpc('consume_signup_token', { p_token: token });

      // 7. Mark allowed signup as used
      await supabase
        .from('allowed_establishment_signups')
        .update({ used: true })
        .eq('email', tokenData.email.toLowerCase().trim());

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

  // Invalid token states
  if (!tokenData?.valid) {
    const reason = tokenData?.reason || 'not_found';

    const stateConfig: Record<string, { icon: React.ReactNode; title: string; description: string; showLogin: boolean }> = {
      used: {
        icon: <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto" />,
        title: 'Convite já utilizado',
        description: 'Este link já foi utilizado para criar uma conta. Faça login para acessar.',
        showLogin: true,
      },
      expired: {
        icon: <Clock className="h-12 w-12 text-muted-foreground mx-auto" />,
        title: 'Convite expirado',
        description: 'Este link expirou. Entre em contato com o suporte para solicitar um novo.',
        showLogin: false,
      },
      cancelled: {
        icon: <Ban className="h-12 w-12 text-destructive mx-auto" />,
        title: 'Convite cancelado',
        description: 'Este convite foi cancelado. Entre em contato com o suporte.',
        showLogin: false,
      },
      not_found: {
        icon: <XCircle className="h-12 w-12 text-destructive mx-auto" />,
        title: 'Convite inválido',
        description: 'Nenhum token de convite fornecido ou o link está incorreto. Verifique o email recebido.',
        showLogin: false,
      },
      error: {
        icon: <AlertCircle className="h-12 w-12 text-destructive mx-auto" />,
        title: 'Erro na validação',
        description: 'Ocorreu um erro ao validar o convite. Tente novamente.',
        showLogin: false,
      },
    };

    const config = stateConfig[reason] || stateConfig.not_found;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <Logo />
          <div className="mt-6 space-y-4">
            {config.icon}
            <h1 className="text-xl font-bold">{config.title}</h1>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
          <div className="space-y-2">
            {config.showLogin && (
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
          <h1 className="mt-6 text-2xl font-bold tracking-tight">Criar sua conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">Complete o cadastro para acessar o Agendali</p>
        </div>

        <Alert variant="default" className="border-primary/20 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm">
            Pagamento confirmado! Plano <strong className="capitalize">{tokenData.plan_id || 'solo'}</strong> ativo para{' '}
            <strong>{tokenData.email}</strong>
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
              value={tokenData.email || ''}
              disabled
              className="bg-muted cursor-not-allowed"
            />
            <input type="hidden" {...register('email')} />
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
