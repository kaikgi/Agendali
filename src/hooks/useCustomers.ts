import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
  establishment_id: string;
}

export interface CustomerWithAppointments extends Customer {
  appointments: {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    customer_notes: string | null;
    service: { name: string; duration_minutes: number; price_cents: number | null } | null;
    professional: { name: string } | null;
  }[];
}

export function useCustomers(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['customers', establishmentId],
    queryFn: async () => {
      if (!establishmentId) return [];
      
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, email, created_at, establishment_id')
        .eq('establishment_id', establishmentId)
        .order('name');

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!establishmentId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useCustomerWithAppointments(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;

      const { data: appointments, error: appointmentsError } = await supabase
        .from('appointments')
        .select(`
          id,
          start_at,
          end_at,
          status,
          customer_notes,
          service:services(name, duration_minutes, price_cents),
          professional:professionals(name)
        `)
        .eq('customer_id', customerId)
        .order('start_at', { ascending: false });

      if (appointmentsError) throw appointmentsError;

      return {
        ...customer,
        appointments: appointments || [],
      } as CustomerWithAppointments;
    },
    enabled: !!customerId,
  });
}
