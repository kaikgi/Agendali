import { useUserEstablishment } from './useUserEstablishment';
import { useSubscription } from './useSubscription';
import { getPlanEntitlements } from '@/lib/planEntitlements';

/**
 * Returns true if the current establishment has access to the commissions module.
 * Access is granted only for Studio and Pro plans.
 */
export function useHasCommissions(): { hasAccess: boolean; isLoading: boolean; planLabel: string } {
  const { data: establishment, isLoading: estLoading } = useUserEstablishment();
  const { data: subscription, isLoading: subLoading } = useSubscription();

  const isLoading = estLoading || subLoading;

  const planCode = subscription?.plan_code || subscription?.plan || establishment?.plano;
  const status = subscription?.status || establishment?.status;

  const entitlements = getPlanEntitlements(status, planCode);

  return {
    hasAccess: entitlements.hasCommissions,
    isLoading,
    planLabel: entitlements.planLabel,
  };
}
