import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useServiceProfessionals(serviceId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['service-professionals', serviceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_services')
        .select('professional_id')
        .eq('service_id', serviceId);
      if (error) throw error;
      return data.map((ps) => ps.professional_id);
    },
    enabled: !!serviceId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ serviceId, professionalIds }: { serviceId: string; professionalIds: string[] }) => {
      const { error: deleteError } = await supabase
        .from('professional_services')
        .delete()
        .eq('service_id', serviceId);
      if (deleteError) throw deleteError;

      if (professionalIds.length > 0) {
        const rows = professionalIds.map((professional_id) => ({
          professional_id,
          service_id: serviceId,
        }));
        const { data, error } = await supabase
          .from('professional_services')
          .insert(rows)
          .select();
        if (error) throw error;
        if (!data || data.length !== professionalIds.length) {
          throw new Error('Falha ao salvar vínculos. Verifique suas permissões.');
        }
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['service-professionals', variables.serviceId] });
      queryClient.invalidateQueries({ queryKey: ['professional-services'] });
    },
  });

  return {
    professionalIds: query.data ?? [],
    isLoading: query.isLoading,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
