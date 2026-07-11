import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle } from 'lucide-react';
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
import { getPublicBaseUrl } from '@/lib/publicUrl';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';

export default function ClientLogin() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

    const email = String(data.email || "").trim();
    const password = String(data.password || "");

    if (!email || !password) {
      setIsLoading(false);
      setAuthError("Email e senha são obrigatórios.");
      return;
    }

    try {
      const { error } = await signIn(email, password);

      if (error) {
        setAuthError(error.message);
        return;
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      if (user?.user_metadata?.account_type === 'establishment_owner') {
        setAuthError('Essa conta é de estabelecimento. Por favor, acesse o painel.');
        return;
      }

      navigate('/client');
    } catch (err: any) {
      console.error('Client login error:', err);
      setAuthError(err.message || 'Erro ao realizar login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsLoading(true);

    const { error } = await signInWithGoogle(`${getPublicBaseUrl()}/client`);

    if (error) {
      setIsLoading(false);
      setAuthError(error.message);
      toast({
        variant: 'destructive',
        title: 'Erro ao conectar com Google',
        description: error.message,
      });
      return;
    }

    setIsLoading(false);
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
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Área do Cliente</h1>
                <p className="text-sm text-slate-600">Entre para agendar seus compromissos</p>
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
                    to="/cliente/esqueci-senha"
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Ou entre com</span>
              </div>
            </div>

            <GoogleSignInButton onClick={handleGoogleSignIn} isLoading={isLoading} />

            <div className="mt-6 space-y-2 text-center text-sm">
              <p className="text-slate-600">
                Não tem uma conta?{' '}
                <Link to="/cliente/cadastro" className="text-slate-900 font-medium hover:underline">Cadastre-se</Link>
              </p>
              <p className="text-slate-600">
                É um estabelecimento?{' '}
                <Link to="/login" className="text-slate-900 font-medium hover:underline">Painel de Estabelecimento</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
