import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { PLANS } from '@/lib/hardcodedPlans';

export interface Subscription {
  id: string;
  owner_user_id: string;
  plan_code: string;
  plan: string;
  billing_cycle: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  provider: string | null;
  provider_subscription_id: string | null;
  provider_order_id: string | null;
  buyer_email: string | null;
  cancel_at_period_end: boolean;
}

export function useSubscription() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async (): Promise<Subscription | null> => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('owner_user_id', user.id)
        .in('status', ['active'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        throw error;
      }

      return data as Subscription | null;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
}

// Helper to get plan display info from hardcoded plans
export function getPlanDisplayInfo(planCode: string | undefined) {
  const plan = PLANS.find(p => p.code === (planCode || '').toLowerCase());
  if (plan) {
    return { name: plan.name, code: plan.code };
  }
  switch ((planCode || '').toLowerCase()) {
    case 'pro':
      return { name: 'Pro', code: 'pro' };
    case 'studio':
      return { name: 'Studio', code: 'studio' };
    case 'solo':
    default:
      return { name: 'Solo', code: 'solo' };
  }
}

export function getBillingCycleLabel(cycle: string | undefined): string {
  switch ((cycle || '').toLowerCase()) {
    case 'yearly': return 'Anual';
    case 'quarterly': return 'Trimestral';
    case 'monthly':
    default: return 'Mensal';
  }
}
