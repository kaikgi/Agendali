import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getPlanLimits } from '@/lib/hardcodedPlans';
import { useAuth } from './useAuth';

export interface PlanLimitsData {
  planCode: string;
  maxProfessionals: number | null; // null = unlimited
  currentProfessionals: number;
  canAddProfessional: boolean;
  professionalsRemaining: number | null; // null = unlimited
}

export function usePlanLimits(establishmentId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['plan-limits', establishmentId, user?.id],
    queryFn: async (): Promise<PlanLimitsData | null> => {
      if (!establishmentId || !user?.id) return null;

      // 1. Get establishment status + plano
      const { data: est } = await supabase
        .from('establishments')
        .select('status, owner_user_id, plano')
        .eq('id', establishmentId)
        .single();

      if (!est) return null;

      const plano = (est.plano || '').toLowerCase();

      // 2. Determine plan code from subscription or establishment
      let planCode = 'solo';
      
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_code, status')
        .eq('owner_user_id', est.owner_user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (sub && sub.length > 0) {
        planCode = (sub[0].plan_code || 'solo').toLowerCase();
      } else if (plano && plano !== 'nenhum') {
        planCode = plano;
      }

      // 3. Get limits from hardcoded plans
      const limits = getPlanLimits(planCode);

      // 4. Count current active professionals
      const { count: profCount } = await supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('establishment_id', establishmentId)
        .eq('active', true);

      const currentProfessionals = profCount ?? 0;

      const canAddProfessional = limits.maxProfessionals === null || currentProfessionals < limits.maxProfessionals;

      return {
        planCode,
        maxProfessionals: limits.maxProfessionals,
        currentProfessionals,
        canAddProfessional,
        professionalsRemaining: limits.maxProfessionals !== null
          ? Math.max(0, limits.maxProfessionals - currentProfessionals)
          : null,
      };
    },
    enabled: !!establishmentId && !!user?.id,
    staleTime: 30000,
  });
}

/**
 * Lightweight check for public booking pages (no auth required).
 * Only checks if establishment is blocked (past_due/canceled).
 */
export function usePublicPlanLimits(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['public-plan-limits', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return { canAccept: true };

      const { data: est } = await supabase
        .from('establishments')
        .select('status')
        .eq('id', establishmentId)
        .single();

      if (!est) return { canAccept: false, reason: 'Estabelecimento não encontrado.' };

      if (est.status === 'past_due' || est.status === 'canceled') {
        return { canAccept: false, reason: 'Estabelecimento temporariamente indisponível para novos agendamentos online.' };
      }

      return { canAccept: true };
    },
    enabled: !!establishmentId,
    staleTime: 10000,
  });
}
