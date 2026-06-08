import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, X, ExternalLink, Sparkles } from 'lucide-react';
import { formatPriceBRL } from '@/hooks/usePlans';
import { getKiwifyCheckoutUrl } from '@/lib/kiwifyCheckout';

interface PlanFeature {
  name: string;
  included: boolean;
  detail?: string;
}

interface PlanComparisonCardProps {
  planCode: string;
  planName: string;
  priceCents: number;
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  features: PlanFeature[];
  userId?: string;
  userEmail?: string;
  className?: string;
}

export function PlanComparisonCard({
  planCode,
  planName,
  priceCents,
  isPopular,
  isCurrentPlan,
  features,
  userId,
  userEmail,
  className,
}: PlanComparisonCardProps) {
  const checkoutUrl = getKiwifyCheckoutUrl(planCode, userId, userEmail);

  return (
    <div
      className={cn(
        'relative flex flex-col p-6 bg-card border rounded-xl transition-all duration-300',
        isPopular && 'border-primary shadow-lg shadow-primary/10 scale-[1.02]',
        isCurrentPlan && 'border-primary/50 bg-primary/5',
        !isPopular && !isCurrentPlan && 'hover:border-primary/30 hover:shadow-md',
        className
      )}
    >
      {/* Popular Badge */}
      {isPopular && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground shadow-lg">
            <Sparkles className="mr-1 h-3 w-3" />
            Mais popular
          </Badge>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge variant="secondary" className="shadow-lg">
            Seu plano atual
          </Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-6 pt-2">
        <h3 className="text-xl font-bold">{planName}</h3>
        <div className="mt-3">
          <span className="text-4xl font-bold">R$ {formatPriceBRL(priceCents)}</span>
          <span className="text-muted-foreground">/mês</span>
        </div>
      </div>

      {/* Features List */}
      <ul className="flex-1 space-y-3 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-3">
            {feature.included ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            ) : (
              <X className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
            )}
            <div>
              <span
                className={cn(
                  'text-sm',
                  !feature.included && 'text-muted-foreground/60'
                )}
              >
                {feature.name}
              </span>
              {feature.detail && (
                <span className="block text-xs text-muted-foreground">
                  {feature.detail}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      {isCurrentPlan ? (
        <Button variant="outline" disabled className="w-full">
          Plano atual
        </Button>
      ) : (
        <Button
          variant={isPopular ? 'default' : 'outline'}
          className={cn('w-full', isPopular && 'shadow-lg')}
          asChild
        >
          <a href={checkoutUrl} target="_blank" rel="noopener noreferrer">
            Assinar {planName}
            <ExternalLink className="ml-2 h-3 w-3" />
          </a>
        </Button>
      )}
    </div>
  );
}
