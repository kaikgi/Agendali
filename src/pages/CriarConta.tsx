import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, Ban } from 'lucide-react';
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

  // Form state
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenData({ valid: false, reason: 'not_found', email: null, plan_id: null, order_id: null, expires_at: null });
      return;
    }

    const validate = async () => {
      try {
        const { data, error } = await supabase.rpc('check_signup_token', { p_token: token } as any);

        if (error) {
          console.error('Error validating token:', error);
          setTokenData({ valid: false, reason: 'error', email: null, plan_id: null, order_id: null, expires_at: null });
        } else if (data && Array.isArray(data) && data.length > 0) {
          const result = data[0] as TokenValidation;
          setTokenData(result);
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
  }, [token]);

  const passwordRules = useMemo(() => ({
    minLength: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]/.test(password),
  }), [password]);

  const isPasswordStrong = Object.values(passwordRules).every(Boolean);

  function validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) errors.fullName = 'Nome completo é obrigatório.';
    if (!companyName.trim()) errors.companyName = 'Nome da empresa é obrigatório.';
    
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 11) errors.phone = 'Informe um telefone válido com 11 dígitos.';
    
    if (!isPasswordStrong) errors.password = 'A senha deve atender a todos os requisitos.';
    if (password !== confirmPassword) errors.confirmPassword = 'As senhas não conferem.';
    if (!confirmPassword) errors.confirmPassword = 'Confirme sua senha.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !tokenData?.valid || !tokenData.email) return;
    if (!validateForm()) return;

    setAuthError(null);
    setIsLoading(true);

    try {
      const email = tokenData.email.toLowerCase().trim();
      const phoneDigits = phone.replace(/\D/g, '');
      const planCode = tokenData.plan_id || 'solo';

      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${getPublicBaseUrl()}/dashboard`,
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
            account_type: 'establishment_owner',
          },
        },
      });

      if (signUpError || !authData.user) {
        throw signUpError || new Error('Erro ao criar conta');
      }

      const userId = authData.user.id;

      // 2. Update phone on profile
      await supabase.from('profiles').update({ phone: phoneDigits }).eq('id', userId);

      // 3. Create establishment
      const { data: establishment, error: estError } = await supabase
        .from('establishments')
        .insert({
          owner_user_id: userId,
          name: companyName.trim(),
          status: 'active',
          plano: planCode,
        } as any)
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
      } as any);

      // 5. Create default business hours
      const defaultHours: any[] = [];
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
      await supabase.rpc('consume_signup_token', { p_token: token } as any);

      // 7. Mark allowed signup as used
      await supabase
        .from('allowed_establishment_signups')
        .update({ used: true })
        .eq('email', email);

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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Seu nome"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            {formErrors.fullName && <p className="text-sm text-destructive">{formErrors.fullName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input
              id="companyName"
              type="text"
              placeholder="Nome do seu estabelecimento"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            {formErrors.companyName && <p className="text-sm text-destructive">{formErrors.companyName}</p>}
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
            <p className="text-xs text-muted-foreground">
              O email é vinculado ao seu pagamento e não pode ser alterado.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <PhoneInput
              id="phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(val) => setPhone(val)}
            />
            {formErrors.phone && <p className="text-sm text-destructive">{formErrors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput
              id="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordStrength password={password} />
            {formErrors.password && <p className="text-sm text-destructive">{formErrors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar senha</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Repita a senha"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {formErrors.confirmPassword && <p className="text-sm text-destructive">{formErrors.confirmPassword}</p>}
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
