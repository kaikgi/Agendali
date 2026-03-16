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
  professional_id: string | null;
  stars: number;
  professional_stars: number | null;
  comment: string | null;
  created_at: string;
}

interface EstablishmentRating {
  rating_avg: number;
  rating_count: number;
}

interface ProfessionalRating {
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
      
      const rows = data as unknown as { rating_avg: number; rating_count: number }[];
      const result = Array.isArray(rows) ? rows[0] : rows;
      
      return {
        rating_avg: Number(result?.rating_avg) || 0,
        rating_count: Number(result?.rating_count) || 0,
      };
    },
    enabled: !!establishmentId,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook to fetch professional rating
export function useProfessionalRating(professionalId: string | undefined) {
  return useQuery({
    queryKey: ['professional-rating', professionalId],
    queryFn: async (): Promise<ProfessionalRating> => {
      if (!professionalId) {
        return { rating_avg: 0, rating_count: 0 };
      }

      const { data, error } = await (supabase.rpc as any)('get_professional_rating', {
        p_professional_id: professionalId,
      });

      if (error) throw error;
      
      const rows = data as unknown as { rating_avg: number; rating_count: number }[];
      const result = Array.isArray(rows) ? rows[0] : rows;
      
      return {
        rating_avg: Number(result?.rating_avg) || 0,
        rating_count: Number(result?.rating_count) || 0,
      };
    },
    enabled: !!professionalId,
    staleTime: 5 * 60 * 1000,
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

// Hook to check rating by appointment ID (no auth required)
export function useAppointmentRated(appointmentId: string | undefined) {
  return useQuery({
    queryKey: ['appointment-rated', appointmentId],
    queryFn: async () => {
      if (!appointmentId) return false;

      const { data, error } = await supabase
        .from('ratings')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!appointmentId,
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
      professionalId,
      professionalStars,
    }: {
      appointmentId: string;
      establishmentId: string;
      customerId: string;
      stars: number;
      comment?: string;
      professionalId?: string;
      professionalStars?: number;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      console.log('[rating-submit] Inserting rating:', {
        appointmentId, establishmentId, customerId, stars,
        professionalId, professionalStars,
      });

      const insertData: Record<string, unknown> = {
        appointment_id: appointmentId,
        establishment_id: establishmentId,
        customer_id: customerId,
        customer_user_id: user.id,
        stars,
        comment: comment || null,
      };

      if (professionalId) {
        insertData.professional_id = professionalId;
      }
      if (professionalStars != null) {
        insertData.professional_stars = professionalStars;
      }

      const { data, error } = await (supabase
        .from('ratings') as any)
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[rating-submit] Error:', error);
        if (error.code === '23505') {
          throw new Error('Você já avaliou este agendamento');
        }
        throw error;
      }

      console.log('[rating-submit] Success:', data?.id);

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
      if (variables.professionalId) {
        queryClient.invalidateQueries({ queryKey: ['professional-rating', variables.professionalId] });
      }
      queryClient.invalidateQueries({ queryKey: ['has-rated', variables.appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointment-rated', variables.appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['establishment-ratings-detailed'] });
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
      return (data || []) as unknown as Rating[];
    },
    enabled: !!establishmentId,
    staleTime: 5 * 60 * 1000,
  });
}
