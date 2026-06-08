import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Service = Tables<'services'> & {
  category?: string | null;
  sort_order?: number;
};

export function useServices(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['services', establishmentId],
    queryFn: async () => {
      if (!establishmentId) throw new Error('Establishment ID is required');
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('sort_order')
        .order('name');

      if (error) throw error;
      return data as Service[];
    },
    enabled: !!establishmentId,
  });
}