import { Link } from 'react-router-dom';
import { Building2, User, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Entrar() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
          <h1 className="mt-6 text-2xl font-bold tracking-tight">
            Bem-vindo ao Agendali
          </h1>
          <p className="mt-2 text-muted-foreground">
            Escolha como deseja entrar
          </p>
        </div>

        <div className="grid gap-4">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <Link to="/cliente/login">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Sou Cliente</CardTitle>
                    <CardDescription>Quero agendar serviços</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  Acesse para ver seus agendamentos, histórico e buscar estabelecimentos.
                </p>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <Link to="/login">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">Sou Estabelecimento</CardTitle>
                    <CardDescription>Quero gerenciar minha agenda</CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">
                  Acesse o painel para gerenciar agendamentos, profissionais e serviços.
                </p>
              </CardContent>
            </Link>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Ainda não tem uma conta?
          </p>
          <div className="flex gap-4 justify-center mt-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/cliente/cadastro">Criar conta de Cliente</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/cadastro">Criar conta de Estabelecimento</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
