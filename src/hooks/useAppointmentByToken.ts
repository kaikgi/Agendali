import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'no_show' | 'canceled' | 'pending_approval' | 'rejected';

interface AppointmentWithDetails {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  customer_notes: string | null;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
  professional: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number; price_cents: number | null } | null;
  establishment: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    reschedule_min_hours: number;
    cancellation_policy_text: string | null;
  } | null;
}

interface RescheduleResult {
  success: boolean;
  appointment: {
    id: string;
    start_at: string;
    end_at: string;
    status: AppointmentStatus;
    establishment_id: string;
    professional_id: string;
    customer_id: string;
  };
  message: string;
}

/**
 * Invalidate all appointment-related queries after a change
 * This ensures consistency across all views (dashboard, client, etc.)
 */
function invalidateAppointmentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  // Invalidate all appointment-related queries
  queryClient.invalidateQueries({ queryKey: ['appointment-by-token'] });
  queryClient.invalidateQueries({ queryKey: ['appointments'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
  queryClient.invalidateQueries({ queryKey: ['available-slots'] });
}

export function useAppointmentByToken(slug: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: ['appointment-by-token', slug, token],
    queryFn: async () => {
      if (!slug || !token) throw new Error('Slug e token são obrigatórios');

      // Server-side token validation (SECURITY DEFINER RPC) — the table itself has
      // no public SELECT policy, so this is the only way to read an appointment by token.
      const { data, error } = await (supabase.rpc as any)('public_get_appointment_by_token', {
        p_slug: slug,
        p_token: token,
      });

      if (error) {
        const message = error.message?.replace(/^.*EXCEPTION:\s*/, '').trim();
        throw new Error(message || 'Agendamento não encontrado');
      }

      return data as unknown as AppointmentWithDetails;
    },
    enabled: !!slug && !!token,
    retry: false,
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, token }: { appointmentId: string; token: string }) => {
      // Use secure RPC that validates token and cancels server-side
      const { data, error } = await (supabase.rpc as any)('public_cancel_appointment_by_token', {
        p_token: token,
        p_appointment_id: appointmentId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao cancelar agendamento');
      }
    },
    onSuccess: () => {
      invalidateAppointmentQueries(queryClient);
    },
  });
}

export function useRescheduleAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      appointmentId, 
      token, 
      newStartAt, 
      newEndAt 
    }: { 
      appointmentId: string; 
      token: string; 
      newStartAt: string; 
      newEndAt: string;
    }): Promise<RescheduleResult> => {
      // Call the new transactional RPC for rescheduling
      const { data, error } = await (supabase.rpc as any)('public_reschedule_appointment', {
        p_token: token,
        p_appointment_id: appointmentId,
        p_new_start_at: newStartAt,
        p_new_end_at: newEndAt,
      });

      if (error) {
        // Extract error message from Postgres exception
        const errorMessage = error.message.replace(/^.*EXCEPTION:\s*/, '').trim();
        throw new Error(errorMessage || 'Erro ao reagendar');
      }

      return data as unknown as RescheduleResult;
    },
    onSuccess: () => {
      // Invalidate all relevant queries for consistency across all views
      invalidateAppointmentQueries(queryClient);
    },
  });
}
