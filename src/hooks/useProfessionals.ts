import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Professional = Tables<'professionals'>;

export function useProfessionalsByService(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['professionals-by-service', serviceId],
    queryFn: async () => {
      if (!serviceId) throw new Error('Service ID is required');
      
      const { data, error } = await supabase
        .from('professional_services')
        .select(`
          professional_id,
          professionals (*)
        `)
        .eq('service_id', serviceId);

      if (error) throw error;
      
      return (data as any[])
        .map((ps: any) => ps.professionals)
        .filter((p: any): p is Professional => p !== null && p.active);
    },
    enabled: !!serviceId,
  });
}
