import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
import { Card, CardContent } from '@/components/ui/card';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { z } from 'zod';

const phoneRegex = /^\d{10,11}$/;
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]).{8,}$/;

const getSignupSchema = (isAuthenticated: boolean) => {
  const base = z.object({
    fullName: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(100, 'Nome muito longo'),
    companyName: z
      .string()
      .min(2, 'Nome da empresa deve ter pelo menos 2 caracteres')
      .max(100, 'Nome da empresa muito longo'),
    email: z
      .string()
      .min(1, 'Email é obrigatório')
      .email('Email inválido'),
    phone: z
      .string()
      .regex(phoneRegex, 'Telefone deve ter DDD + 8 ou 9 dígitos'),
  });

  if (isAuthenticated) {
    return base;
  }

  return base.extend({
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(strongPasswordRegex, 'Senha deve conter maiúscula, minúscula, número e caractere especial'),
    confirmPassword: z
      .string()
      .min(1, 'Confirmação de senha é obrigatória'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
};

interface SignupFormData {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  password?: string;
  confirmPassword?: string;
}

export default function Signup() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const { signUp, completeSignup, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isAuthenticated = !!user;

  const schema = useMemo(() => {
    return getSignupSchema(isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => console.warn('Could not fetch IP address for legal acceptance log'));
  }, []);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (user?.email) {
      setValue('email', user.email);
    }
  }, [user, setValue]);

  const password = watch('password', '');

  const onSubmit = async (data: SignupFormData) => {
    if (!acceptedTerms) {
      toast({
        variant: 'destructive',
        title: 'Termos não aceitos',
        description: 'Você precisa aceitar os Termos de Uso e a Política de Privacidade para continuar.',
      });
      return;
    }

    setAuthError(null);
    setIsLoading(true);

    try {
      if (!isAuthenticated) {
        // Cenário A: Usuário desautenticado. Cria credencial e completa cadastro via RPC
        const { error } = await signUp({
          email: data.email,
          password: data.password || '',
          fullName: data.fullName,
          companyName: data.companyName,
          phone: data.phone,
        });

        if (error) {
          setIsLoading(false);
          setAuthError(error.message);
          toast({
            variant: 'destructive',
            title: 'Erro ao criar conta',
            description: error.message,
          });
          return;
        }
      } else {
        // Cenário B: Usuário já autenticado. Completa o cadastro diretamente
        const { error } = await completeSignup({
          userId: user.id,
          fullName: data.fullName,
          companyName: data.companyName,
          phone: data.phone,
        });

        if (error) {
          setIsLoading(false);
          setAuthError(error.message);
          toast({
            variant: 'destructive',
            title: 'Erro ao completar cadastro',
            description: error.message,
          });
          return;
        }
      }

      // Legal Acceptance logs
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (currentUserId) {
        const { data: estData } = await supabase
          .from('establishments')
          .select('id')
          .eq('owner_user_id', currentUserId)
          .maybeSingle();

        await supabase.from('legal_acceptance_logs').insert({
          user_id: currentUserId,
          establishment_id: estData?.id,
          document_type: 'terms_and_privacy',
          document_version: '1.0',
          ip_address: ipAddress,
          user_agent: navigator.userAgent
        });
      }

      toast({
        title: 'Conta criada com sucesso!',
        description: 'Seu estabelecimento está pronto. Bem-vindo ao Agendali!',
      });
      
      // Clear session/refresh cache
      window.location.href = '/dashboard';
    } catch (err: any) {
      console.error('[Signup] Submit error:', err);
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: err?.message || 'Ocorreu um erro ao processar o cadastro.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-8">
      <BackgroundGradient />
      <div className="relative z-10 w-full max-w-md">
        <Card className="overflow-hidden bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 text-center mb-6">
              <Logo className="h-10 w-auto" showText={true} size="lg" />
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Criar Conta de Estabelecimento</h1>
                <p className="text-sm text-slate-600">Acesse o Agendali com seu email autorizado</p>
              </div>
            </div>

            <Alert className="mb-4 border-blue-200 bg-blue-50">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                Para criar sua conta, você precisa ter um plano ativo.{' '}
                <Link to="/precos" className="font-medium underline">
                  Veja os planos disponíveis
                </Link>
              </AlertDescription>
            </Alert>

            {isAuthenticated && (
              <Alert className="mb-4 border-amber-200 bg-amber-50">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800">
                  Você já está autenticado como <strong>{user?.email}</strong>. Preencha os dados restantes abaixo para completar o cadastro do seu estabelecimento.
                </AlertDescription>
              </Alert>
            )}

            {authError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-700">Nome completo</Label>
                <Input id="fullName" type="text" placeholder="Seu nome" autoComplete="name" className="bg-white border-slate-300" {...register('fullName')} />
                {errors.fullName && <p className="text-sm text-red-600">{errors.fullName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-slate-700">Nome da empresa</Label>
                <Input id="companyName" type="text" placeholder="Nome do seu estabelecimento" autoComplete="organization" className="bg-white border-slate-300" {...register('companyName')} />
                {errors.companyName && <p className="text-sm text-red-600">{errors.companyName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email <span className="text-slate-500 text-xs">(mesmo usado na compra)</span></Label>
                <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" className="bg-white border-slate-300" disabled={isAuthenticated} {...register('email')} />
                {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-700">Telefone</Label>
                <Controller
                  name="phone"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <PhoneInput id="phone" placeholder="(11) 99999-9999" value={field.value} onChange={field.onChange} className="bg-white border-slate-300" />
                  )}
                />
                {errors.phone && <p className="text-sm text-red-600">{errors.phone.message}</p>}
              </div>

              {!isAuthenticated && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-slate-700">Senha</Label>
                    <PasswordInput id="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" className="bg-white border-slate-300" {...register('password')} />
                    <PasswordStrength password={password || ''} />
                    {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-slate-700">Confirmar senha</Label>
                    <PasswordInput id="confirmPassword" placeholder="Repita a senha" autoComplete="new-password" className="bg-white border-slate-300" {...register('confirmPassword')} />
                    {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
                  </div>
                </>
              )}

              <div className="flex items-start space-x-2 py-2">
                <input
                  type="checkbox"
                  id="terms"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  required
                />
                <Label htmlFor="terms" className="text-sm text-slate-600 font-normal leading-tight">
                  Li e aceito os{' '}
                  <Link to="/termos" target="_blank" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    Termos de Uso <ExternalLink className="h-3 w-3" />
                  </Link>{' '}
                  e a{' '}
                  <Link to="/privacidade" target="_blank" className="text-primary hover:underline inline-flex items-center gap-0.5">
                    Política de Privacidade <ExternalLink className="h-3 w-3" />
                  </Link>.
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar conta
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              <p className="text-slate-600">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-slate-900 font-medium hover:underline">Entrar</Link>
              </p>
              <p className="text-slate-600">
                É cliente e quer agendar?{' '}
                <Link to="/cliente/login" className="text-slate-900 font-medium hover:underline">Área do Cliente</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
