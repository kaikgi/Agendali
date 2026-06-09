import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AccountType = 'customer' | 'establishment_owner';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  account_type: AccountType;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      console.log('[useProfile] Fetching for user:', user.id);
      
      const fetchProfile = async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.error('[useProfile] Supabase error:', error);
          throw error;
        }
        
        if (!data) {
          console.log('[useProfile] Profile not found, auto-creating...');
          const { data: establishments } = await supabase
            .from('establishments')
            .select('id')
            .eq('owner_user_id', user.id)
            .limit(1);
          
          const accountType: AccountType = 
            (establishments && establishments.length > 0) 
              ? 'establishment_owner' 
              : 'customer';

          const newProfile = {
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
            phone: user.user_metadata?.phone || null,
            account_type: accountType,
          };

          const { data: created, error: insertError } = await supabase
            .from('profiles')
            .upsert(newProfile)
            .select()
            .single();

          if (insertError) {
            console.error('[useProfile] Auto-create failed:', insertError);
            throw insertError;
          }
          return created as Profile;
        }
        return data as Profile;
      };

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Tempo limite ao carregar perfil (10s).')), 10000)
      );

      return await Promise.race([fetchProfile(), timeoutPromise]) as Profile;
    },
    enabled: !!user?.id && !authLoading,
    retry: 2,
    staleTime: 60000,
  });


  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });

  return {
    profile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateProfile: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
}
