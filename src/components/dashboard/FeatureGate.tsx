import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { FeatureFlag } from '@/lib/planEntitlements';
import { Button } from '@/components/ui/button';
import { Lock, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

interface FeatureGateProps {
  feature: FeatureFlag;
  children: React.ReactNode;
}

/**
 * Wraps children and shows an upgrade wall if the current plan doesn't have access.
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { hasAccess, isLoading, planLabel, featureTitle, featureDescription, minPlan } = useFeatureAccess(feature);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return <FeatureLockedState
      planLabel={planLabel}
      featureTitle={featureTitle}
      featureDescription={featureDescription}
      minPlan={minPlan}
      onUpgrade={() => navigate('/dashboard/assinatura')}
    />;
  }

  return <>{children}</>;
}

function FeatureLockedState({
  planLabel,
  featureTitle,
  featureDescription,
  minPlan,
  onUpgrade,
}: {
  planLabel: string;
  featureTitle: string;
  featureDescription: string;
  minPlan: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      <div className="rounded-full bg-amber-100 p-6">
        <Lock className="h-12 w-12 text-amber-600" />
      </div>
      <div className="text-center max-w-md space-y-3">
        <h2 className="text-2xl font-bold">{featureTitle}</h2>
        <p className="text-muted-foreground">
          {featureDescription}
        </p>
        <p className="text-sm text-muted-foreground">
          Disponível a partir do plano <strong>{minPlan}</strong>. Seu plano atual é <strong>{planLabel}</strong>.
        </p>
      </div>
      <Button onClick={onUpgrade} size="lg" className="gap-2">
        <Zap className="h-4 w-4" />
        Ver planos e fazer upgrade
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
