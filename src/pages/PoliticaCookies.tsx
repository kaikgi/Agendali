import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const PoliticaCookies = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container max-w-4xl">
          <h1 className="text-display-md mb-8">Política de Cookies</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-body-lg text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. O que são Cookies?</h2>
              <p className="text-muted-foreground">
                Cookies são pequenos arquivos de texto enviados pelo site ao seu computador ou dispositivo móvel para coletar informações sobre sua navegação. Eles nos ajudam a reconhecer você em visitas futuras e a melhorar sua experiência.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. Como usamos os Cookies?</h2>
              <p className="text-muted-foreground">
                Usamos cookies para:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground">
                <li>Manter você conectado à sua conta (Cookies essenciais).</li>
                <li>Lembrar suas preferências de idioma e temas.</li>
                <li>Entender como você utiliza a plataforma para melhorar nossos serviços.</li>
                <li>Garantir a segurança da sua conta e da plataforma.</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. Tipos de Cookies que utilizamos</h2>
              <p className="text-muted-foreground">
                <strong>Cookies Necessários:</strong> Fundamentais para o funcionamento do site. Sem eles, o site não funciona corretamente.
                <br />
                <strong>Cookies de Desempenho:</strong> Coletam dados anônimos sobre como os usuários interagem com o site.
                <br />
                <strong>Cookies de Funcionalidade:</strong> Permitem que o site lembre de escolhas feitas por você.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. Como gerenciar os Cookies?</h2>
              <p className="text-muted-foreground">
                Você pode desativar ou excluir os cookies nas configurações do seu navegador a qualquer momento. No entanto, desativar cookies essenciais pode impedir que você utilize certas funcionalidades do Agendali.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Contato</h2>
              <p className="text-muted-foreground">
                Dúvidas sobre nossa política de cookies? Envie um e-mail para: <a href="mailto:agendaliapp@gmail.com" className="text-foreground underline">agendaliapp@gmail.com</a>
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PoliticaCookies;
