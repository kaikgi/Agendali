import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Establishment = Tables<'establishments'>;

export function useEstablishment(slug: string | undefined) {
  return useQuery({
    queryKey: ['establishment', slug],
    queryFn: async () => {
      if (!slug) throw new Error('Slug is required');

      const { data, error } = await (supabase.rpc as any)('public_get_establishment_by_slug', {
        p_slug: slug,
      });

      if (error) throw error;
      const establishment = Array.isArray(data) ? data[0] : data;
      if (!establishment) throw new Error('Estabelecimento não encontrado ou agendamento desativado');
      return establishment as Establishment;
    },
    enabled: !!slug,
  });
}
