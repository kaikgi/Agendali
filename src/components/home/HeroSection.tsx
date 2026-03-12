import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { MockupCarousel } from "./MockupCarousel";

import professional1 from "@/assets/avatars/professional-1.jpg";
import professional2 from "@/assets/avatars/professional-2.jpg";
import professional3 from "@/assets/avatars/professional-3.jpg";
import professional4 from "@/assets/avatars/professional-4.jpg";
import professional5 from "@/assets/avatars/professional-5.jpg";

const professionalAvatars = [professional1, professional2, professional3, professional4, professional5];

export function HeroSection() {
  return (
    <section className="relative pt-28 pb-16 md:pt-36 md:pb-24 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-dots opacity-50" />
      {/* Gradient orb */}
      <div className="absolute top-1/4 right-1/4 w-64 md:w-96 h-64 md:h-96 bg-muted rounded-full blur-3xl opacity-60" />

      <div className="relative container max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
          {/* Left content */}
          <div className="animate-fade-in-up text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border mb-6">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-body-sm text-muted-foreground">
                Agendamento online para profissionais
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-display-md sm:text-display-lg lg:text-display-xl text-balance max-w-[600px] mx-auto lg:mx-0 mb-5">
              Agendamentos simples.{" "}
              <span className="text-muted-foreground">Negócio eficiente.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-body-lg text-muted-foreground max-w-[500px] mx-auto lg:mx-0 mb-8">
              Transforme a experiência de agendamento dos seus clientes com uma plataforma
              minimalista, poderosa e feita para profissionais que valorizam seu tempo.
            </p>

            {/* CTAs */}
            <div className="flex justify-center lg:justify-start mb-8">
              <Button variant="hero" size="xl" asChild>
                <Link to="/precos">
                  Ver planos
                  <ArrowRight size={18} />
                </Link>
              </Button>
            </div>

            {/* Social proof */}
            <div className="flex items-center justify-center lg:justify-start gap-4">
              <div className="flex -space-x-2">
                {professionalAvatars.map((avatar, i) => (
                  <img
                    key={i}
                    src={avatar}
                    alt={`Profissional ${i + 1}`}
                    className="w-8 h-8 rounded-full border-2 border-background object-cover"
                  />
                ))}
              </div>
              <div className="text-body-sm text-muted-foreground">
                Profissionais já confiam na <span className="font-semibold text-foreground">Agendali</span>
              </div>
            </div>
          </div>

          {/* Right content - Premium Mockup Carousel */}
          <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <MockupCarousel />
          </div>
        </div>
      </div>
    </section>
  );
}
