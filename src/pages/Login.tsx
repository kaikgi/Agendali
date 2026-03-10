import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, LoginFormData } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { PasswordInput } from '@/components/ui/password-input';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [accountTypeError, setAccountTypeError] = useState<string | null>(null);
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Resend link state
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Show success message from signup redirect
  const signupSuccess = searchParams.get('signup') === 'success';

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, user, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setAccountTypeError(null);
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      setIsLoading(false);
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
      });
      return;
    }

    // Check account type after successful login
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', userData.user.id)
        .single();

      if (profile?.account_type === 'customer') {
        setIsLoading(false);
        await supabase.auth.signOut();
        setAccountTypeError('Esta é a área de estabelecimentos. Para acessar como cliente, use a Área do Cliente.');
        return;
      }
    }

    setIsLoading(false);
    toast({
      title: 'Bem-vindo de volta!',
      description: 'Login realizado com sucesso.',
    });
    navigate('/dashboard');
  };

  const handleResendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = resendEmail.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setResendError('Informe um email válido.');
      return;
    }

    setResendLoading(true);
    setResendError(null);
    setResendSuccess(false);

    try {
      const { data, error } = await supabase.functions.invoke('resend-signup-link', {
        body: { email: trimmedEmail },
      });

      if (error) {
        throw new Error('Erro ao processar solicitação.');
      }

      if (data?.success === false && data?.message) {
        setResendError(data.message);
      } else {
        setResendSuccess(true);
      }
    } catch (err: any) {
      setResendError(err?.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Área do Estabelecimento
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse o painel de gerenciamento
          </p>
        </div>

        {signupSuccess && (
          <Alert className="border-primary/20 bg-primary/5">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <AlertDescription>
              Conta criada com sucesso! Faça login para acessar.
            </AlertDescription>
          </Alert>
        )}

        {accountTypeError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {accountTypeError}{' '}
              <Link to="/cliente/login" className="font-medium underline">
                Ir para Área do Cliente
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link 
                to="/esqueci-senha" 
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput
              id="password"
              placeholder="••••••••"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Não tem uma conta?{' '}
          <Link to="/cadastro" className="font-medium text-foreground hover:underline">
            Criar conta de estabelecimento
          </Link>
        </p>

        <p className="text-center text-sm text-muted-foreground">
          É cliente e quer agendar?{' '}
          <Link to="/cliente/login" className="font-medium text-primary hover:underline">
            Área do Cliente
          </Link>
        </p>

        {/* Resend signup link section */}
        <div className="border-t pt-4">
          {!showResendForm ? (
            <button
              type="button"
              onClick={() => setShowResendForm(true)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              Não recebeu o link de cadastro?
            </button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Reenviar link de cadastro</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Informe o email usado na compra. Se o pagamento estiver confirmado, enviaremos um novo link.
              </p>

              {resendSuccess ? (
                <Alert className="border-primary/20 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-sm">
                    Se o seu pagamento estiver confirmado e a conta ainda não tiver sido criada, enviaremos um novo link para o seu email.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleResendLink} className="space-y-3">
                  <Input
                    type="email"
                    placeholder="Email da compra"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={resendLoading}
                  />
                  {resendError && (
                    <p className="text-sm text-destructive">{resendError}</p>
                  )}
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full"
                    disabled={resendLoading}
                  >
                    {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Reenviar link
                  </Button>
                </form>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowResendForm(false);
                  setResendSuccess(false);
                  setResendError(null);
                  setResendEmail('');
                }}
                className="w-full text-center text-xs text-muted-foreground hover:underline"
              >
                Voltar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
