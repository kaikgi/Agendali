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
      // 1. Calculate total
      const { data: entries, error: entriesErr } = await (supabase as any)
        .from('commission_entries')
        .select('commission_amount_cents')
        .in('id', params.entryIds);
      if (entriesErr) throw entriesErr;

      const total = (entries as any[]).reduce((sum: number, e: any) => sum + e.commission_amount_cents, 0);

      // 2. Create settlement
      const { data: settlement, error: settErr } = await (supabase as any)
        .from('commission_settlements')
        .insert({
          establishment_id: establishment?.id,
          professional_id: params.professionalId,
          period_start: params.periodStart,
          period_end: params.periodEnd,
          total_amount_cents: total,
          entries_count: params.entryIds.length,
          notes: params.notes || null,
          paid_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (settErr) throw settErr;

      // 3. Update entries
      const { error: updateErr } = await (supabase as any)
        .from('commission_entries')
        .update({ settlement_id: settlement.id, status: 'settled' })
        .in('id', params.entryIds);
      if (updateErr) throw updateErr;

      return settlement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-entries'] });
      qc.invalidateQueries({ queryKey: ['commission-settlements'] });
    },
  });
}

// ── Aggregation helpers ────────────────────────────────

export function aggregateByProfessional(entries: CommissionEntry[]) {
  const map = new Map<string, {
    professionalId: string;
    professionalName: string;
    totalCommission: number;
    totalRevenue: number;
    count: number;
    pendingCount: number;
    settledCount: number;
  }>();

  for (const e of entries) {
    const existing = map.get(e.professional_id) || {
      professionalId: e.professional_id,
      professionalName: e.professional_name,
      totalCommission: 0,
      totalRevenue: 0,
      count: 0,
      pendingCount: 0,
      settledCount: 0,
    };
    existing.totalCommission += e.commission_amount_cents;
    existing.totalRevenue += e.service_price_cents;
    existing.count += 1;
    if (e.status === 'pending') existing.pendingCount += 1;
    if (e.status === 'settled') existing.settledCount += 1;
    map.set(e.professional_id, existing);
  }

  return Array.from(map.values());
}
