import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, LoginFormData } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { BackgroundGradient } from '@/components/ui/background-gradient';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showResendForm, setShowResendForm] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isSignupSuccess = new URLSearchParams(location.search).get('signup') === 'success';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    setIsLoading(true);

    const { error } = await signIn(
      data.email,
      data.password,
    );

    if (error) {
      setIsLoading(false);
      setAuthError(error.message);
      return;
    }

    if (user?.user_metadata?.account_type === 'customer') {
      setIsLoading(false);
      setAuthError('Essa conta é de cliente. Por favor, acesse a área do cliente.');
      return;
    }

    setIsLoading(false);
    navigate('/dashboard');
  };

  const handleResendClick = () => {
    setShowResendForm(!showResendForm);
    setResendSuccess(false);
  };

  const handleResendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendLoading(true);

    try {
      const { data: signupLink, error } = await supabase.functions.invoke('resend-signup-link', {
        body: { email: resendEmail },
      });

      if (error) throw error;

      setResendSuccess(true);
      setResendEmail('');
      toast({
        title: 'Email enviado!',
        description: 'Verifique sua caixa de entrada para o link de acesso.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar email',
        description: err.message || 'Tente novamente mais tarde',
      });
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-8">
      <BackgroundGradient />
      <div className="relative z-10 w-full max-w-md">
        {isSignupSuccess && (
          <Alert className="mb-4 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-800">
              Conta criada com sucesso! Você pode entrar agora.
            </AlertDescription>
          </Alert>
        )}

        <Card className="overflow-hidden bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-4 text-center mb-6">
              <Logo className="h-10 w-auto" showText={true} size="lg" />
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Painel do Estabelecimento</h1>
                <p className="text-sm text-slate-600">Entre com sua conta de estabelecimento</p>
              </div>
            </div>

            {authError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  className="bg-white border-slate-300"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-slate-700">Senha</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                  >
                    Esqueceu a senha?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  className="bg-white border-slate-300"
                  {...register('password')}
                />
                {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Entrar
              </Button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              <p className="text-slate-600">
                Não tem uma conta?{' '}
                <Link to="/cadastro" className="text-slate-900 font-medium hover:underline">Cadastre-se</Link>
              </p>
              <p className="text-slate-600">
                É cliente e quer agendar?{' '}
                <Link to="/cliente/login" className="text-slate-900 font-medium hover:underline">Área do Cliente</Link>
              </p>
              <button
                type="button"
                onClick={handleResendClick}
                className="text-slate-600 hover:text-slate-900 hover:underline"
              >
                Reenviar link de acesso
              </button>
            </div>
          </CardContent>
        </Card>

        {showResendForm && (
          <Card className="mt-4 bg-white border border-slate-100 shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Reenviar Link de Acesso</h3>
              {resendSuccess && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-sm text-green-800">
                    Link enviado com sucesso! Verifique seu email.
                  </AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleResendSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="resendEmail" className="text-sm text-slate-700">Email</Label>
                  <Input
                    id="resendEmail"
                    type="email"
                    placeholder="seu@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    disabled={resendLoading}
                    className="bg-white border-slate-300"
                  />
                </div>

                <Button type="submit" className="w-full text-sm" disabled={resendLoading || !resendEmail}>
                  {resendLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Reenviar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
