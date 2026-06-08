import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAdminAccess } from './useAdmin';

export function useUserEstablishment() {
  const { user } = useAuth();
  const { data: adminAccess } = useAdminAccess();

  return useQuery({
    queryKey: ['user-establishment', user?.id],
    queryFn: async () => {
      if (!user?.id) {
        console.log('[useUserEstablishment] No user found');
        return null;
      }

      console.log('[useUserEstablishment] Fetching for user:', user.id, user.email);

      // Add a safety timeout for the database call
      const fetchWithTimeout = async () => {
        // First try: user is owner
        const { data: ownedEstablishments, error: ownerError } = await supabase
          .from('establishments')
          .select('*')
          .eq('owner_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (ownerError) throw ownerError;
        
        if (ownedEstablishments && ownedEstablishments.length > 0) {
          return ownedEstablishments[0];
        }

        // Second try: user is member
        const { data: memberships, error: memberError } = await supabase
          .from('establishment_members')
          .select('establishment_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (memberError) throw memberError;
        
        if (!memberships || memberships.length === 0) return null;

        const { data: memberEstablishment, error: estError } = await supabase
          .from('establishments')
          .select('*')
          .eq('id', memberships[0].establishment_id)
          .maybeSingle();

        if (estError) throw estError;
        return memberEstablishment;
      };

      try {
        // Simple promise race for timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ao buscar estabelecimento')), 10000)
        );
        
        return await Promise.race([fetchWithTimeout(), timeoutPromise]) as any;
      } catch (err: any) {
        console.error('[useUserEstablishment] Error:', err);
        throw err;
      }
    },
    enabled: !!user,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
}
