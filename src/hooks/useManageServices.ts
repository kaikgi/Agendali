import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price_cents: number | null;
  active: boolean;
  created_at: string;
  category: string | null;
  category_id: string | null;
  sort_order: number;
}

interface CreateServiceData {
  establishment_id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price_cents?: number;
  category?: string;
  category_id?: string | null;
  sort_order?: number;
}

export function useManageServices(establishmentId: string | undefined) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['manage-services', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return [];
      console.log('[useManageServices] Fetching for:', establishmentId);
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('sort_order')
        .order('name');
      
      if (error) {
        console.error('[useManageServices] Error:', error);
        throw error;
      }
      return data as Service[];
    },
    enabled: !!establishmentId,
    retry: 1,
    staleTime: 30000,
  });


  const createMutation = useMutation({
    mutationFn: async (data: CreateServiceData) => {
      const { data: newService, error } = await supabase.from('services').insert(data).select().single();
      if (error) throw error;
      return newService as Service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-services', establishmentId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Service> & { id: string }) => {
      const { error } = await supabase
        .from('services')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-services', establishmentId] });
    },
  });

  const bulkUpdateOrderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number; category?: string | null }[]) => {
      // Update each service's sort_order (and optionally category)
      const promises = updates.map(({ id, sort_order, category }) => {
        const updateData: Record<string, unknown> = { sort_order };
        if (category !== undefined) updateData.category = category;
        return supabase.from('services').update(updateData).eq('id', id);
      });
      const results = await Promise.all(promises);
      const firstError = results.find(r => r.error);
      if (firstError?.error) throw firstError.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-services', establishmentId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-services', establishmentId] });
    },
  });

  return {
    services: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    bulkUpdateOrder: bulkUpdateOrderMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSavingOrder: bulkUpdateOrderMutation.isPending,
  };
}