import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

async function callWhatsApp(action: string, payload: Record<string, any> = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) throw new Error("Not authenticated");

  console.log(`[callWhatsApp] action=${action}`, payload);
  const res = await supabase.functions.invoke("admin-whatsapp", {
    body: { action, ...payload },
  });

  if (res.error) {
    console.error(`[callWhatsApp] error for action=${action}:`, res.error, res.data);
    const errorDetail = (res.data as any)?.error || res.error.message;
    throw new Error(errorDetail);
  }

  console.log(`[callWhatsApp] success for action=${action}:`, res.data);
  return res.data;
}

export function useWhatsAppInstance() {
  return useQuery({
    queryKey: ["whatsapp-instance"],
    queryFn: () => callWhatsApp("get_status"),
    refetchInterval: 10000,
  });
}

export function useCheckOrCreateInstance() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => callWhatsApp("check_or_create_instance"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-instance"] }),
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useConnectInstance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => callWhatsApp("connect_instance"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-instance"] }),
  });
}

export function useDisconnectInstance() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: () => callWhatsApp("disconnect_instance"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["whatsapp-instance"] }),
  });
}

export function useUpdateInstanceToken() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (newToken: string) => callWhatsApp("update_instance_token", { newToken }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      toast({ title: "Token atualizado com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro ao atualizar token", description: e.message, variant: "destructive" }),
  });
}

export function useConnectExistingInstance() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: {
      instance_name: string;
      instance_token: string;
      server_url: string;
      device_name?: string;
      connected_phone?: string;
      notes?: string;
    }) => callWhatsApp("connect_existing_instance", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      toast({ title: "Instância conectada com sucesso" });
    },
    onError: (e: Error) => toast({ title: "Erro ao conectar instância", description: e.message, variant: "destructive" }),
  });
}

export function useTestConnection() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => callWhatsApp("test_connection"),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["whatsapp-instance"] });
      if (data?.ok) {
        toast({
          title: data.status === "connected" ? "Conectada ✓" : "Instância desconectada",
          description: `Estado: ${data.state}`,
        });
      } else {
        toast({ title: "Teste falhou", description: data?.message || "Erro desconhecido", variant: "destructive" });
      }
    },
    onError: (e: Error) => toast({ title: "Erro no teste", description: e.message, variant: "destructive" }),
  });
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)\+\.]/g, "");
  if (cleaned.startsWith("0")) cleaned = "55" + cleaned.substring(1);
  if (cleaned.length === 10 || cleaned.length === 11) cleaned = "55" + cleaned;
  return cleaned;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^[1-9]\d{10,14}$/.test(normalized);
}

export function useBroadcastContacts() {
  return useQuery({
    queryKey: ["broadcast-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_broadcast_contacts" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useAddContact() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contact: { establishment_name: string; phone: string; source?: string }) => {
      const normalized = normalizePhone(contact.phone);
      if (!isValidPhone(contact.phone)) throw new Error("Telefone inválido");

      const { data, error } = await supabase
        .from("admin_broadcast_contacts" as any)
        .insert({
          establishment_name: contact.establishment_name,
          phone: contact.phone,
          normalized_phone: normalized,
          source: contact.source || "manual",
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-contacts"] });
      toast({ title: "Contato adicionado" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_broadcast_contacts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcast-contacts"] }),
  });
}

export function useImportContacts() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contacts: { establishment_name: string; phone: string }[]) => {
      const rows = contacts.map((contact) => ({
        establishment_name: contact.establishment_name,
        phone: contact.phone,
        normalized_phone: normalizePhone(contact.phone),
        source: "excel",
      }));

      const { data, error } = await supabase.from("admin_broadcast_contacts" as any).insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["broadcast-contacts"] });
      toast({ title: `${(data as any[])?.length || 0} contatos importados` });
    },
    onError: (e: Error) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });
}

export function useBroadcastCampaigns() {
  return useQuery({
    queryKey: ["broadcast-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_broadcast_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      console.log("[useBroadcastCampaigns] campaigns refreshed", data);
      return data as any[];
    },
    refetchInterval: 3000,
  });
}

export function useCampaignDetails(campaignId: string | null) {
  return useQuery({
    queryKey: ["campaign-details", campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from("admin_broadcast_campaign_contacts" as any)
        .select("*, contact:admin_broadcast_contacts(*)")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      console.log("[useCampaignDetails] details refreshed", { campaignId, count: data?.length || 0, data });
      return data as any[];
    },
    enabled: !!campaignId,
    refetchInterval: 3000,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaign: { name: string; message: string; delay_seconds: number; contactIds: string[] }) => {
      console.log("[useCreateCampaign] creating campaign", campaign);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data: newCampaign, error } = await supabase
        .from("admin_broadcast_campaigns" as any)
        .insert({
          name: campaign.name,
          message: campaign.message,
          delay_seconds: campaign.delay_seconds,
          total_contacts: campaign.contactIds.length,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      const campaignContacts = campaign.contactIds.map((contactId) => ({
        campaign_id: (newCampaign as any).id,
        contact_id: contactId,
      }));

      const { error: campaignContactsError } = await supabase
        .from("admin_broadcast_campaign_contacts" as any)
        .insert(campaignContacts);
      if (campaignContactsError) throw campaignContactsError;

      console.log("[useCreateCampaign] campaign created", newCampaign);
      return newCampaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      toast({ title: "Campanha criada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useStartCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      console.log("[useStartCampaign] start clicked", { campaignId });

      // Loop: process one contact per call, wait delay between calls
      let iteration = 0;
      while (true) {
        iteration += 1;
        console.log(`[useStartCampaign] iteration ${iteration}`, { campaignId });

        const result = await callWhatsApp("process_campaign", { campaignId });
        console.log(`[useStartCampaign] iteration ${iteration} response`, result);

        // Refresh UI after each contact
        qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
        qc.invalidateQueries({ queryKey: ["broadcast-logs"] });
        qc.invalidateQueries({ queryKey: ["campaign-details"] });

        if (result?.done || result?.interrupted) {
          return result;
        }

        // Wait the configured delay before next contact
        const delayMs = (result?.delay_seconds || 0) * 1000;
        if (delayMs > 0) {
          console.log(`[useStartCampaign] waiting ${result.delay_seconds}s before next contact`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      qc.invalidateQueries({ queryKey: ["broadcast-logs"] });
      qc.invalidateQueries({ queryKey: ["campaign-details"] });
      toast({
        title: "Campanha processada",
        description: `${result?.totalSent ?? 0} enviados • ${result?.totalFailed ?? 0} falhas`,
      });
    },
    onError: (e: Error) => toast({ title: "Erro ao iniciar", description: e.message, variant: "destructive" }),
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      console.log("[useCancelCampaign] cancel clicked", { campaignId });
      const { error } = await supabase
        .from("admin_broadcast_campaigns" as any)
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      toast({ title: "Campanha cancelada" });
    },
  });
}

export function useBroadcastLogs(campaignId?: string) {
  return useQuery({
    queryKey: ["broadcast-logs", campaignId],
    queryFn: async () => {
      let query = supabase
        .from("admin_broadcast_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (campaignId) query = query.eq("campaign_id", campaignId);
      const { data, error } = await query;
      if (error) throw error;
      console.log("[useBroadcastLogs] logs refreshed", { campaignId, count: data?.length || 0, data });
      return data as any[];
    },
    refetchInterval: 3000,
  });
}