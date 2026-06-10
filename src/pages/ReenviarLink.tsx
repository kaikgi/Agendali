import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ArrowLeft, Mail, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/Logo';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { BackgroundGradient } from '@/components/ui/background-gradient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as z from 'zod';

const schema = z.object({
  email: z.string().email('Email inválido.').min(1, 'Email é obrigatório.'),
});

type FormData = z.infer<typeof schema>;

export default function ReenviarLink() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const { data: resData, error } = await supabase.functions.invoke('resend-signup-link', {
        body: { email: data.email },
      });

      if (error) {
        console.error('[ReenviarLink] Edge function error:', error);
        setErrorMsg('Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde.');
        setIsLoading(false);
        return;
      }

      setSubmitted(true);
      toast({
        title: 'Solicitação processada!',
        description: 'Verifique sua caixa de entrada.',
      });
    } catch (err: any) {
      console.error('[ReenviarLink] Error:', err);
      setErrorMsg('Erro interno no servidor. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="relative min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <BackgroundGradient />
        <Card className="relative z-10 w-full max-w-md bg-white p-8 shadow-lg">
          <CardContent className="space-y-6 text-center">
            <Link to="/" className="inline-block">
              <Logo size="lg" />
            </Link>
            
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight">
                Verifique seu email
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Se o email <strong className="text-slate-900">{getValues('email')}</strong> estiver autorizado e com pagamento confirmado, enviaremos um novo link de cadastro em instantes.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setSubmitted(false)}
              >
                Tentar outro email
              </Button>
              
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
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <BackgroundGradient />
      <Card className="relative z-10 w-full max-w-md bg-white p-8 shadow-lg">
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <Link to="/" className="inline-block">
              <Logo size="lg" />
            </Link>
            <h1 className="text-2xl font-bold">Não recebeu o link?</h1>
            <p className="text-sm text-slate-500">
              Digite seu email da compra para reenviar o link de cadastro
            </p>
          </div>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMsg}</AlertDescription>
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
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reenviar link de cadastro
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
  );
}
