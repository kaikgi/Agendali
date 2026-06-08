import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Calendar, Users, Target, Heart } from "lucide-react";

const Sobre = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-24 pb-16">
        <div className="container">
          {/* Hero */}
          <div className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-label text-muted-foreground uppercase tracking-wider mb-4">
              Sobre nós
            </p>
            <h1 className="text-display-lg mb-6">
              Simplificando agendamentos para profissionais em todo o Brasil
            </h1>
            <p className="text-body-lg text-muted-foreground">
              A Agendali nasceu da necessidade real de profissionais que perdiam tempo 
              com agendamentos manuais e buscavam uma solução simples e eficiente.
            </p>
          </div>

          {/* Values */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {[
              {
                icon: Calendar,
                title: "Simplicidade",
                description: "Acreditamos que tecnologia deve simplificar, não complicar. Cada recurso é pensado para ser intuitivo."
              },
              {
                icon: Users,
                title: "Foco no cliente",
                description: "Nossos clientes são profissionais ocupados. Cada decisão é tomada pensando em economizar seu tempo."
              },
              {
                icon: Target,
                title: "Eficiência",
                description: "Menos cliques, menos configurações, mais resultados. Automatizamos o que é repetitivo."
              },
              {
                icon: Heart,
                title: "Paixão",
                description: "Somos apaixonados por criar produtos que realmente fazem diferença na vida das pessoas."
              }
            ].map((value) => (
              <div key={value.title} className="p-6 rounded-2xl bg-card border border-border">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <value.icon className="text-primary" size={24} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{value.title}</h3>
                <p className="text-body-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>

          {/* Mission */}
          <div className="bg-secondary/50 rounded-2xl p-8 md:p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-display-sm mb-4">Nossa missão</h2>
            <p className="text-body-lg text-muted-foreground">
              Empoderar profissionais e pequenos negócios com ferramentas de agendamento 
              modernas, acessíveis e fáceis de usar, permitindo que foquem no que realmente 
              importa: atender seus clientes com excelência.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Sobre;
