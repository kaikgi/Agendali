import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserEstablishment } from './useUserEstablishment';

export interface PaymentAccount {
  id: string;
  establishment_id: string;
  provider: string;
  mp_user_id: string | null;
  status: string;
  connected_at: string;
}

export interface PaymentSettings {
  id: string;
  establishment_id: string;
  online_payment_enabled: boolean;
  deposit_required: boolean;
  deposit_type: 'fixed' | 'percentage';
  deposit_value: number;
  full_payment_online: boolean;
  per_service_config: boolean;
  require_manual_confirmation: boolean;
  refund_on_cancellation: boolean;
  refund_deadline_hours: number;
}

export interface AppointmentPayment {
  id: string;
  establishment_id: string;
  appointment_id: string;
  provider: string;
  provider_payment_id: string | null;
  payment_type: 'deposit' | 'full';
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  status: string;
  payment_url: string | null;
  payer_email: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

// ── Payment Account ────────────────────────────────────

export function usePaymentAccount() {
  const { data: est } = useUserEstablishment();
  return useQuery({
    queryKey: ['payment-account', est?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_accounts')
        .select('id, establishment_id, provider, mp_user_id, status, connected_at')
        .eq('establishment_id', est!.id)
        .eq('provider', 'mercadopago')
        .neq('status', 'pending_oauth')
        .maybeSingle();
      if (error) throw error;
      return data as PaymentAccount | null;
    },
    enabled: !!est?.id,
  });
}

export function useConnectMercadoPago() {
  const { data: est } = useUserEstablishment();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mercadopago-oauth?action=connect&state=${est!.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao iniciar conexão com Mercado Pago');
      }

      if (data.auth_url) {
        window.location.href = data.auth_url;
        return;
      }

      throw new Error('URL de autorização não retornada pelo servidor');
    },
  });
}

export function useDisconnectMercadoPago() {
  const qc = useQueryClient();
  const { data: est } = useUserEstablishment();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mercadopago-oauth?action=disconnect&state=${est!.id}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to disconnect');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-account'] }),
  });
}

// ── Payment Settings ───────────────────────────────────

export function usePaymentSettings() {
  const { data: est } = useUserEstablishment();
  return useQuery({
    queryKey: ['payment-settings', est?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('payment_settings')
        .select('*')
        .eq('establishment_id', est!.id)
        .maybeSingle();
      if (error) throw error;
      return data as PaymentSettings | null;
    },
    enabled: !!est?.id,
  });
}

export function useUpdatePaymentSettings() {
  const qc = useQueryClient();
  const { data: est } = useUserEstablishment();
  return useMutation({
    mutationFn: async (settings: Partial<PaymentSettings>) => {
      const { data, error } = await (supabase as any)
        .from('payment_settings')
        .upsert({ ...settings, establishment_id: est!.id }, { onConflict: 'establishment_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-settings'] }),
  });
}

// ── Appointment Payments ───────────────────────────────

export function useAppointmentPayments(filters: { status?: string; dateFrom?: string; dateTo?: string } = {}) {
  const { data: est } = useUserEstablishment();
  return useQuery({
    queryKey: ['appointment-payments', est?.id, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('appointment_payments')
        .select('*')
        .eq('establishment_id', est!.id)
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo + 'T23:59:59');

      const { data, error } = await query;
      if (error) throw error;
      return data as AppointmentPayment[];
    },
    enabled: !!est?.id,
  });
}

// ── Create Payment (for booking flow) ──────────────────

export function useCreatePayment() {
  return useMutation({
    mutationFn: async (params: {
      establishment_id: string;
      appointment_id: string;
      amount_cents: number;
      payment_type: 'deposit' | 'full';
      payer_email?: string;
      service_name?: string;
      customer_name?: string;
      slug?: string;
    }) => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/mercadopago-create-payment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment creation failed');
      return data as { payment_url: string; preference_id: string };
    },
  });
}

// ── Get payment config for booking ─────────────────────

export function usePaymentConfigForBooking(slug: string | undefined, serviceId: string | undefined) {
  return useQuery({
    queryKey: ['payment-config-booking', slug, serviceId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_payment_config_for_booking', {
        p_slug: slug!,
        p_service_id: serviceId!,
      });
      if (error) throw error;
      return data as {
        enabled: boolean;
        deposit_required?: boolean;
        deposit_type?: string;
        deposit_value?: number;
        full_payment_online?: boolean;
        require_manual_confirmation?: boolean;
      };
    },
    enabled: !!slug && !!serviceId,
  });
}
