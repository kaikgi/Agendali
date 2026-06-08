import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
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
import { Card, CardContent } from '@/components/ui/card';
import { BackgroundGradient } from '@/components/ui/background-gradient';

export default function Signup() {
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
  });

  const password = watch('password', '');

  const onSubmit = async (data: SignupFormData) => {
    setAuthError(null);
    setIsLoading(true);

    const { error } = await signUp({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
      companyName: data.companyName,
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

    // Profile is auto-created by database trigger with account_type from metadata.
    // Update phone number since it's not in the signUp metadata.
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      await supabase.from('profiles').update({
        phone: data.phone,
      }).eq('id', userData.user.id);
    }

    setIsLoading(false);
    toast({
      title: 'Conta criada com sucesso!',
      description: 'Seu estabelecimento está pronto. Bem-vindo ao Agendali!',
    });
    navigate('/dashboard');
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
                <Input id="email" type="email" placeholder="seu@email.com" autoComplete="email" className="bg-white border-slate-300" {...register('email')} />
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

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700">Senha</Label>
                <PasswordInput id="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" className="bg-white border-slate-300" {...register('password')} />
                <PasswordStrength password={password} />
                {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-700">Confirmar senha</Label>
                <PasswordInput id="confirmPassword" placeholder="Repita a senha" autoComplete="new-password" className="bg-white border-slate-300" {...register('confirmPassword')} />
                {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
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
