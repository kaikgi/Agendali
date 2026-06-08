import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Establishment = Tables<'establishments'>;

export function useEstablishment(slug: string | undefined) {
  return useQuery({
    queryKey: ['establishment', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Slug is required');
      
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .eq('slug', slug)
        .eq('booking_enabled', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Estabelecimento não encontrado ou agendamento desativado');
      return data as Establishment;
    },
    enabled: !!slug,
  });
}
