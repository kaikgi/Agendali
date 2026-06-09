import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ServiceCategory {
  id: string;
  establishment_id: string;
  name: string;
  slug: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function useServiceCategories(establishmentId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const queryKey = ['service-categories', establishmentId];

  const listQuery = useQuery({
    queryKey,
    queryFn: async () => {
      if (!establishmentId) return [];
      console.log('[useServiceCategories] Fetching for:', establishmentId);
      
      const { data, error } = await supabase
        .from('service_categories' as any)
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('sort_order')
        .order('name');
      
      if (error) {
        console.error('[useServiceCategories] Error:', error);
        throw error;
      }
      return (data ?? []) as ServiceCategory[];
    },
    enabled: !!establishmentId,
    retry: 1,
    staleTime: 30000,
  });


  const createMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (!establishmentId) throw new Error('Missing establishment ID');

      const trimmed = name.trim();
      if (!trimmed || trimmed.length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres');
      if (trimmed.length > 80) throw new Error('Nome deve ter no máximo 80 caracteres');

      // Check duplicate
      const existing = listQuery.data?.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existing) throw new Error('Já existe uma categoria com este nome');

      const maxOrder = (listQuery.data ?? []).reduce((m, c) => Math.max(m, c.sort_order), -1);

      const { data, error } = await supabase
        .from('service_categories' as any)
        .insert({
          establishment_id: establishmentId,
          name: trimmed,
          slug: slugify(trimmed),
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma categoria com este nome');
        throw error;
      }
      return data as ServiceCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Categoria criada com sucesso!' });
    },
    onError: (err: Error) => {
      console.error('Erro ao criar categoria:', err);
      toast({ title: 'Erro ao criar categoria', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres');
      if (trimmed.length > 80) throw new Error('Nome deve ter no máximo 80 caracteres');

      // Check duplicate (excluding self)
      const existing = listQuery.data?.find(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== id
      );
      if (existing) throw new Error('Já existe uma categoria com este nome');

      const { error } = await supabase
        .from('service_categories' as any)
        .update({ name: trimmed, slug: slugify(trimmed) })
        .eq('id', id);

      if (error) {
        if (error.code === '23505') throw new Error('Já existe uma categoria com este nome');
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Categoria atualizada!' });
    },
    onError: (err: Error) => {
      console.error('Erro ao atualizar categoria:', err);
      toast({ title: 'Erro ao atualizar', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Move services to "no category" first
      const { error: unlinkError } = await (supabase
        .from('services') as any)
        .update({ category_id: null })
        .eq('category_id', id);
      if (unlinkError) throw unlinkError;

      const { error } = await supabase
        .from('service_categories' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['manage-services', establishmentId] });
      toast({ title: 'Categoria excluída. Serviços movidos para "Sem categoria".' });
    },
    onError: (err: Error) => {
      console.error('Erro ao excluir categoria:', err);
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      const promises = updates.map(({ id, sort_order }) =>
        supabase.from('service_categories' as any).update({ sort_order }).eq('id', id)
      );
      const results = await Promise.all(promises);
      const err = results.find((r) => r.error);
      if (err?.error) throw err.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      console.error('Erro ao reordenar:', err);
      toast({ title: 'Erro ao reordenar', description: err.message, variant: 'destructive' });
    },
  });

  return {
    categories: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    refetch: listQuery.refetch,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    reorder: reorderMutation.mutateAsync,
    isReordering: reorderMutation.isPending,
  };
}
