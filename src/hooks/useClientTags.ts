import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClientTag {
  id: string;
  establishment_id: string;
  name: string;
  color: string;
  is_active: boolean;
  bypass_approval: boolean;
  bypass_payment: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerTagAssignment {
  id: string;
  customer_id: string;
  tag_id: string;
  establishment_id: string;
  created_at: string;
}

export function useClientTags(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['client-tags', establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_tags' as any)
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data as unknown as ClientTag[];
    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });
}

export function useCreateClientTag(establishmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tag: { name: string; color: string; bypass_approval?: boolean }) => {
      const { data, error } = await supabase
        .from('client_tags' as any)
        .insert({
          establishment_id: establishmentId,
          name: tag.name,
          color: tag.color,
          bypass_approval: tag.bypass_approval ?? false,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ClientTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tags', establishmentId] });
    },
  });
}

export function useUpdateClientTag(establishmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClientTag> & { id: string }) => {
      const { error } = await supabase
        .from('client_tags' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tags', establishmentId] });
    },
  });
}

export function useDeleteClientTag(establishmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_tags' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-tags', establishmentId] });
      queryClient.invalidateQueries({ queryKey: ['customer-tags'] });
    },
  });
}

// Get tag assignments for a customer
export function useCustomerTags(customerId: string | undefined, establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['customer-tags', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_tag_assignments' as any)
        .select('*, tag:client_tags(*)')
        .eq('customer_id', customerId)
        .eq('establishment_id', establishmentId);
      if (error) throw error;
      return data as unknown as (CustomerTagAssignment & { tag: ClientTag })[];
    },
    enabled: !!customerId && !!establishmentId,
  });
}

// Get all customer tag assignments for the establishment (for list view)
export function useAllCustomerTags(establishmentId: string | undefined) {
  return useQuery({
    queryKey: ['all-customer-tags', establishmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_tag_assignments' as any)
        .select('customer_id, tag_id, tag:client_tags(id, name, color, is_active, bypass_approval)')
        .eq('establishment_id', establishmentId);
      if (error) throw error;
      return data as unknown as { customer_id: string; tag_id: string; tag: ClientTag }[];
    },
    enabled: !!establishmentId,
    staleTime: 30000,
  });
}

export function useAssignTag(establishmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, tagId }: { customerId: string; tagId: string }) => {
      const { error } = await supabase
        .from('customer_tag_assignments' as any)
        .insert({
          customer_id: customerId,
          tag_id: tagId,
          establishment_id: establishmentId,
        } as any)
        .select();
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags', vars.customerId] });
      queryClient.invalidateQueries({ queryKey: ['all-customer-tags', establishmentId] });
    },
  });
}

export function useRemoveTag(establishmentId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ customerId, tagId }: { customerId: string; tagId: string }) => {
      const { error } = await supabase
        .from('customer_tag_assignments' as any)
        .delete()
        .eq('customer_id', customerId)
        .eq('tag_id', tagId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['customer-tags', vars.customerId] });
      queryClient.invalidateQueries({ queryKey: ['all-customer-tags', establishmentId] });
    },
  });
}
