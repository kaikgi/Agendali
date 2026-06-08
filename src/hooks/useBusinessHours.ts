import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BusinessHour {
  id: string;
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  closed: boolean;
}

const WEEKDAYS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'
];

export function useBusinessHours(establishmentId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['business-hours', establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_hours')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('weekday');
      if (error) throw error;
      return data as BusinessHour[];
    },
    enabled: !!establishmentId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<BusinessHour> & { id: string }) => {
      const { error } = await supabase
        .from('business_hours')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours', establishmentId] });
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (hours: { establishment_id: string; weekday: number; open_time: string | null; close_time: string | null; closed: boolean }[]) => {
      const { error } = await supabase
        .from('business_hours')
        .upsert(hours, { onConflict: 'establishment_id,weekday' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-hours', establishmentId] });
    },
  });

  return {
    hours: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    update: updateMutation.mutateAsync,
    upsert: upsertMutation.mutateAsync,
    isUpdating: updateMutation.isPending || upsertMutation.isPending,
    WEEKDAYS,
  };
}
