import { useUserEstablishment } from './useUserEstablishment';
import { useSubscription } from './useSubscription';
import { getPlanEntitlements, type FeatureFlag, FEATURE_LABELS } from '@/lib/planEntitlements';

/**
 * Central hook to check if the current establishment has access to a specific feature.
 */
export function useFeatureAccess(feature: FeatureFlag) {
  const { data: establishment, isLoading: estLoading } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  const isLoading = estLoading || subLoading;

  const planCode = subscription?.plan_code || subscription?.plan || establishment?.plano;
  const status = subscription?.status || establishment?.status;

  const entitlements = getPlanEntitlements(status, planCode);
  const hasAccess = entitlements.features[feature];
  const meta = FEATURE_LABELS[feature];

  return {
    hasAccess,
    isLoading,
    planLabel: entitlements.planLabel,
    featureTitle: meta.title,
    featureDescription: meta.description,
    minPlan: meta.minPlan,
  };
}

/**
 * Returns the full features map for the current plan.
 */
export function usePlanFeatures() {
  const { data: establishment, isLoading: estLoading } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  const isLoading = estLoading || subLoading;
  const planCode = subscription?.plan_code || subscription?.plan || establishment?.plano;
  const status = subscription?.status || establishment?.status;
  const entitlements = getPlanEntitlements(status, planCode);

  return { features: entitlements.features, planLabel: entitlements.planLabel, isLoading };
}
