import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UpdateProfileResult {
  success: boolean;
  professional?: {
    id: string;
    name: string;
    photo_url: string | null;
    slug: string;
  };
  message?: string;
  error?: string;
}

export function useProfessionalProfileUpdate(token: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      name,
      photoUrl,
    }: {
      name?: string;
      photoUrl?: string;
    }): Promise<UpdateProfileResult> => {
      if (!token) throw new Error('Sessão inválida');

      const { data, error } = await supabase.rpc('professional_update_profile', {
        p_token: token,
        p_name: name ?? null,
        p_photo_url: photoUrl ?? null,
      });

      if (error) throw error;

      const result = data as unknown as UpdateProfileResult;
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar perfil');
      }

      return result;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['professional-portal-session'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      queryClient.invalidateQueries({ queryKey: ['professionals-by-service'] });
      queryClient.invalidateQueries({ queryKey: ['manage-professionals'] });
    },
  });
}
