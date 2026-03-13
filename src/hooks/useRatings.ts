import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { sendRatingNotificationEmail } from '@/lib/emailNotifications';

interface Rating {
  id: string;
  establishment_id: string;
  appointment_id: string;
  customer_id: string;
  customer_user_id: string | null;
  stars: number;
  comment: string | null;
  created_at: string;
}

interface EstablishmentRating {
  rating_avg: number;
  rating_count: number;
}

// Hook to fetch establishment rating
export function useEstablishmentRating(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['establishment-rating', establishmentId],
    queryFn: async (): Promise<EstablishmentRating> => {
      if (!establishmentId) {
        return { rating_avg: 0, rating_count: 0 };
      }

      const { data, error } = await supabase.rpc('get_establishment_rating', {
        p_establishment_id: establishmentId,
      });

      if (error) throw error;
      
      // RPC returns an array of rows; take the first one
      const rows = data as unknown as { rating_avg: number; rating_count: number }[];
      const result = Array.isArray(rows) ? rows[0] : rows;
      
      return {
        rating_avg: Number(result?.rating_avg) || 0,
        rating_count: Number(result?.rating_count) || 0,
      };
    },
    enabled: !!establishmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook to check if user already rated an appointment
export function useHasRated(appointmentId: string | undefined) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['has-rated', appointmentId, user?.id],
    queryFn: async () => {
      if (!appointmentId || !user?.id) return false;

      const { data, error } = await supabase
        .from('ratings')
        .select('id')
        .eq('appointment_id', appointmentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return !!data;
    },
    enabled: !!appointmentId && !!user?.id,
  });
}

// Hook to submit a rating
export function useSubmitRating() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      establishmentId,
      customerId,
      stars,
      comment,
    }: {
      appointmentId: string;
      establishmentId: string;
      customerId: string;
      stars: number;
      comment?: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('ratings')
        .insert({
          appointment_id: appointmentId,
          establishment_id: establishmentId,
          customer_id: customerId,
          customer_user_id: user.id,
          stars,
          comment: comment || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Você já avaliou este agendamento');
        }
        throw error;
      }

      // Send notification email to establishment owner (fire and forget)
      if (data?.id) {
        sendRatingNotificationEmail(data.id).catch((emailErr) => {
          console.warn('Failed to send rating notification email:', emailErr);
        });
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['establishment-rating', variables.establishmentId] });
      queryClient.invalidateQueries({ queryKey: ['has-rated', variables.appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
    },
  });
}

// Hook to get ratings for an establishment (for display)
export function useEstablishmentRatings(establishmentId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['establishment-ratings', establishmentId, limit],
    queryFn: async (): Promise<Rating[]> => {
      if (!establishmentId) return [];

      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!establishmentId,
    staleTime: 5 * 60 * 1000,
  });
}
