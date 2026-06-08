import { PlanCardsGrid } from "@/components/billing/PlanCardsGrid";

export function PricingSection() {
  return (
    <section id="precos" className="py-16 md:py-24 bg-secondary/30">
      <div className="container max-w-6xl px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preços</p>
          <h2 className="text-3xl md:text-4xl font-bold text-balance mb-4">
            Planos simples, sem surpresas
          </h2>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Escolha o plano ideal para o seu negócio e comece a usar agora.
          </p>
        </div>

        <PlanCardsGrid ctaLabel="Escolher plano" />

        <p className="text-center text-sm text-muted-foreground mt-10">
          Precisa de mais?{" "}
          <a
            href="https://www.agendali.online/contato"
            className="text-foreground font-medium underline underline-offset-4 hover:text-primary transition-colors"
          >
            Fale com nosso time
          </a>
        </p>
      </div>
    </section>
  );
}
