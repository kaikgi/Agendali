import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizePhone = (phone: string) => {
  let normalized = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (/^\d{10,11}$/.test(normalized)) normalized = `55${normalized}`;
  return normalized;
};

const isValidNormalizedPhone = (phone: string) => /^\d{12,15}$/.test(phone);

const truncate = (value: unknown, max = 500) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const safeJsonParse = (value: string) => {
  try { return JSON.parse(value); } catch { return null; }
};

const isSuccessfulSendResponse = (payload: any) =>
  Boolean(
    payload?.status === "success" || payload?.success === true ||
    payload?.messageid || payload?.id || payload?.chatid || payload?.key ||
    payload?.messageId || payload?.data?.messageid || payload?.data?.id ||
    payload?.data?.key || payload?.data?.messageId || payload?.response?.messageid ||
    payload?.response?.id || payload?.response?.key || payload?.response?.messageId
  );

const extractProviderMessageId = (payload: any) => {
  const c = payload?.messageid || payload?.id || payload?.key?.id || payload?.key ||
    payload?.messageId || payload?.data?.messageid || payload?.data?.id ||
    payload?.data?.key?.id || payload?.data?.key || payload?.data?.messageId ||
    payload?.response?.messageid || payload?.response?.id || payload?.response?.key?.id ||
    payload?.response?.key || payload?.response?.messageId || null;
  return c ? String(c) : null;
};

