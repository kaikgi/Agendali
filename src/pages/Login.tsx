import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const { signIn, clearLocalSession } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData) => {
    setAuthError(null);
    setIsLoading(true);
    try {
      await clearLocalSession();
      const { error } = await signIn(data.email, data.password);
      if (error) {
        setAuthError(error.message);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.account_type === 'customer') {
        setAuthError('Conta de cliente. Use a área do cliente.');
        return;
      }
      navigate('/dashboard');
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao entrar');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <BackgroundGradient />
      <Card className="relative z-10 w-full max-w-md bg-white p-8 shadow-lg">
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <Logo size="lg" />
            <h1 className="text-2xl font-bold">Painel do Estabelecimento</h1>
          </div>
          {authError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{authError}</AlertDescription></Alert>}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register('email')} placeholder="seu@email.com" />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <PasswordInput {...register('password')} placeholder="Sua senha" />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
