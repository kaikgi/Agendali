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

// ─── Instance hooks ───

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

// ─── Phone utils ───

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

// ─── Contact Batches ───

const MANUAL_BATCH_ID = "00000000-0000-0000-0000-000000000001";

export function useContactBatches() {
  return useQuery({
    queryKey: ["broadcast-batches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_broadcast_contact_batches" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (batchId: string) => {
      // Delete contacts in this batch first
      const { error: contactsError } = await supabase
        .from("admin_broadcast_contacts" as any)
        .delete()
        .eq("batch_id", batchId);
      if (contactsError) throw contactsError;
      // Delete the batch
      const { error } = await supabase
        .from("admin_broadcast_contact_batches" as any)
        .delete()
        .eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-batches"] });
      qc.invalidateQueries({ queryKey: ["broadcast-contacts"] });
      toast({ title: "Lote excluído" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

// ─── Contacts ───

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
    mutationFn: async (contact: { establishment_name: string; phone: string }) => {
      const normalized = normalizePhone(contact.phone);
      if (!isValidPhone(contact.phone)) throw new Error("Telefone inválido");

      const { data, error } = await supabase
        .from("admin_broadcast_contacts" as any)
        .insert({
          establishment_name: contact.establishment_name,
          phone: contact.phone,
          normalized_phone: normalized,
          source: "manual",
          batch_id: MANUAL_BATCH_ID,
        })
        .select();
      if (error) throw error;

      // Update batch count
      await updateBatchCount(MANUAL_BATCH_ID);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-contacts"] });
      qc.invalidateQueries({ queryKey: ["broadcast-batches"] });
      toast({ title: "Contato adicionado" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contact: { id: string; batch_id?: string }) => {
      const { error } = await supabase.from("admin_broadcast_contacts" as any).delete().eq("id", contact.id);
      if (error) throw error;
      if (contact.batch_id) await updateBatchCount(contact.batch_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-contacts"] });
      qc.invalidateQueries({ queryKey: ["broadcast-batches"] });
    },
  });
}

async function updateBatchCount(batchId: string) {
  const { count } = await supabase
    .from("admin_broadcast_contacts" as any)
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);

  await supabase
    .from("admin_broadcast_contact_batches" as any)
    .update({ total_contacts: count || 0, updated_at: new Date().toISOString() })
    .eq("id", batchId);
}

export function useImportContacts() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (args: { fileName: string; contacts: { establishment_name: string; phone: string }[] }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Create a new batch
      const { data: batch, error: batchError } = await supabase
        .from("admin_broadcast_contact_batches" as any)
        .insert({
          name: args.fileName,
          type: "import",
          source_file_name: args.fileName,
          total_contacts: args.contacts.length,
          created_by: user?.id,
        })
        .select()
        .single();
      if (batchError) throw batchError;

      // 2. Insert contacts linked to this batch
      const rows = args.contacts.map((c) => ({
        establishment_name: c.establishment_name,
        phone: c.phone,
        normalized_phone: normalizePhone(c.phone),
        source: "excel",
        batch_id: (batch as any).id,
      }));

      const { data, error } = await supabase.from("admin_broadcast_contacts" as any).insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["broadcast-contacts"] });
      qc.invalidateQueries({ queryKey: ["broadcast-batches"] });
      toast({ title: `${(data as any[])?.length || 0} contatos importados` });
    },
    onError: (e: Error) => toast({ title: "Erro na importação", description: e.message, variant: "destructive" }),
  });
}

// ─── Campaigns ───

export function useBroadcastCampaigns() {
  return useQuery({
    queryKey: ["broadcast-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_broadcast_campaigns" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
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
      const { data: { user } } = await supabase.auth.getUser();

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

      const { error: ccError } = await supabase
        .from("admin_broadcast_campaign_contacts" as any)
        .insert(campaignContacts);
      if (ccError) throw ccError;

      return newCampaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      toast({ title: "Campanha criada" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });
}

// ─── Campaign execution ───

const activeCampaignAborts = new Map<string, AbortController>();

export function abortCampaignLoop(campaignId: string) {
  const controller = activeCampaignAborts.get(campaignId);
  if (controller) {
    controller.abort();
    activeCampaignAborts.delete(campaignId);
  }
}

function interruptibleSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

export function useStartCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      abortCampaignLoop(campaignId);
      const controller = new AbortController();
      activeCampaignAborts.set(campaignId, controller);

      try {
        let iteration = 0;
        while (true) {
          iteration += 1;
          if (controller.signal.aborted) return { interrupted: true, status: "paused" };

          const result = await callWhatsApp("process_campaign", { campaignId });
          qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
          qc.invalidateQueries({ queryKey: ["broadcast-logs"] });
          qc.invalidateQueries({ queryKey: ["campaign-details"] });

          if (result?.done || result?.interrupted) return result;

          const delayMs = (result?.delay_seconds || 0) * 1000;
          if (delayMs > 0) {
            try {
              await interruptibleSleep(delayMs, controller.signal);
            } catch (e: any) {
              if (e.name === "AbortError") return { interrupted: true, status: "paused" };
              throw e;
            }
          }
        }
      } finally {
        activeCampaignAborts.delete(campaignId);
      }
    },
    onSuccess: (result: any) => {
      qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      qc.invalidateQueries({ queryKey: ["broadcast-logs"] });
      qc.invalidateQueries({ queryKey: ["campaign-details"] });

      if (result?.interrupted) {
        toast({ title: result?.status === "paused" ? "Campanha pausada" : "Campanha interrompida" });
      } else {
        toast({
          title: "Campanha processada",
          description: `${result?.totalSent ?? result?.sent ?? 0} enviados • ${result?.totalFailed ?? result?.failed ?? 0} falhas`,
        });
      }
    },
    onError: (e: Error) => {
      if (e.name === "AbortError" || e.message?.includes("Aborted")) return;
      toast({ title: "Erro ao iniciar", description: e.message, variant: "destructive" });
    },
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from("admin_broadcast_campaigns" as any)
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
      abortCampaignLoop(campaignId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcast-campaigns"] });
      qc.invalidateQueries({ queryKey: ["campaign-details"] });
      toast({ title: "Campanha pausada" });
    },
    onError: (e: Error) => toast({ title: "Erro ao pausar", description: e.message, variant: "destructive" }),
  });
}

export function useCancelCampaign() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from("admin_broadcast_campaigns" as any)
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
      abortCampaignLoop(campaignId);
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
      return data as any[];
    },
    refetchInterval: 3000,
  });
}
