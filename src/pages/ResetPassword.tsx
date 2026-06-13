import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { PasswordInput } from '@/components/ui/password-input';
import { PasswordStrength } from '@/components/ui/password-strength';
import { Card, CardContent } from '@/components/ui/card';
import { BackgroundGradient } from '@/components/ui/background-gradient';

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Senha deve ter pelo menos 8 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~';]).{8,}$/,
      'Senha deve conter maiúscula, minúscula, número e caractere especial'
    ),
  confirmPassword: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const password = watch('password', '');

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
        // Determine redirect based on account type
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', session.user.id)
          .single();
        if (profile?.account_type === 'customer') {
          setRedirectPath('/client');
        }
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY' && session) {
            setHasSession(true);
            const { data: profile } = await supabase
              .from('profiles')
              .select('account_type')
              .eq('id', session.user.id)
              .single();
            if (profile?.account_type === 'customer') {
              setRedirectPath('/client');
            }
          }
        });
        
        return () => subscription.unsubscribe();
      }
    };
    
    checkSession();
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    setIsLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao redefinir senha',
        description: error.message,
      });
      return;
    }

    setIsSuccess(true);
    toast({
      title: 'Senha redefinida!',
      description: 'Sua nova senha foi salva com sucesso.',
    });

    setTimeout(() => {
      navigate(redirectPath);
    }, 2000);
  };

  if (isSuccess) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-8">
        <BackgroundGradient />
        <div className="relative z-10 w-full max-w-md">
          <Card className="overflow-hidden bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 sm:p-8 space-y-6 text-center">
              <Link to="/" className="inline-block">
                <Logo />
              </Link>
              
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Senha redefinida!
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sua senha foi redefinida com sucesso.
                </p>
              </div>

              <Button asChild className="w-full">
                <Link to="/login">Ir para o login</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-8">
        <BackgroundGradient />
        <div className="relative z-10 w-full max-w-md">
          <Card className="overflow-hidden bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-shadow">
            <CardContent className="p-6 sm:p-8 space-y-6 text-center">
              <Link to="/" className="inline-block">
                <Logo />
              </Link>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Redefinir senha
                </h1>
                <p className="text-sm text-muted-foreground">
                  Clique no link enviado para seu email para continuar.
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="animate-pulse flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Aguardando autenticação...</span>
                </div>

                <Link to="/login" className="block w-full">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar para o login
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center px-4 py-8">
      <BackgroundGradient />
      <div className="relative z-10 w-full max-w-md">
        <Card className="overflow-hidden bg-white border border-slate-100 shadow-lg hover:shadow-xl transition-shadow">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <Link to="/" className="inline-block">
                <Logo />
              </Link>
              <h1 className="text-2xl font-bold tracking-tight">
                Nova senha
              </h1>
              <p className="text-sm text-muted-foreground">
                Crie uma nova senha segura para sua conta
              </p>
            </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput
              id="password"
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              {...register('password')}
            />
            <PasswordStrength password={password} />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <PasswordInput
              id="confirmPassword"
              placeholder="Repita a senha"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redefinir senha
          </Button>
        </form>

            <Link to="/login" className="block w-full pt-2">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
