import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export function CTASection() {
  return (
    <section className="py-16 md:py-20 bg-primary text-primary-foreground">
      <div className="container max-w-2xl text-center">
        <h2 className="text-display-sm md:text-display-md text-balance mb-4">
          Pronto para transformar seus agendamentos?
        </h2>
        <p className="text-body-md text-primary-foreground/80 mb-8">
          Junte-se a milhares de profissionais que já simplificaram sua rotina com Agendali.
        </p>
        <Button variant="secondary" size="xl" asChild>
          <Link to="/precos">
            Ver planos e assinar
            <ArrowRight size={18} />
          </Link>
        </Button>
      </div>
    </section>
  );
}
