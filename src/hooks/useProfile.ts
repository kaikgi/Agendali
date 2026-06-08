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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        // Profile might not exist yet for new users - auto-create it
        if (error.code === 'PGRST116') {
          const defaultAccountType: AccountType = 'customer';
          
          // Check if user owns an establishment to determine account type
          const { data: establishments } = await supabase
            .from('establishments')
            .select('id')
            .eq('owner_user_id', user.id)
            .limit(1);
          
          const accountType: AccountType = 
            (establishments && establishments.length > 0) 
              ? 'establishment_owner' 
              : defaultAccountType;

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
            console.error('Auto-create profile failed:', insertError);
            return null;
          }
          
          return created as Profile;
        }
        throw error;
      }
      
      return data as Profile;
    },
    enabled: !!user?.id,
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
