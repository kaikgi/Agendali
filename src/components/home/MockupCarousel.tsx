import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowRight, Calendar, Clock, Users, Scissors, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";

const examples = [
  {
    type: "barbearia",
    label: "Barbearia",
    icon: Scissors,
    title: "Barbearia Royal",
    slug: "barbearia-royal",
    weekly: 18,
    services: [
      { name: "Corte + Barba", duration: "45min", price: "R$ 75" },
      { name: "Fade", duration: "30min", price: "R$ 55" },
      { name: "Sobrancelha", duration: "15min", price: "R$ 25" },
    ],
  },
  {
    type: "nail",
    label: "Nail Design",
    icon: Sparkles,
    title: "Nail Studio",
    slug: "nail-studio",
    weekly: 12,
    services: [
      { name: "Alongamento em Gel", duration: "2h", price: "R$ 180" },
      { name: "Manicure Completa", duration: "1h", price: "R$ 60" },
      { name: "Spa dos Pés", duration: "45min", price: "R$ 75" },
    ],
  },
  {
    type: "estetica",
    label: "Estética",
    icon: Heart,
    title: "Clínica Estética",
    slug: "clinica-estetica",
    weekly: 9,
    services: [
      { name: "Limpeza de Pele", duration: "1h", price: "R$ 120" },
      { name: "Drenagem Linfática", duration: "50min", price: "R$ 150" },
      { name: "Massagem Relaxante", duration: "1h", price: "R$ 160" },
    ],
  },
];

function useAnimatedCount(target: number, duration = 600) {
  const [count, setCount] = useState(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    const start = count;
    const diff = target - start;
    if (diff === 0) return;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + diff * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return count;
}

export function MockupCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const current = examples[activeIndex];
  const animatedWeekly = useAnimatedCount(current.weekly);

  const switchTo = useCallback(
    (index: number) => {
      if (index === activeIndex || isTransitioning) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex(index);
        setIsTransitioning(false);
      }, 160);
    },
    [activeIndex, isTransitioning]
  );

  // Auto-play
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % examples.length);
        setIsTransitioning(false);
      }, 160);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [isPaused, activeIndex]);

  const handleTabClick = (i: number) => {
    clearInterval(timerRef.current);
    switchTo(i);
  };

  return (
    <div
      className="relative max-w-[360px] mx-auto lg:max-w-[350px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Category tabs */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {examples.map((ex, i) => {
          const Icon = ex.icon;
          return (
            <button
              key={ex.type}
              onClick={() => handleTabClick(i)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer
                ${
                  i === activeIndex
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground"
                }
              `}
            >
              <Icon size={13} />
              {ex.label}
            </button>
          );
        })}
      </div>

      {/* Mockup card */}
      <div
        className={`
          bg-card rounded-2xl border border-border/80 shadow-strong
          transition-all duration-[320ms] ease-out
          ${isTransitioning ? "opacity-0 translate-y-1.5 blur-[2px]" : "opacity-100 translate-y-0 blur-0"}
        `}
      >
        {/* Card header */}
        <div className="flex items-center justify-between gap-3 p-5 pb-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Calendar className="text-primary-foreground" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{current.title}</h3>
              <p className="text-[11px] text-muted-foreground truncate">
                agendali.com/{current.slug}
              </p>
            </div>
          </div>

          {/* Badge inside header */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 shrink-0">
            <Users className="text-success" size={12} />
            <div className="flex flex-col items-end leading-none">
              <span className="text-[11px] font-bold text-success">+{animatedWeekly}</span>
              <span className="text-[9px] text-success/70">/ semana</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 mt-4 mb-0 border-t border-border/60" />

        {/* Services */}
        <div className="p-5 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Serviços populares
          </p>
          {current.services.map((service) => (
            <div
              key={service.name}
              className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-200"
            >
              <div className="min-w-0">
                <p className="font-medium text-[13px] leading-tight">{service.name}</p>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock size={11} className="shrink-0" />
                  {service.duration}
                </p>
              </div>
              <span className="font-semibold text-[13px] shrink-0 ml-3">{service.price}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          <Button variant="default" className="w-full rounded-xl h-11 text-sm font-semibold">
            Agendar horário
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {examples.map((_, i) => (
          <button
            key={i}
            onClick={() => handleTabClick(i)}
            className={`
              h-1.5 rounded-full transition-all duration-300 cursor-pointer
              ${i === activeIndex ? "w-5 bg-foreground" : "w-1.5 bg-border hover:bg-muted-foreground/40"}
            `}
          />
        ))}
      </div>
    </div>
  );
}
