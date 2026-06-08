import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionUsageResponse {
  plan: {
    code: string;
    name: string;
    price_cents: number;
    max_professionals: number;
    max_appointments_month: number | null;
    allow_multi_establishments: boolean;
  };
  usage: {
    professionals: number;
    appointments_this_month: number;
  };
  subscription: {
    status: string;
    current_period_end?: string;
  };
}

export interface SubscriptionUsage {
  plan_code: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
  max_professionals: number;
  max_appointments_month: number | null;
  allow_multi_establishments: boolean;
  current_professionals: number;
  current_appointments_month: number;
  can_add_professional: boolean;
  can_add_appointment: boolean;
  professionals_remaining: number | null;
  appointments_remaining: number | null;
}

export function useSubscriptionUsage(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['subscription-usage', establishmentId],
    queryFn: async (): Promise<SubscriptionUsage | null> => {
      if (!establishmentId) return null;

      const { data, error } = await supabase.rpc('get_subscription_usage', {
        p_establishment_id: establishmentId,
      });

      if (error) {
        console.error('Error fetching subscription usage:', error);
        throw error;
      }

      // Parse the response from the new RPC format
      const response = data as unknown as SubscriptionUsageResponse;
      
      const maxProfessionals = response.plan.max_professionals;
      const maxAppointments = response.plan.max_appointments_month;
      const currentProfessionals = response.usage.professionals;
      const currentAppointments = response.usage.appointments_this_month;

      return {
        plan_code: response.plan.code,
        plan_name: response.plan.name,
        status: response.subscription.status,
        current_period_end: response.subscription.current_period_end || null,
        max_professionals: maxProfessionals,
        max_appointments_month: maxAppointments,
        allow_multi_establishments: response.plan.allow_multi_establishments,
        current_professionals: currentProfessionals,
        current_appointments_month: currentAppointments,
        can_add_professional: maxProfessionals === null || currentProfessionals < maxProfessionals,
        can_add_appointment: maxAppointments === null || currentAppointments < maxAppointments,
        professionals_remaining: maxProfessionals !== null ? Math.max(0, maxProfessionals - currentProfessionals) : null,
        appointments_remaining: maxAppointments !== null ? Math.max(0, maxAppointments - currentAppointments) : null,
      };
    },
    enabled: !!establishmentId,
    staleTime: 30000, // 30 seconds
  });
}

// Helper hook to check if a specific action is allowed
export function useCanCreateProfessional(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['can-create-professional', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return { allowed: false, reason: 'No establishment' };

      const { data, error } = await supabase.rpc('can_create_professional', {
        p_establishment_id: establishmentId,
      });

      if (error) {
        console.error('Error checking can_create_professional:', error);
        return { allowed: false, reason: error.message };
      }

      return data as { allowed: boolean; reason: string };
    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });
}

export function useCanCreateAppointment(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['can-create-appointment', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return { allowed: false, reason: 'No establishment' };

      const { data, error } = await supabase.rpc('can_create_appointment', {
        p_establishment_id: establishmentId,
      });

      if (error) {
        console.error('Error checking can_create_appointment:', error);
        return { allowed: false, reason: error.message };
      }

      return data as { allowed: boolean; reason: string };
    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });
}