const formatApiError = (status: number, payload: any, rawText: string) => {
  const msg = payload?.message || payload?.error || payload?.data?.message || rawText || "Erro desconhecido";
  return `Erro ${status}: ${truncate(msg, 260)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const db = createClient(supabaseUrl, serviceRoleKey);

  const now = new Date();
  const nowIso = now.toISOString();
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
  const staleTime = new Date(now.getTime() - STALE_THRESHOLD_MS).toISOString();

  console.log(`[broadcast-queue] Starting at ${nowIso}`);

  try {
    // 1. Recover stale "sending" contacts (stuck > 5 min)
    const { data: staleContacts } = await db
      .from("admin_broadcast_campaign_contacts")
      .update({ status: "pending", updated_at: nowIso })
      .eq("status", "sending")
      .lt("updated_at", staleTime)
      .select("id");

    if (staleContacts?.length) {
      console.log(`[broadcast-queue] Recovered ${staleContacts.length} stale contacts`);
    }

    // 2. Get all running campaigns that are due (next_send_at <= now OR next_send_at is null)
    const { data: campaigns, error: campErr } = await db
      .from("admin_broadcast_campaigns")
      .select("*")
      .eq("status", "running")
      .or(`next_send_at.is.null,next_send_at.lte.${nowIso}`)
      .order("next_send_at", { ascending: true, nullsFirst: true });

    if (campErr) {
      console.error("[broadcast-queue] Error fetching campaigns:", campErr);
      return new Response(JSON.stringify({ error: campErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!campaigns?.length) {
      console.log("[broadcast-queue] No campaigns due");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[broadcast-queue] Found ${campaigns.length} campaign(s) to process`);

    // Get active WhatsApp instance
    const { data: inst } = await db
      .from("admin_whatsapp_instances")
      .select("*")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!inst || !inst.instance_token) {
      console.error("[broadcast-queue] No active WhatsApp instance");
      return new Response(JSON.stringify({ error: "No active instance" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;

    for (const campaign of campaigns) {
      console.log(`[broadcast-queue] Processing campaign ${campaign.id} (${campaign.name})`);

      // Get next pending contact
      const { data: nextContacts } = await db
        .from("admin_broadcast_campaign_contacts")
        .select("*, contact:admin_broadcast_contacts(*)")
        .eq("campaign_id", campaign.id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(1);

      const cc = nextContacts?.[0] as any;

      if (!cc) {
        // Finalize campaign
        const { data: allRows } = await db
          .from("admin_broadcast_campaign_contacts")
          .select("status")
          .eq("campaign_id", campaign.id);

        const sent = allRows?.filter((r: any) => r.status === "sent").length ?? 0;
        const failed = allRows?.filter((r: any) => r.status === "failed").length ?? 0;
        const finalStatus = failed > 0 ? (sent > 0 ? "completed_with_failures" : "failed") : "completed";

        await db.from("admin_broadcast_campaigns").update({
          status: finalStatus,
          finished_at: nowIso,
          total_sent: sent,
          total_failed: failed,
          next_send_at: null,
          updated_at: nowIso,
        }).eq("id", campaign.id);

        console.log(`[broadcast-queue] Campaign ${campaign.id} finalized: ${finalStatus} (${sent} sent, ${failed} failed)`);
        continue;
      }

      const contact = cc.contact;

      // Mark as sending
      await db.from("admin_broadcast_campaign_contacts").update({
        status: "sending",
        attempt_count: (cc.attempt_count || 0) + 1,
        updated_at: nowIso,
      }).eq("id", cc.id);

      let sendOk = false;
      let providerMessageId: string | null = null;
      let errorMessage: string | null = null;

      if (!contact) {
        errorMessage = "Contato não encontrado";
      } else {
        const phone = contact.normalized_phone || contact.phone;
        const normalizedPhone = normalizePhone(phone);

        if (!isValidNormalizedPhone(normalizedPhone)) {
          errorMessage = `Telefone inválido: ${normalizedPhone}`;
        } else {
          // Send message
          const endpoint = `${String(inst.server_url || "").replace(/\/+$/, "")}/send/text`;
          try {
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: inst.instance_token },
              body: JSON.stringify({ number: normalizedPhone, text: campaign.message }),
            });

            const rawText = await response.text();
            const payload = safeJsonParse(rawText) ?? { raw: rawText };
            providerMessageId = extractProviderMessageId(payload);
            sendOk = response.ok && isSuccessfulSendResponse(payload);

            if (!sendOk) {
              errorMessage = formatApiError(response.status, payload, rawText);
            }

            console.log(`[broadcast-queue] Send result for ${normalizedPhone}: ok=${sendOk}, msgId=${providerMessageId}`);
          } catch (e: any) {
            errorMessage = e.message || String(e);
            console.error(`[broadcast-queue] Send error for ${normalizedPhone}:`, errorMessage);
          }
        }
      }

      // Update contact status
      const contactUpdate: any = { updated_at: new Date().toISOString() };
      if (sendOk) {
        contactUpdate.status = "sent";
        contactUpdate.sent_at = contactUpdate.updated_at;
        contactUpdate.failed_at = null;
        contactUpdate.error_message = null;
        contactUpdate.provider_message_id = providerMessageId;
      } else {
        contactUpdate.status = "failed";
        contactUpdate.failed_at = contactUpdate.updated_at;
        contactUpdate.error_message = truncate(errorMessage || "Erro desconhecido", 500);
        contactUpdate.provider_message_id = providerMessageId;
      }
      await db.from("admin_broadcast_campaign_contacts").update(contactUpdate).eq("id", cc.id);

      // Insert log
      await db.from("admin_broadcast_logs").insert({
        campaign_id: campaign.id,
        contact_id: contact?.id || null,
        phone: contact ? normalizePhone(contact.normalized_phone || contact.phone) : "unknown",
        establishment_name: contact?.establishment_name || "N/A",
        message: campaign.message,
        status: sendOk ? "sent" : "failed",
        error: sendOk ? null : truncate(errorMessage, 500),
        provider_message_id: providerMessageId,
      });

      // Update campaign counters and schedule next
      const { data: allRows } = await db
        .from("admin_broadcast_campaign_contacts")
        .select("status")
        .eq("campaign_id", campaign.id);

      const totalSent = allRows?.filter((r: any) => r.status === "sent").length ?? 0;
      const totalFailed = allRows?.filter((r: any) => r.status === "failed").length ?? 0;
      const totalPending = allRows?.filter((r: any) => ["pending", "sending"].includes(r.status)).length ?? 0;

      const nextSendAt = totalPending > 0
        ? new Date(Date.now() + (campaign.delay_seconds || 0) * 1000).toISOString()
        : null;

      await db.from("admin_broadcast_campaigns").update({
        total_sent: totalSent,
        total_failed: totalFailed,
        last_sent_at: new Date().toISOString(),
        next_send_at: nextSendAt,
        updated_at: new Date().toISOString(),
      }).eq("id", campaign.id);

      console.log(`[broadcast-queue] Campaign ${campaign.id}: sent=${totalSent}, failed=${totalFailed}, pending=${totalPending}, next_send_at=${nextSendAt}`);

      totalProcessed++;
    }

    console.log(`[broadcast-queue] Done. Processed ${totalProcessed} contact(s)`);
    return new Response(JSON.stringify({ processed: totalProcessed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[broadcast-queue] Fatal error:", error.message || error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
