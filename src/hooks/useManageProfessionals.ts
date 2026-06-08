import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Professional {
  id: string;
  name: string;
  photo_url: string | null;
  active: boolean;
  capacity: number;
  created_at: string;
  slug: string | null;
  portal_enabled: boolean | null;
  portal_last_login_at: string | null;
  portal_password_hash: string | null;
}

interface CreateProfessionalData {
  establishment_id: string;
  name: string;
  photo_url?: string;
  capacity?: number;
  slug?: string;
}

export function useManageProfessionals(establishmentId: string | undefined) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['manage-professionals', establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professionals')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('name');
      if (error) throw error;
      return data as Professional[];
    },
    enabled: !!establishmentId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateProfessionalData): Promise<Professional> => {
      const { data: newProf, error } = await supabase
        .from('professionals')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return newProf as Professional;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-professionals', establishmentId] });
      queryClient.invalidateQueries({ queryKey: ['plan-limits'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Professional> & { id: string }) => {
      const { error } = await supabase
        .from('professionals')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-professionals', establishmentId] });
      queryClient.invalidateQueries({ queryKey: ['plan-limits'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('professionals')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manage-professionals', establishmentId] });
      queryClient.invalidateQueries({ queryKey: ['plan-limits'] });
    },
  });

  return {
    professionals: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
