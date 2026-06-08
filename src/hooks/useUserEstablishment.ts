import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserEstablishment() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-establishment', user?.id],
    queryFn: async () => {
      if (!user) {
        console.log('[useUserEstablishment] No user found');
        return null;
      }

      console.log('[useUserEstablishment] Fetching for user:', user.id, user.email);

      // First try: user is owner - get most recent establishment
      const { data: ownedEstablishments, error: ownerError } = await supabase
        .from('establishments')
        .select('*')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (ownerError) {
        console.error('[useUserEstablishment] Owner fetch error:', ownerError);
        throw ownerError;
      }
      
      if (ownedEstablishments && ownedEstablishments.length > 0) {
        console.log('[useUserEstablishment] Found owned establishment:', ownedEstablishments[0].id);
        return ownedEstablishments[0];
      }

      // Second try: user is member (manager/staff) - get most recent membership
      console.log('[useUserEstablishment] No owned, checking memberships');
      const { data: memberships, error: memberError } = await supabase
        .from('establishment_members')
        .select('establishment_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (memberError) {
        console.error('[useUserEstablishment] Membership fetch error:', memberError);
        throw memberError;
      }
      
      if (!memberships || memberships.length === 0) {
        console.log('[useUserEstablishment] No memberships found');
        return null;
      }

      console.log('[useUserEstablishment] Found membership for:', memberships[0].establishment_id);
      const { data: memberEstablishment, error: estError } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', memberships[0].establishment_id)
        .maybeSingle();

      if (estError) {
        console.error('[useUserEstablishment] Establishment detail fetch error:', estError);
        throw estError;
      }
      
      if (!memberEstablishment) {
        console.warn('[useUserEstablishment] Member establishment not found in table:', memberships[0].establishment_id);
      }
      
      return memberEstablishment;
    },
    enabled: !!user,
    staleTime: 30000, // 30s cache
    refetchInterval: 30000, // poll every 30s
    refetchOnWindowFocus: true,
  });
}
