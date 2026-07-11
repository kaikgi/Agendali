import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { parseISO, addMinutes, isAfter } from 'date-fns';

// Hook to check if a prompt has already been shown to this user for an appointment
export function useHasBeenPrompted(appointmentId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['completion-prompt', appointmentId, userId],
    queryFn: async () => {
      if (!appointmentId || !userId) return true; // Default to prompted to avoid showing

      const { data, error } = await (supabase as any)
        .from('appointment_completion_prompts')
        .select('id, action_taken')
        .eq('appointment_id', appointmentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error checking completion prompt:', error);
        return true;
      }

      return !!data;
    },
    enabled: !!appointmentId && !!userId,
  });
}

// Hook to mark an appointment as prompted
export function useMarkPrompted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      userId,
      userType,
      actionTaken,
    }: {
      appointmentId: string;
      userId: string;
      userType: 'customer' | 'establishment' | 'professional';
      actionTaken: 'dismissed' | 'completed' | 'not_yet';
    }) => {
      const { error } = await (supabase as any)
        .from('appointment_completion_prompts')
        .upsert(
          {
            appointment_id: appointmentId,
            user_id: userId,
            user_type: userType,
            action_taken: actionTaken,
          },
          {
            onConflict: 'appointment_id,user_id',
          }
        );

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['completion-prompt', variables.appointmentId, variables.userId] 
      });
    },
  });
}

// Hook to mark an appointment as completed
export function useCompleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appointmentId,
      completedBy,
    }: {
      appointmentId: string;
      completedBy: 'customer' | 'establishment' | 'professional';
    }) => {
      const { error } = await supabase
        .from('appointments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: completedBy,
        })
        .eq('id', appointmentId)
        .in('status', ['booked', 'confirmed']); // Only update if still active

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate all appointment queries
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments-month'] });
      queryClient.invalidateQueries({ queryKey: ['professional-portal-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
  });
}

interface CompletedAppointmentNeedingRating {
  id: string;
  end_at: string;
  service: { name: string } | null;
  professional: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
  establishment: { id: string; name: string } | null;
}

// Finds the customer's most recent completed appointment that hasn't been rated yet.
// Needed because completion can now happen without the customer ever seeing the
// "did it finish?" dialog (e.g. the auto-complete cron job) - so the rating prompt
// can't only be triggered from inside that flow anymore.
export function useRecentlyCompletedAppointmentNeedingRating(userId: string | undefined) {
  return useQuery({
    queryKey: ['completed-needing-rating', userId],
    queryFn: async (): Promise<CompletedAppointmentNeedingRating | null> => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          end_at,
          service:services(name),
          professional:professionals(id, name),
          customer:customers(id, name),
          establishment:establishments(id, name)
        `)
        .eq('customer_user_id', userId)
        .eq('status', 'completed')
        .order('end_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const ids = data.map((a) => a.id);
      const [{ data: existingRatings }, { data: existingPrompts }] = await Promise.all([
        supabase.from('ratings').select('appointment_id').in('appointment_id', ids),
        (supabase as any)
          .from('appointment_completion_prompts')
          .select('appointment_id')
          .eq('user_id', userId)
          .in('appointment_id', ids),
      ]);

      const ratedIds = new Set((existingRatings || []).map((r) => r.appointment_id));
      const promptedIds = new Set((existingPrompts || []).map((p: { appointment_id: string }) => p.appointment_id));
      return (data.find((a) => !ratedIds.has(a.id) && !promptedIds.has(a.id)) as CompletedAppointmentNeedingRating) || null;
    },
    enabled: !!userId,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

interface PendingCompletionAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  service: {
    name: string;
    duration_minutes: number;
  } | null;
  professional: {
    id: string;
    name: string;
  } | null;
  customer: {
    id: string;
    name: string;
  } | null;
  establishment: {
    id: string;
    name: string;
  } | null;
}

// Hook to get appointments pending completion prompt (1 min after end time)
export function usePendingCompletionAppointments(
  establishmentId: string | undefined,
  userId: string | undefined,
  userType: 'customer' | 'establishment' | 'professional'
) {
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;

  return useQuery({
    queryKey: ['pending-completion', establishmentId, effectiveUserId, userType],
    queryFn: async (): Promise<PendingCompletionAppointment[]> => {
      if (!effectiveUserId) return [];

      const now = new Date();
      let query;

      if (userType === 'customer') {
        // For customers, get their appointments
        query = supabase
          .from('appointments')
          .select(`
            id,
            start_at,
            end_at,
            status,
            service:services(name, duration_minutes),
            professional:professionals(id, name),
            customer:customers(id, name),
            establishment:establishments(id, name)
          `)
          .eq('customer_user_id', effectiveUserId)
          .in('status', ['booked', 'confirmed'])
          .lte('end_at', now.toISOString()) // Appointment has ended
          .order('end_at', { ascending: false })
          .limit(5);
      } else {
        // For establishment/professional, get establishment appointments
        if (!establishmentId) return [];
        
        query = supabase
          .from('appointments')
          .select(`
            id,
            start_at,
            end_at,
            status,
            service:services(name, duration_minutes),
            professional:professionals(id, name),
            customer:customers(id, name),
            establishment:establishments(id, name)
          `)
          .eq('establishment_id', establishmentId)
          .in('status', ['booked', 'confirmed'])
          .lte('end_at', now.toISOString())
          .order('end_at', { ascending: false })
          .limit(10);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter for appointments that ended at least 1 minute ago
      const oneMinuteAgo = addMinutes(now, -1);
      
      return (data || []).filter((apt) => {
        const endAt = parseISO(apt.end_at);
        return isAfter(oneMinuteAgo, endAt);
      }) as PendingCompletionAppointment[];
    },
    enabled: !!effectiveUserId,
    refetchInterval: 60000, // Refetch every minute to catch new completions
    staleTime: 30000,
  });
}
