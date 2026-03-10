import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { useProfessionalPortalAuth } from '@/hooks/useProfessionalPortal';
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/Logo';

export default function ProfessionalPortalLogin() {
  const { establishmentSlug, professionalSlug } = useParams<{
    establishmentSlug: string;
    professionalSlug: string;
  }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { login, isLoggingIn, isAuthenticated, session } = useProfessionalPortalAuth();
  
  const [password, setPassword] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && session) {
      navigate(`/${establishmentSlug}/p/${professionalSlug}/agenda`, { replace: true });
    }
  }, [isAuthenticated, session, establishmentSlug, professionalSlug, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      toast({ title: 'Digite sua senha', variant: 'destructive' });
      return;
    }

    if (!establishmentSlug || !professionalSlug) {
      toast({ title: 'URL inválida', variant: 'destructive' });
      return;
    }

    try {
      await login({
        establishmentSlug,
        professionalSlug,
        password,
      });
      toast({ title: 'Login realizado com sucesso!' });
      navigate(`/${establishmentSlug}/p/${professionalSlug}/agenda`, { replace: true });
    } catch (error: any) {
      const msg = error?.message || 'Verifique sua senha e tente novamente';
      const isDisabled = msg.toLowerCase().includes('desativado');
      const isNotFound = msg.toLowerCase().includes('não encontrado');
      const isNoPassword = msg.toLowerCase().includes('senha não configurada');
      toast({
        title: isDisabled
          ? 'Portal desativado'
          : isNotFound
          ? 'Profissional não encontrado'
          : isNoPassword
          ? 'Senha não configurada'
          : 'Senha incorreta',
        description: isDisabled
          ? 'O portal está desativado. Solicite ao estabelecimento para reativá-lo.'
          : isNotFound
          ? 'Verifique se o link de acesso está correto.'
          : isNoPassword
          ? 'Solicite ao administrador do estabelecimento para configurar sua senha de acesso.'
          : 'A senha digitada está incorreta. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center space-y-3 pb-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Portal do Profissional</CardTitle>
              <CardDescription className="mt-1">
                Acesse sua agenda individual
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">Senha de acesso</Label>
                <PasswordInput
                  id="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoggingIn}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Sua senha foi fornecida pelo administrador do estabelecimento.
                </p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoggingIn} size="lg">
                {isLoggingIn ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>

            <Button
              variant="ghost"
              className="w-full mt-4 text-muted-foreground"
              onClick={() => navigate(`/${establishmentSlug}`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao site
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso restrito a profissionais cadastrados.
        </p>
      </div>
    </div>
  );
}
