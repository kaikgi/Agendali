import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useProfessionalServices(professionalId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['professional-services', professionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_services')
        .select('service_id')
        .eq('professional_id', professionalId);
      if (error) throw error;
      return data.map((ps) => ps.service_id);
    },
    enabled: !!professionalId,
  });

  const updateMutation = useMutation({
    mutationFn: async (serviceIds: string[]) => {
      if (!professionalId) throw new Error('ID do profissional não informado');

      // Remove existing links
      const { error: deleteError } = await supabase
        .from('professional_services')
        .delete()
        .eq('professional_id', professionalId);
      if (deleteError) throw deleteError;

      // Insert new links
      if (serviceIds.length > 0) {
        const rows = serviceIds.map((service_id) => ({
          professional_id: professionalId,
          service_id,
        }));
        const { data, error } = await supabase
          .from('professional_services')
          .insert(rows)
          .select();
        if (error) throw error;
        // If RLS silently blocked the insert, data will be empty
        if (!data || data.length !== serviceIds.length) {
          throw new Error('Falha ao salvar vínculos. Verifique suas permissões.');
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professional-services', professionalId] });
    },
  });

  return {
    serviceIds: query.data ?? [],
    isLoading: query.isLoading,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
