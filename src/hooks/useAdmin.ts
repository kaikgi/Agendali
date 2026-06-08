import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ─── Admin Access Check ───
export function useAdminAccess() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["admin-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return { isAdmin: false };
      try {
        // Use the security-definer RPC which bypasses RLS
        const { data, error } = await supabase.rpc("is_admin", {
          p_user_id: user.id,
        });

        if (error) {
          console.error("is_admin RPC error:", error);
          return { isAdmin: false };
        }

        return { isAdmin: !!data };
      } catch {
        return { isAdmin: false };
      }
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

// ─── Admin Stats ───
export interface AdminStats {
  total_establishments: number;
  total_customers: number;
  active_subscriptions: number;
  by_status: Record<string, number>;
  recent_establishments: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    created_at: string;
    owner_email: string;
  }>;
}

export function useAdminStats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["admin-stats", user?.id],
    queryFn: async (): Promise<AdminStats> => {
      if (!user?.id) throw new Error('Não autenticado');
      
      console.log('[useAdminStats] Fetching...');
      try {
        const { data, error } = await supabase.functions.invoke('admin-data', {
          body: { action: 'stats' },
        });
        if (error) {
          console.error('[useAdminStats] invoke error:', error);
          throw new Error(error.message || 'Erro ao carregar estatísticas');
        }
        if (data?.error) {
          console.error('[useAdminStats] data error:', data.error);
          throw new Error(data.error);
        }
        console.log('[useAdminStats] OK, establishments:', data?.total_establishments);
        return data as AdminStats;
      } catch (err: any) {
        console.error('[useAdminStats] catch error:', err);
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 30000,
    retry: 1,
  });
}

// ─── Admin Establishments List ───
export interface AdminEstablishment {
  id: string;
  name: string;
  slug: string;
  status: string;
  plano: string | null;
  created_at: string;
  booking_enabled: boolean;
  owner_user_id: string;
  owner_email: string;
  subscription: { plan_code: string; status: string; billing_cycle?: string; current_period_start?: string; current_period_end?: string; provider?: string; provider_ref?: string; buyer_email?: string; cancel_at_period_end?: boolean } | null;
  professionals_count: number;
  services_count: number;
  customers_count: number;
  appointments_count: number;
}

export function useAdminEstablishments(search?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["admin-establishments", search, user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('Não autenticado');
      
      console.log('[useAdminEstablishments] Fetching, search:', search || '(none)');
      try {
        const { data, error } = await supabase.functions.invoke('admin-data', {
          body: { action: 'list_establishments', search: search || '' },
        });
        if (error) {
          console.error('[useAdminEstablishments] invoke error:', error);
          throw new Error(error.message || 'Erro ao listar estabelecimentos');
        }
        if (data?.error) {
          console.error('[useAdminEstablishments] data error:', data.error);
          throw new Error(data.error);
        }
        console.log('[useAdminEstablishments] OK, count:', data?.establishments?.length);
        return data as { establishments: AdminEstablishment[]; total: number };
      } catch (err: any) {
        console.error('[useAdminEstablishments] catch error:', err);
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 15000,
    retry: 1,
  });
}

// ─── Update Establishment (plan, status) ───
export function useUpdateEstablishment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      establishment_id: string;
      status?: string;
      plano?: string;
      billing_cycle?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('admin-data', {
        body: { action: 'update_establishment', ...params },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-establishments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

// ─── Legacy exports for backward compatibility ───
export function useUpdateEstablishmentPlan() {
  const updateEst = useUpdateEstablishment();
  return {
    ...updateEst,
    mutateAsync: async ({ establishmentId, newPlanCode }: { establishmentId: string; newPlanCode: string }) => {
      return updateEst.mutateAsync({ establishment_id: establishmentId, plano: newPlanCode, status: 'active' });
    },
  };
}

export function useToggleEstablishment() {
  const updateEst = useUpdateEstablishment();
  return {
    ...updateEst,
    mutateAsync: async ({ establishmentId, active }: { establishmentId: string; active: boolean }) => {
      return updateEst.mutateAsync({
        establishment_id: establishmentId,
        status: active ? 'active' : 'canceled',
      });
    },
  };
}

export function useAdminContactMessages(status?: string) {
  return useQuery({
    queryKey: ["admin-contact-messages", status],
    queryFn: async () => ({ messages: [], total: 0 }),
    enabled: false,
  });
}

export function useUpdateContactMessageStatus() {
  return useMutation({ mutationFn: async () => {} });
}

export function useAddAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await supabase.functions.invoke("admin-add-user", {
        body: { email },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
