import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserEstablishment() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-establishment', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // First try: user is owner - get most recent establishment
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

      // Second try: user is member (manager/staff) - get most recent membership
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
        .single();

      if (estError) throw estError;
      return memberEstablishment;
    },
    enabled: !!user,
    staleTime: 30000, // 30s cache
    refetchInterval: 30000, // poll every 30s
    refetchOnWindowFocus: true,
  });
}
