import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Shield, Lock, Eye, Database, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Seguranca = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Segurança da Informação</h1>
            <p className="text-xl text-muted-foreground">
              Como protegemos seus dados e garantimos a confiabilidade do Agendali.
            </p>
          </div>
          
          <div className="grid gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-6 w-6 text-primary" />
                  Proteção de Dados e RLS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Utilizamos <strong>Row Level Security (RLS)</strong> no nosso banco de dados. Isso garante que cada estabelecimento tenha seus dados isolados de forma lógica e física, impedindo que um usuário acesse informações de outro "tenant".
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-6 w-6 text-primary" />
                  Criptografia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Todos os dados em trânsito são protegidos por criptografia <strong>TLS/SSL</strong>. Dados sensíveis no banco de dados, como tokens de integração, são armazenados de forma segura e inacessíveis diretamente pelo frontend.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-6 w-6 text-primary" />
                  Infraestrutura
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Nossa infraestrutura é baseada no Supabase e Google Cloud Platform, contando com backups automáticos, alta disponibilidade e monitoramento constante de integridade.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-6 w-6 text-primary" />
                  Auditoria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Mantemos logs de auditoria para ações administrativas críticas, permitindo rastrear quem fez o quê e quando, garantindo transparência e segurança operacional.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-6 w-6 text-primary" />
                  Conformidade LGPD
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Estamos em conformidade com a Lei Geral de Proteção de Dados (LGPD), oferecendo ferramentas para que usuários e clientes exerçam seus direitos de acesso, retificação e exclusão de dados.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Seguranca;
