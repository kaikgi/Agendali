import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'no_show' | 'canceled' | 'pending_approval' | 'rejected' | 'paid_pending_confirmation' | 'pending_payment';

interface AppointmentWithRelations {
  id: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  customer: { id: string; name: string; phone: string; email: string | null } | null;
  professional: { id: string; name: string } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
}

export function useAppointments(establishmentId: string | undefined, filters?: {
  status?: AppointmentStatus;
  professionalId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['appointments', establishmentId, filters],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          id,
          start_at,
          end_at,
          status,
          customer_notes,
          internal_notes,
          created_at,
          customer:customers(id, name, phone, email),
          professional:professionals(id, name),
          service:services(id, name, duration_minutes)
        `)
        .eq('establishment_id', establishmentId)
        .order('start_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.professionalId) {
        query = query.eq('professional_id', filters.professionalId);
      }
      if (filters?.startDate) {
        query = query.gte('start_at', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('start_at', filters.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as AppointmentWithRelations[];
    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!establishmentId) return;

    const channel = supabase
      .channel('appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `establishment_id=eq.${establishmentId}`,
        },
        (payload) => {
          console.log('Appointment change detected:', payload);
          
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['appointments', establishmentId] });
          queryClient.invalidateQueries({ queryKey: ['metrics'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [establishmentId, queryClient]);

  return query;
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: AppointmentStatus; oldStatus?: string }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status,
          ...(status === 'completed' ? { completed_at: new Date().toISOString(), completed_by: 'owner' } : {}),
        })
        .eq('id', id);
      if (error) throw error;
      
      // Email notification is handled automatically by DB trigger trg_appointment_status_email
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments-month'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}

export function useUpdateAppointmentNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, internal_notes }: { id: string; internal_notes: string | null }) => {
      const { error } = await supabase
        .from('appointments')
        .update({ internal_notes })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
