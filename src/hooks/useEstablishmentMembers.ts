import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useEstablishmentMembers(establishmentId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['establishment-members', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return [];

      console.log('[useEstablishmentMembers] Fetching for:', establishmentId);
      
      const { data, error } = await supabase
        .from('establishment_members')
        .select(`
          id,
          user_id,
          role,
          created_at,
          profile:profiles(full_name, avatar_url, email)
        `)
        .eq('establishment_id', establishmentId);

      if (error) {
        console.error('[useEstablishmentMembers] Error:', error);
        throw error;
      }
      
      return data;
    },
    enabled: !!establishmentId && !!user,
  });
}
