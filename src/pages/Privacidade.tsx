import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const Privacidade = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container max-w-4xl">
          <h1 className="text-display-md mb-8">Política de Privacidade</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-body-lg text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. Introdução</h2>
              <p className="text-muted-foreground">
                A Agendali está comprometida em proteger sua privacidade. Esta política descreve 
                como coletamos, usamos e protegemos suas informações pessoais quando você usa 
                nossa plataforma.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. Informações que Coletamos</h2>
              <p className="text-muted-foreground">
                Coletamos informações que você nos fornece diretamente, como nome, e-mail, 
                telefone e dados do estabelecimento. Também coletamos informações automaticamente, 
                como endereço IP, tipo de navegador e dados de uso da plataforma.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. Como Usamos suas Informações</h2>
              <p className="text-muted-foreground">
                Utilizamos suas informações para: fornecer e melhorar nossos serviços, processar 
                transações, enviar comunicações importantes, personalizar sua experiência e 
                cumprir obrigações legais.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. Compartilhamento de Informações</h2>
              <p className="text-muted-foreground">
                Não vendemos suas informações pessoais. Podemos compartilhar dados com prestadores 
                de serviços que nos ajudam a operar a plataforma, sempre sob acordos de 
                confidencialidade. Também podemos compartilhar informações quando exigido por lei.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Segurança dos Dados</h2>
              <p className="text-muted-foreground">
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas 
                informações contra acesso não autorizado, alteração, divulgação ou destruição. 
                Utilizamos criptografia e práticas de segurança padrão da indústria.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">6. Seus Direitos</h2>
              <p className="text-muted-foreground">
                Você tem direito a: acessar suas informações pessoais, corrigir dados imprecisos, 
                solicitar a exclusão de seus dados, exportar seus dados e retirar consentimento 
                para processamento. Para exercer esses direitos, entre em contato conosco.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">7. Cookies</h2>
              <p className="text-muted-foreground">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência, 
                analisar o uso da plataforma e personalizar conteúdo. Você pode gerenciar suas 
                preferências de cookies através das configurações do seu navegador.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">8. Retenção de Dados</h2>
              <p className="text-muted-foreground">
                Mantemos suas informações pelo tempo necessário para fornecer nossos serviços 
                e cumprir obrigações legais. Após o encerramento da conta, mantemos dados 
                por um período limitado para fins legais e administrativos.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">9. Alterações nesta Política</h2>
              <p className="text-muted-foreground">
                Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças 
                significativas através de e-mail ou aviso na plataforma. Recomendamos revisar 
                esta política regularmente.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">10. Contato</h2>
              <p className="text-muted-foreground">
                Para questões sobre privacidade ou para exercer seus direitos, entre em contato:{" "}
                <a href="mailto:agendaliapp@gmail.com" className="text-foreground underline underline-offset-4 hover:text-primary transition-colors">agendaliapp@gmail.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Privacidade;
