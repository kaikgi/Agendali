import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { loginSchema, LoginFormData } from '@/lib/validations/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { supabase } from '@/integrations/supabase/client';
import { PasswordInput } from '@/components/ui/password-input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { BackgroundGradient } from '@/components/ui/background-gradient';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const translateAuthError = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
      return 'E-mail ou senha inválidos.';
    }
    if (lower.includes('email not confirmed')) {
      return 'Confirme seu e-mail antes de entrar.';
    }
    if (lower.includes('too many requests')) {
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    }
    // Não diferenciar "usuário não encontrado" de senha inválida: evita enumeração de e-mails.
    if (lower.includes('user not found')) {
      return 'E-mail ou senha inválidos.';
    }
    if (lower.includes('network') || lower.includes('fetch')) {
      return 'Não foi possível entrar. Verifique sua conexão e tente novamente.';
    }
    // Logar erro bruto apenas em desenvolvimento — não exibir ao usuário
    if (import.meta.env.DEV) {
      console.warn('[AUTH] Erro bruto do Supabase:', message);
    }
    return 'Não foi possível entrar. Tente novamente.';
  };

  const onSubmit = async (data: LoginFormData) => {
    const startTime = Date.now();
    const emailNormal = data.email.toLowerCase().trim();
    console.log('[LOGIN] submit iniciado', {
      email: emailNormal,
      passwordPreenchida: !!data.password
    });

    setAuthError(null);
    setIsLoading(true);
    try {
      console.log('[LOGIN] chamando signInWithPassword');
      const { error } = await signIn(emailNormal, data.password);
      console.log('[LOGIN] signInWithPassword retornou', {
        sucesso: !error,
        erro: error?.message
      });

      if (error) {
        setAuthError(translateAuthError(error.message));
        return;
      }

      console.log('[LOGIN] obtendo dados do usuário no Supabase...');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      console.log('[LOGIN] supabase.auth.getUser retornou', {
        userExistente: !!userData?.user,
        email: userData?.user?.email,
        erro: userError?.message
      });

      if (userError) {
        setAuthError(translateAuthError(userError.message));
        return;
      }

      const user = userData.user;
      if (user?.user_metadata?.account_type === 'customer') {
        console.log('[LOGIN] acesso negado: conta do tipo cliente');
        setAuthError('Esta é uma conta de cliente. Use a Área do Cliente para agendar.');
        return;
      }

      console.log('[LOGIN] redirecionando para /dashboard');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('[LOGIN] erro capturado no catch:', err);
      setAuthError(translateAuthError(err.message || 'Erro ao entrar'));
    } finally {
      console.log('[LOGIN] finally executado', {
        tempoTotalMs: Date.now() - startTime
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-8">
      <BackgroundGradient />
      <div className="relative z-10 w-full max-w-md">
        <Card className="overflow-hidden bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <Logo size="lg" />
              <h1 className="text-2xl font-bold">Painel do Estabelecimento</h1>
              <p className="text-sm text-slate-500">Entre com sua conta de estabelecimento</p>
            </div>
            {authError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{authError}</AlertDescription></Alert>}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register('email')} placeholder="seu@email.com" />
                {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link to="/esqueci-senha" className="text-xs text-slate-500 hover:text-slate-900 font-medium hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
                <PasswordInput id="password" {...register('password')} placeholder="Sua senha" />
                {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
                Entrar
              </Button>
            </form>

            <div className="mt-6 space-y-3 text-center text-sm border-t border-slate-100 pt-6">
              <p className="text-slate-600">
                Não tem uma conta?{' '}
                <Link to="/signup" className="text-slate-900 font-semibold hover:underline">
                  Criar conta de estabelecimento
                </Link>
              </p>
              <p className="text-slate-600">
                É cliente e quer agendar?{' '}
                <Link to="/cliente/login" className="text-slate-900 font-semibold hover:underline">
                  Área do Cliente
                </Link>
              </p>
              <p className="text-slate-600 pt-1">
                <Link to="/reenviar-link" className="text-slate-500 hover:text-slate-900 font-medium hover:underline">
                  Não recebeu o link de cadastro?
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
