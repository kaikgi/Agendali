import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TimeBlock {
  id: string;
  establishment_id: string;
  professional_id: string | null;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
}

interface RecurringTimeBlock {
  id: string;
  establishment_id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  reason: string | null;
  active: boolean;
  created_at: string;
}

export function useTimeBlocks(establishmentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['time-blocks', establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_blocks')
        .select('*, professionals(name)')
        .eq('establishment_id', establishmentId)
        .order('start_at', { ascending: false });
      if (error) throw error;
      return data as (TimeBlock & { professionals: { name: string } | null })[];
    },
    enabled: !!establishmentId,
  });

  const createMutation = useMutation({
    mutationFn: async (block: Omit<TimeBlock, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('time_blocks').insert(block);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', establishmentId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<TimeBlock> & { id: string }) => {
      const { error } = await supabase.from('time_blocks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', establishmentId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_blocks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', establishmentId] });
    },
  });

  return {
    blocks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
  };
}

export function useRecurringTimeBlocks(establishmentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['recurring-time-blocks', establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_time_blocks')
        .select('*, professionals(name)')
        .eq('establishment_id', establishmentId)
        .order('weekday');
      if (error) throw error;
      return data as (RecurringTimeBlock & { professionals: { name: string } | null })[];
    },
    enabled: !!establishmentId,
  });

  const createMutation = useMutation({
    mutationFn: async (block: Omit<RecurringTimeBlock, 'id' | 'created_at'>) => {
      const { error } = await supabase.from('recurring_time_blocks').insert(block);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-time-blocks', establishmentId] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RecurringTimeBlock> & { id: string }) => {
      const { error } = await supabase.from('recurring_time_blocks').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-time-blocks', establishmentId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recurring_time_blocks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-time-blocks', establishmentId] });
    },
  });

  return {
    blocks: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    create: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    remove: deleteMutation.mutateAsync,
    isRemoving: deleteMutation.isPending,
  };
}
