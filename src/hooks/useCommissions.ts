import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserEstablishment } from './useUserEstablishment';

// ── Types ──────────────────────────────────────────────

export interface CommissionRule {
  id: string;
  establishment_id: string;
  professional_id: string;
  service_id: string | null;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  is_default: boolean;
  active: boolean;
  effective_from: string;
  created_at: string;
  updated_at: string;
}

export interface CommissionEntry {
  id: string;
  establishment_id: string;
  professional_id: string;
  appointment_id: string;
  service_id: string | null;
  customer_id: string | null;
  service_name: string;
  service_price_cents: number;
  professional_name: string;
  customer_name: string | null;
  commission_type: string;
  commission_value: number;
  commission_amount_cents: number;
  appointment_date: string;
  settlement_id: string | null;
  status: 'pending' | 'settled' | 'voided';
  created_at: string;
}

export interface CommissionSettlement {
  id: string;
  establishment_id: string;
  professional_id: string;
  period_start: string;
  period_end: string;
  total_amount_cents: number;
  entries_count: number;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface CommissionFilters {
  professionalId?: string;
  serviceId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

// ── Rules ──────────────────────────────────────────────

export function useCommissionRules() {
  const { data: establishment } = useUserEstablishment();
  const estId = establishment?.id;

  return useQuery({
    queryKey: ['commission-rules', estId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('commission_rules')
        .select('*')
        .eq('establishment_id', estId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CommissionRule[];
    },
    enabled: !!estId,
  });
}

export function useUpsertCommissionRule() {
  const qc = useQueryClient();
  const { data: establishment } = useUserEstablishment();

  return useMutation({
    mutationFn: async (rule: Partial<CommissionRule> & { professional_id: string }) => {
      const payload = {
        ...rule,
        establishment_id: establishment?.id,
      };

      if (rule.id) {
        const { data, error } = await (supabase as any)
          .from('commission_rules')
          .update(payload)
          .eq('id', rule.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from('commission_rules')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] });
    },
  });
}

export function useDeleteCommissionRule() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await (supabase as any)
        .from('commission_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-rules'] });
    },
  });
}

// ── Entries ────────────────────────────────────────────

export function useCommissionEntries(filters: CommissionFilters = {}) {
  const { data: establishment } = useUserEstablishment();
  const estId = establishment?.id;

  return useQuery({
    queryKey: ['commission-entries', estId, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('commission_entries')
        .select('*')
        .eq('establishment_id', estId)
        .order('appointment_date', { ascending: false });

      if (filters.professionalId) {
        query = query.eq('professional_id', filters.professionalId);
      }
      if (filters.serviceId) {
        query = query.eq('service_id', filters.serviceId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.dateFrom) {
        query = query.gte('appointment_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('appointment_date', filters.dateTo + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;

      let entries = data as CommissionEntry[];

      // Client-side search filter
      if (filters.search) {
        const s = filters.search.toLowerCase();
        entries = entries.filter(
          (e) =>
            e.customer_name?.toLowerCase().includes(s) ||
            e.professional_name?.toLowerCase().includes(s) ||
            e.service_name?.toLowerCase().includes(s)
        );
      }

      return entries;
    },
    enabled: !!estId,
  });
}

// ── Settlements ────────────────────────────────────────

export function useCommissionSettlements() {
  const { data: establishment } = useUserEstablishment();
  const estId = establishment?.id;

  return useQuery({
    queryKey: ['commission-settlements', estId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('commission_settlements')
        .select('*')
        .eq('establishment_id', estId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CommissionSettlement[];
    },
    enabled: !!estId,
  });
}

export function useCreateSettlement() {
  const qc = useQueryClient();
  const { data: establishment } = useUserEstablishment();

  return useMutation({
    mutationFn: async (params: {
      professionalId: string;
      periodStart: string;
      periodEnd: string;
      entryIds: string[];
      notes?: string;
    }) => {
      // Use atomic RPC instead of multi-step client-side mutation
      const { data, error } = await (supabase.rpc as any)('create_commission_settlement', {
        p_establishment_id: establishment?.id,
        p_professional_id: params.professionalId,
        p_period_start: params.periodStart,
        p_period_end: params.periodEnd,
        p_entry_ids: params.entryIds,
        p_notes: params.notes || null,
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao registrar repasse');
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] });
      qc.invalidateQueries({ queryKey: ['commission-settlements'] });
    },
  });
}

// ── Aggregation helpers ────────────────────────────────

/** Only count non-voided entries for revenue/commission metrics */
export function aggregateByProfessional(entries: CommissionEntry[]) {
  const activeEntries = entries.filter((e) => e.status !== 'voided');
  const map = new Map<string, {
    professionalId: string;
    professionalName: string;
    totalCommission: number;
    totalRevenue: number;
    count: number;
    pendingCount: number;
    pendingAmount: number;
    settledCount: number;
    settledAmount: number;
  }>();

  for (const e of activeEntries) {
    const existing = map.get(e.professional_id) || {
      professionalId: e.professional_id,
      professionalName: e.professional_name,
      totalCommission: 0,
      totalRevenue: 0,
      count: 0,
      pendingCount: 0,
      pendingAmount: 0,
      settledCount: 0,
      settledAmount: 0,
    };
    existing.totalCommission += e.commission_amount_cents;
    existing.totalRevenue += e.service_price_cents;
    existing.count += 1;
    if (e.status === 'pending') {
      existing.pendingCount += 1;
      existing.pendingAmount += e.commission_amount_cents;
    }
    if (e.status === 'settled') {
      existing.settledCount += 1;
      existing.settledAmount += e.commission_amount_cents;
    }
    map.set(e.professional_id, existing);
  }

  return Array.from(map.values());
}
