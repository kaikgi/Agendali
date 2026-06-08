import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const Termos = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container max-w-4xl">
          <h1 className="text-display-md mb-8">Termos de Uso</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
            <p className="text-body-lg text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </p>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">1. Aceitação dos Termos</h2>
              <p className="text-muted-foreground">
                Ao acessar e usar a plataforma Agendali, você concorda em cumprir e estar vinculado 
                a estes Termos de Uso. Se você não concordar com qualquer parte destes termos, 
                não poderá acessar ou usar nossos serviços.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">2. Descrição do Serviço</h2>
              <p className="text-muted-foreground">
                A Agendali é uma plataforma de agendamento online que permite a profissionais e 
                estabelecimentos gerenciar seus horários e receber agendamentos de clientes. 
                Oferecemos diferentes planos de assinatura com recursos variados.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">3. Cadastro e Conta</h2>
              <p className="text-muted-foreground">
                Para utilizar nossos serviços, você deve criar uma conta fornecendo informações 
                precisas e atualizadas. Você é responsável por manter a confidencialidade de sua 
                senha e por todas as atividades realizadas em sua conta.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">4. Uso Aceitável</h2>
              <p className="text-muted-foreground">
                Você concorda em usar a plataforma apenas para fins legais e de acordo com estes 
                termos. É proibido usar a plataforma para atividades fraudulentas, spam, ou 
                qualquer atividade que viole leis aplicáveis.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">5. Pagamentos e Assinaturas</h2>
              <p className="text-muted-foreground">
                Os pagamentos são processados mensalmente através de nossos parceiros de pagamento. 
                Você pode cancelar sua assinatura a qualquer momento, mas não há reembolso por 
                períodos parciais. Os preços podem ser alterados com aviso prévio de 30 dias.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">6. Propriedade Intelectual</h2>
              <p className="text-muted-foreground">
                Todo o conteúdo da plataforma, incluindo mas não limitado a textos, gráficos, 
                logos e software, é propriedade da Agendali ou de seus licenciadores e está 
                protegido por leis de propriedade intelectual.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">7. Limitação de Responsabilidade</h2>
              <p className="text-muted-foreground">
                A Agendali não se responsabiliza por danos indiretos, incidentais ou consequenciais 
                decorrentes do uso ou impossibilidade de uso da plataforma. Nossa responsabilidade 
                total é limitada ao valor pago pelo usuário nos últimos 12 meses.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">8. Modificações</h2>
              <p className="text-muted-foreground">
                Reservamo-nos o direito de modificar estes termos a qualquer momento. Mudanças 
                significativas serão comunicadas com antecedência. O uso continuado da plataforma 
                após as alterações constitui aceitação dos novos termos.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-semibold">9. Contato</h2>
              <p className="text-muted-foreground">
                Para questões sobre estes Termos de Uso, entre em contato através do e-mail:{" "}
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

export default Termos;
