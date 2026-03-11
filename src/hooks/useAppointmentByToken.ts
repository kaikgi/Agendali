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

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

      const tokenHash = await hashToken(token);

      // Fetch token record
      const { data: tokenRecord, error: tokenError } = await (supabase as any)
        .from('appointment_manage_tokens')
        .select('appointment_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .single();

      if (tokenError || !tokenRecord) {
        throw new Error('Token inválido ou não encontrado');
      }

      // Check if token is expired
      if (new Date(tokenRecord.expires_at) < new Date()) {
        throw new Error('Este link expirou');
      }

      // Fetch appointment with details
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .select(`
          id,
          start_at,
          end_at,
          status,
          customer_notes,
          customer:customers(id, name, phone, email),
          professional:professionals(id, name),
          service:services(id, name, duration_minutes, price_cents),
          establishment:establishments(id, name, slug, phone, address, reschedule_min_hours, cancellation_policy_text)
        `)
        .eq('id', tokenRecord.appointment_id)
        .single();

      if (appointmentError || !appointment) {
        throw new Error('Agendamento não encontrado');
      }

      // Verify establishment slug matches
      const est = appointment.establishment as any;
      if (est?.slug !== slug) {
        throw new Error('Agendamento não pertence a este estabelecimento');
      }

      return appointment as unknown as AppointmentWithDetails;
    },
    enabled: !!slug && !!token,
    retry: false,
  });
}

export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ appointmentId, token }: { appointmentId: string; token: string }) => {
      const tokenHash = await hashToken(token);

      // Verify token is valid
      const { data: tokenRecord, error: tokenError } = await (supabase as any)
        .from('appointment_manage_tokens')
        .select('appointment_id, expires_at')
        .eq('token_hash', tokenHash)
        .eq('appointment_id', appointmentId)
        .single();

      if (tokenError || !tokenRecord) {
        throw new Error('Token inválido');
      }

      if (new Date(tokenRecord.expires_at) < new Date()) {
        throw new Error('Este link expirou');
      }

      // Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ status: 'canceled' } as any)
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      // Mark token as used
      await (supabase as any)
        .from('appointment_manage_tokens')
        .update({ used_at: new Date().toISOString() })
        .eq('token_hash', tokenHash);
    },
    onSuccess: () => {
      // Invalidate all relevant queries for consistency
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
