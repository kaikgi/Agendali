import { useState } from "react";
import { Check, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PLANS, type BillingPeriod, type HardcodedPlan, formatCentsBRL } from "@/lib/hardcodedPlans";

const PERIODS: { key: BillingPeriod; label: string; badge?: string }[] = [
  { key: "monthly", label: "Mensal" },
  { key: "quarterly", label: "Trimestral", badge: "–10%" },
  { key: "yearly", label: "Anual", badge: "–25%" },
];

interface PlanCardsGridProps {
  currentPlanCode?: string;
  defaultPeriod?: BillingPeriod;
  ctaLabel?: string;
  compact?: boolean;
  className?: string;
}

/* ─── Price block ─── */
function PriceDisplay({ plan, period, compact }: { plan: HardcodedPlan; period: BillingPeriod; compact?: boolean }) {
  const cents = plan.prices[period];
  const formatted = formatCentsBRL(cents);
  const monthlyCents = plan.prices.monthly;
  const fullYearlyTotal = monthlyCents * 12;
  const fullQuarterlyTotal = monthlyCents * 3;
  const annualSaving = fullYearlyTotal - plan.prices.yearly;
  const quarterlyDiscount = Math.round((1 - plan.prices.quarterly / fullQuarterlyTotal) * 100);

  const muted = plan.popular ? "text-primary-foreground/60" : "text-muted-foreground";
  const savingBadge = cn(
    "inline-flex items-center gap-1 text-xs font-semibold mt-2 px-2.5 py-1 rounded-full",
    plan.popular
      ? "bg-primary-foreground/15 text-primary-foreground"
      : "bg-accent text-accent-foreground"
  );

  const periodLabels: Record<BillingPeriod, string> = {
    monthly: "/mês",
    quarterly: "/trimestre",
    yearly: "/ano",
  };

  return (
    <div className={cn("text-center", compact ? "py-3" : "py-5")}>
      {/* Strike-through original price for non-monthly */}
      {period !== "monthly" && (
        <p className={cn("text-sm line-through opacity-50 mb-1", muted)}>
          R$ {formatCentsBRL(period === "yearly" ? fullYearlyTotal : fullQuarterlyTotal)}
        </p>
      )}

      <div className="flex items-baseline justify-center gap-1">
        <span className={cn("text-sm font-medium", muted)}>R$</span>
        <span className={cn("font-extrabold tracking-tight tabular-nums", compact ? "text-3xl" : "text-4xl")}>
          {formatted}
        </span>
        <span className={cn("text-sm", muted)}>{periodLabels[period]}</span>
      </div>

      {/* Saving badge */}
      {period === "quarterly" && (
        <p className={savingBadge}>
          <Sparkles size={12} />
          Economize {quarterlyDiscount}%
        </p>
      )}
      {period === "yearly" && (
        <p className={savingBadge}>
          <Sparkles size={12} />
          Economize R$ {formatCentsBRL(annualSaving)}/ano
        </p>
      )}
    </div>
  );
}

/* ─── Main grid ─── */
export function PlanCardsGrid({
  currentPlanCode,
  defaultPeriod = "monthly",
  ctaLabel = "Escolher plano",
  compact = false,
  className,
}: PlanCardsGridProps) {
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* ── Period Toggle ── */}
      <div className="inline-flex items-center rounded-full border border-border bg-muted/50 p-1 mb-8 flex-wrap justify-center">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(
              "relative px-3 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-medium transition-all duration-200",
              period === p.key
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
            {p.badge && period !== p.key && (
              <span className="ml-1 sm:ml-1.5 text-[10px] font-bold text-primary">{p.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Cards Grid ── */}
      <div className={cn(
        "grid w-full gap-6 items-stretch",
        "grid-cols-1 md:grid-cols-3",
        compact ? "max-w-3xl" : "max-w-5xl"
      )}>
        {PLANS.map((plan) => {
          const isCurrent = currentPlanCode === plan.code;

          return (
            <div
              key={plan.code}
              className={cn(
                "relative rounded-2xl border flex flex-col text-center transition-all duration-200",
                compact ? "px-5 py-6" : "px-6 py-8",
                plan.popular
                  ? "bg-primary text-primary-foreground border-primary shadow-strong scale-[1.02] md:scale-105"
                  : isCurrent
                    ? "bg-card border-primary/50 shadow-sm"
                    : "bg-card border-border hover:border-foreground/20 hover:shadow-elegant"
              )}
            >
              {/* Badge */}
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-background text-foreground text-xs font-bold shadow-sm whitespace-nowrap z-10">
                  ⭐ Mais popular
                </div>
              )}
              {isCurrent && !plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm whitespace-nowrap z-10">
                  Plano atual
                </div>
              )}

              {/* Plan name & description */}
              <div className="mb-1">
                <h3 className={cn("font-bold", compact ? "text-xl" : "text-2xl")}>{plan.name}</h3>
                <p className={cn(
                  "text-sm mt-1",
                  plan.popular ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {plan.description}
                </p>
              </div>

              {/* Price */}
              <PriceDisplay plan={plan} period={period} compact={compact} />

              {/* Divider */}
              <div className={cn(
                "w-12 h-px mx-auto mb-5",
                plan.popular ? "bg-primary-foreground/20" : "bg-border"
              )} />

              {/* Features */}
              <ul className={cn("flex-1 space-y-3 text-left mx-auto", compact ? "max-w-[220px]" : "max-w-[240px]")}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check
                      size={compact ? 14 : 16}
                      strokeWidth={2.5}
                      className={cn(
                        "mt-0.5 shrink-0",
                        plan.popular ? "text-primary-foreground" : "text-primary"
                      )}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className={cn("mt-auto", compact ? "pt-5" : "pt-7")}>
                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">
                    Plano atual
                  </Button>
                ) : (
                  <Button
                    variant={plan.popular ? "outline" : "default"}
                    size="lg"
                    className={cn(
                      "w-full font-semibold",
                      compact ? "h-10" : "h-12",
                      plan.popular && "bg-background text-foreground hover:bg-background/90 border-background"
                    )}
                    asChild
                  >
                    <a href={plan.checkoutUrls[period]} target="_blank" rel="noopener noreferrer">
                      {plan.code === 'solo' ? 'Começar com Solo' : plan.code === 'studio' ? 'Escolher Studio' : plan.code === 'pro' ? 'Escolher Pro' : ctaLabel}
                      <ExternalLink size={14} className="ml-1.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
