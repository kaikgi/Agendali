import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const Recursos = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <FeaturesSection />
        
        {/* CTA Section */}
        <section className="py-16 bg-primary text-primary-foreground">
          <div className="container text-center">
            <h2 className="text-display-sm md:text-display-md mb-4">
              Pronto para começar?
            </h2>
            <p className="text-body-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Escolha o plano ideal para o seu negócio e comece a receber agendamentos hoje.
            </p>
            <Button variant="secondary" size="xl" asChild>
              <Link to="/precos">
                Ver planos
                <ArrowRight size={18} />
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Recursos;
