import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface ClientAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: 'booked' | 'confirmed' | 'completed' | 'canceled' | 'no_show';
  customer_notes: string | null;
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number | null;
  };
  professional: {
    id: string;
    name: string;
    photo_url: string | null;
  };
  establishment: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    max_future_days: number;
  };
}

interface UseClientAppointmentsFilters {
  status?: 'booked' | 'confirmed' | 'completed' | 'canceled' | 'no_show' | 'all';
  startDate?: Date;
  endDate?: Date;
}

export function useClientAppointments(filters?: UseClientAppointmentsFilters) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['client-appointments', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) return [];

      let queryBuilder = supabase
        .from('appointments')
        .select(`
          id,
          start_at,
          end_at,
          status,
          customer_notes,
          service:services(id, name, duration_minutes, price_cents),
          professional:professionals(id, name, photo_url),
          establishment:establishments(id, name, slug, logo_url, phone, address, city, state, max_future_days)
        `)
        .eq('customer_user_id', user.id)
        .order('start_at', { ascending: false });

      if (filters?.status && filters.status !== 'all') {
        queryBuilder = queryBuilder.eq('status', filters.status);
      }

      if (filters?.startDate) {
        queryBuilder = queryBuilder.gte('start_at', filters.startDate.toISOString());
      }

      if (filters?.endDate) {
        queryBuilder = queryBuilder.lte('start_at', filters.endDate.toISOString());
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as unknown as ClientAppointment[];
    },
    enabled: !!user?.id,
  });

  // Set up realtime subscription for client appointments
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('client-appointments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `customer_user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Client appointment change detected:', payload);
          
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
          queryClient.invalidateQueries({ queryKey: ['client-appointments-month'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return query;
}

export function useClientAppointmentsByMonth(year: number, month: number) {
  const { user } = useAuth();
  
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return useQuery({
    queryKey: ['client-appointments-month', user?.id, year, month],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          start_at,
          end_at,
          status,
          customer_notes,
          service:services(id, name, duration_minutes, price_cents),
          professional:professionals(id, name, photo_url),
          establishment:establishments(id, name, slug, logo_url, phone, address, city, state, max_future_days)
        `)
        .eq('customer_user_id', user.id)
        .gte('start_at', startDate.toISOString())
        .lte('start_at', endDate.toISOString())
        .in('status', ['booked', 'confirmed', 'completed'])
        .order('start_at', { ascending: true });

      if (error) throw error;
      return data as unknown as ClientAppointment[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCancelClientAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await (supabase.rpc as any)('client_cancel_appointment', {
        p_appointment_id: appointmentId,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao cancelar agendamento');
      }
    },
    onSuccess: () => {
      // Invalidate all appointment-related queries to update all panels
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['client-appointments-month'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
    },
  });
}
