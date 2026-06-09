import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAdminAccess } from './useAdmin';

export function useUserEstablishment() {
  const { user } = useAuth();
  const { data: adminAccess } = useAdminAccess();

  return useQuery({
    queryKey: ['user-establishment', user?.id],
    enabled: !!user?.id && !adminAccess?.isAdmin,
    queryFn: async () => {
      if (!user?.id) {
        console.log('[useUserEstablishment] No user ID, skipping fetch');
        return null;
      }

      console.log('[useUserEstablishment] Fetching for user:', user.id);

      const fetchWithTimeout = async () => {
        // Try to get establishment where user is owner
        console.log('[useUserEstablishment] Attempting to fetch owned establishment...');
        const { data: owned, error: ownerError } = await supabase
          .from('establishments')
          .select('*')
          .eq('owner_user_id', user.id)
          .limit(1);

        if (ownerError) {
          console.error('[useUserEstablishment] Owner fetch error:', ownerError);
          throw ownerError;
        }
        
        if (owned && owned.length > 0) {
          console.log('[useUserEstablishment] Found owned establishment:', owned[0].id);
          return owned[0];
        }

        // Try to get establishment via membership
        console.log('[useUserEstablishment] No owned establishment found, checking memberships...');
        const { data: memberships, error: memberError } = await supabase
          .from('establishment_members')
          .select('establishment_id')
          .eq('user_id', user.id)
          .limit(1);

        if (memberError) {
          console.error('[useUserEstablishment] Membership fetch error:', memberError);
          throw memberError;
        }
        
        if (!memberships || memberships.length === 0) {
          console.log('[useUserEstablishment] No memberships found for user');
          return null;
        }

        console.log('[useUserEstablishment] Found membership in establishment:', memberships[0].establishment_id);
        const { data: memberEst, error: estError } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', memberships[0].establishment_id)
          .maybeSingle();

        if (estError) {
          console.error('[useUserEstablishment] Member establishment fetch error:', estError);
          throw estError;
        }
        
        return memberEst;
      };

      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Tempo de carregamento do estabelecimento excedido (15s). Verifique sua conexão.')), 15000)
        );
        
        return await Promise.race([fetchWithTimeout(), timeoutPromise]);
      } catch (err: any) {
        console.error('[useUserEstablishment] Final error:', err);
        throw err;
      }
    },
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
