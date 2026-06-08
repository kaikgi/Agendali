import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type WhatsAppInstance = {
  id: string;
  instance_name: string;
  instance_token: string | null;
  server_url: string;
  connected_phone?: string | null;
  status?: string | null;
  is_connected?: boolean | null;
  is_active?: boolean | null;
  device_name?: string | null;
  token?: string | null;
  qr_code?: string | null;
  notes?: string | null;
};

const truncate = (value: unknown, max = 500) => {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const maskToken = (token?: string | null) => {
  if (!token) return "not-set";
  if (token.length <= 8) return "********";
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const normalizePhone = (phone: string) => {
  let normalized = String(phone || "").replace(/\D/g, "").replace(/^0+/, "");
  if (/^\d{10,11}$/.test(normalized)) {
    normalized = `55${normalized}`;
  }
  return normalized;
};

const isValidNormalizedPhone = (phone: string) => /^\d{12,15}$/.test(phone);

const extractConnectedPhone = (payload: any, fallback?: string | null) => {
  return payload?.instance?.owner || payload?.instance?.ownerJid || payload?.owner || payload?.ownerJid || fallback || null;
};

const isSuccessfulSendResponse = (payload: any) => {
  return Boolean(
    payload?.status === "success" ||
    payload?.success === true ||
    payload?.messageid ||
    payload?.id ||
    payload?.chatid ||
    payload?.key ||
    payload?.messageId ||
    payload?.data?.messageid ||
    payload?.data?.id ||
    payload?.data?.key ||
    payload?.data?.messageId ||
    payload?.response?.messageid ||
    payload?.response?.id ||
    payload?.response?.key ||
    payload?.response?.messageId,
  );
};

const extractProviderMessageId = (payload: any) => {
  const candidate =
    payload?.messageid ||
    payload?.id ||
    payload?.key?.id ||
    payload?.key ||
    payload?.messageId ||
    payload?.data?.messageid ||
    payload?.data?.id ||
    payload?.data?.key?.id ||
    payload?.data?.key ||
    payload?.data?.messageId ||
    payload?.response?.messageid ||
    payload?.response?.id ||
    payload?.response?.key?.id ||
    payload?.response?.key ||
    payload?.response?.messageId ||
    null;

  return candidate ? String(candidate) : null;
};

const formatApiError = (status: number, payload: any, rawText: string) => {
  const message =
    payload?.message ||
    payload?.error ||
    payload?.data?.message ||
    payload?.response?.message ||
    rawText ||
    "Erro desconhecido";

  return `Erro ${status}: ${truncate(message, 260)}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminUser } = await adminClient
      .from("admin_users")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "ativo")
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    const CREATE_INSTANCE_URL = (Deno.env.get("WHATSAPI_SERVER_URL") || "").replace(/\/+$/, "");
    const CREATE_TOKEN = Deno.env.get("WHATSAPI_CREATE_TOKEN") || "";

    console.log("Config:", { hasCreateUrl: !!CREATE_INSTANCE_URL, hasCreateToken: !!CREATE_TOKEN });

    if (!CREATE_INSTANCE_URL || !CREATE_TOKEN) {
      return new Response(
        JSON.stringify({ error: "WhatsApp API not configured. Set WHATSAPI_SERVER_URL and WHATSAPI_CREATE_TOKEN." }),
        { status: 500, headers: corsHeaders },
      );
    }

    const body = await req.json();
    const { action } = body;
    console.log("Action:", action);

    const json = (data: unknown) =>
      new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const jsonErr = (message: string, status = 400) =>
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const getInstanceFromDb = async (): Promise<WhatsAppInstance | null> => {
      const { data: active } = await adminClient
        .from("admin_whatsapp_instances")
        .select("*")
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (active) return active as WhatsAppInstance;

      const { data } = await adminClient
        .from("admin_whatsapp_instances")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return (data as WhatsAppInstance | null) ?? null;
    };

    const checkInstanceStatus = async (inst: WhatsAppInstance) => {
      const result = {
        state: "unknown",
        isConnected: false,
        phone: inst.connected_phone || null,
        error: null as string | null,
        qrcode: null as string | null,
      };

      if (!inst.instance_token) {
        result.state = "missing_token";
        result.error = "Instance token não configurado";
        return result;
      }

      const base = String(inst.server_url || "").replace(/\/+$/, "");
      const endpoint = `${base}/instance/connect`;

      try {
        console.log("[checkStatus] Request", {
          instance_name: inst.instance_name,
          endpoint,
          token_masked: maskToken(inst.instance_token),
        });

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
          body: "{}",
        });

        const rawText = await response.text();
        const payload = safeJsonParse(rawText) ?? { raw: rawText };

        console.log("[checkStatus] Response", {
          status: response.status,
          body: truncate(payload, 800),
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            result.state = "invalid_token";
            result.error = `Token inválido ou sem permissão (${response.status})`;
            return result;
          }

          result.state = "api_error";
          result.error = formatApiError(response.status, payload, rawText);
          return result;
        }

        result.phone = extractConnectedPhone(payload, inst.connected_phone);

        if (payload?.connected === true || payload?.instance?.status === "connected") {
          result.state = "connected";
          result.isConnected = true;
          return result;
        }

        const qrCode = payload?.instance?.qrcode || payload?.qrcode || null;
        if (qrCode) {
          result.state = "connecting";
          result.qrcode = qrCode;
          return result;
        }

        const providerState = payload?.instance?.status || payload?.status || "disconnected";
        result.state = providerState === "close" ? "disconnected" : providerState;
        return result;
      } catch (error) {
        result.state = "communication_error";
        result.error = error instanceof Error ? error.message : String(error);
        console.error("[checkStatus] Fetch error", result.error);
        return result;
      }
    };

    const sendWhatsAppMessage = async (inst: WhatsAppInstance, rawPhone: string, message: string) => {
      const normalizedPhone = normalizePhone(rawPhone);
      if (!isValidNormalizedPhone(normalizedPhone)) {
        return {
          ok: false,
          normalizedPhone,
          providerMessageId: null,
          error: `Telefone inválido após normalização: ${normalizedPhone || "vazio"}`,
          httpStatus: 0,
          payload: null,
          endpoint: null,
        };
      }

      if (!inst.instance_token) {
        return {
          ok: false,
          normalizedPhone,
          providerMessageId: null,
          error: "Instance token não configurado",
          httpStatus: 0,
          payload: null,
          endpoint: null,
        };
      }

      const endpoint = `${String(inst.server_url || "").replace(/\/+$/, "")}/send/text`;
      const payload = { number: normalizedPhone, text: message };

      console.log("[send_message] Request", {
        instance_name: inst.instance_name,
        endpoint,
        method: "POST",
        token_masked: maskToken(inst.instance_token),
        headers: {
          "Content-Type": "application/json",
          token: maskToken(inst.instance_token),
        },
        normalized_phone: normalizedPhone,
        payload: { ...payload, text: truncate(message, 120) },
      });

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: inst.instance_token,
          },
          body: JSON.stringify(payload),
        });

        const rawText = await response.text();
        const parsedPayload = safeJsonParse(rawText) ?? { raw: rawText };
        const providerMessageId = extractProviderMessageId(parsedPayload);
        const ok = response.ok && isSuccessfulSendResponse(parsedPayload);

        console.log("[send_message] Response", {
          endpoint,
          http_status: response.status,
          body: truncate(parsedPayload, 800),
          interpreted_ok: ok,
          provider_message_id: providerMessageId,
        });

        return {
          ok,
          normalizedPhone,
          providerMessageId,
          error: ok ? null : formatApiError(response.status, parsedPayload, rawText),
          httpStatus: response.status,
          payload: parsedPayload,
          endpoint,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[send_message] Fetch error", {
          endpoint,
          normalized_phone: normalizedPhone,
          error: errorMessage,
        });

        return {
          ok: false,
          normalizedPhone,
          providerMessageId: null,
          error: errorMessage,
          httpStatus: 0,
          payload: null,
          endpoint,
        };
      }
    };

    const finalizeCampaign = async (campaignId: string, fallbackTotals?: { sent: number; failed: number }) => {
      const { data: campaignStatus } = await adminClient
        .from("admin_broadcast_campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (!campaignStatus || campaignStatus.status !== "running") {
        console.log("[process_campaign] Finalization skipped", {
          campaign_id: campaignId,
          current_status: campaignStatus?.status,
        });
        return { finalStatus: campaignStatus?.status ?? null };
      }

      const { data: rows } = await adminClient
        .from("admin_broadcast_campaign_contacts")
        .select("status")
        .eq("campaign_id", campaignId);

      const sent = rows?.filter((row) => row.status === "sent").length ?? fallbackTotals?.sent ?? 0;
      const failed = rows?.filter((row) => row.status === "failed").length ?? fallbackTotals?.failed ?? 0;
      const pending = rows?.filter((row) => ["pending", "sending"].includes(row.status)).length ?? 0;

      if (pending > 0) {
        console.log("[process_campaign] Campaign still has pending contacts", {
          campaign_id: campaignId,
          sent,
          failed,
          pending,
        });
        return { finalStatus: "running", sent, failed, pending };
      }

      const finalStatus = failed > 0 ? (sent > 0 ? "completed_with_failures" : "failed") : "completed";
      const finishedAt = new Date().toISOString();

      await adminClient
        .from("admin_broadcast_campaigns")
        .update({
          status: finalStatus,
          finished_at: finishedAt,
          total_sent: sent,
          total_failed: failed,
          updated_at: finishedAt,
        })
        .eq("id", campaignId);

      console.log("[process_campaign] Campaign finalized", {
        campaign_id: campaignId,
        final_status: finalStatus,
        sent,
        failed,
        finished_at: finishedAt,
      });

      return { finalStatus, sent, failed, pending: 0 };
    };

    if (action === "check_or_create_instance") {
      const existing = await getInstanceFromDb();
      if (existing) {
        console.log("Instance already exists in DB:", existing.instance_name);
        return json({ instance: existing, exists: true });
      }

      const instanceName = `agendali-${Date.now()}`;
      const deviceName = "Agendali";
      const createUrl = `${CREATE_INSTANCE_URL}/functions/v1/create-instance-url`;

      console.log("Creating new instance:", createUrl);
      const createResp = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: CREATE_TOKEN,
          name: instanceName,
          deviceName,
          systemName: "Agendali",
          system_name: "Agendali",
          system: "Agendali",
          profileName: "Agendali",
          browser: "chrome",
          fingerprintProfile: "chrome",
        }),
      });
      const createText = await createResp.text();
      console.log(`Create response: status=${createResp.status}, body=${createText.substring(0, 1000)}`);

      const responseData: any = safeJsonParse(createText) ?? { raw: createText };
      if (!createResp.ok) {
        const errorMessage = responseData?.error || responseData?.message || createText;
        return jsonErr(`Falha ao criar instância (${createResp.status}): ${errorMessage}`, 500);
      }

      const instanceToken = responseData["Instance Token"] || responseData?.instance_token || responseData?.token || "";
      const serverUrlFromResponse = responseData?.server_url || CREATE_INSTANCE_URL;
      const instanceNameFromResponse = responseData?.instance?.name || instanceName;

      const { data: newInst, error: insertErr } = await adminClient
        .from("admin_whatsapp_instances")
        .insert({
          instance_name: instanceNameFromResponse,
          server_url: serverUrlFromResponse.replace(/\/+$/, ""),
          instance_token: instanceToken,
          token: responseData?.token || "",
          device_name: responseData?.instance?.device_name || deviceName,
          webhook: responseData?.webhook || "",
          api_key: "",
          status: "created",
          is_connected: false,
          is_active: true,
        })
        .select()
        .single();

      if (insertErr) {
        return jsonErr(`Instância criada mas falhou ao salvar: ${insertErr.message}`, 500);
      }

      return json({ instance: newInst, created: true });
    }

    if (action === "connect_instance") {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância encontrada", 404);
      if (!inst.instance_token) return jsonErr("Instance token não configurado", 400);

      const base = String(inst.server_url).replace(/\/+$/, "");
      console.log(`[connect_instance] POST ${base}/instance/connect`);
      const connectRes = await fetch(`${base}/instance/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: inst.instance_token },
        body: "{}",
      });
      const connectText = await connectRes.text();
      console.log(`[connect_instance] Response: ${connectRes.status} ${connectText.substring(0, 500)}`);
      const connectData: any = safeJsonParse(connectText) ?? { raw: connectText };

      if (!connectRes.ok) {
        return jsonErr(`Erro ao conectar: ${connectData?.error || connectData?.message || connectText}`, connectRes.status);
      }

      const isConnected = connectData.connected === true || connectData.instance?.status === "connected";
      const qrCode = connectData.instance?.qrcode || connectData.qrcode || null;
      const connectedPhone = extractConnectedPhone(connectData, inst.connected_phone);

      await adminClient
        .from("admin_whatsapp_instances")
        .update({
          status: isConnected ? "connected" : qrCode ? "connecting" : "disconnected",
          is_connected: isConnected,
          qr_code: qrCode,
          connected_phone: connectedPhone,
          updated_at: new Date().toISOString(),
          ...(isConnected ? { last_connection_at: new Date().toISOString() } : {}),
        })
        .eq("id", inst.id);

      return json({
        qrcode: qrCode,
        connected: isConnected,
        instance: { ...inst, qr_code: qrCode, is_connected: isConnected, connected_phone: connectedPhone },
      });
    }

    if (action === "get_status") {
      const inst = await getInstanceFromDb();
      if (!inst) return json({ instance: null });

      const statusResult = await checkInstanceStatus(inst);
      const now = new Date().toISOString();
      await adminClient
        .from("admin_whatsapp_instances")
        .update({
          status: statusResult.state,
          is_connected: statusResult.isConnected,
          updated_at: now,
          last_validated_at: now,
          ...(statusResult.phone ? { connected_phone: statusResult.phone } : {}),
          ...(statusResult.qrcode ? { qr_code: statusResult.qrcode } : {}),
          ...(statusResult.isConnected ? { last_connection_at: now } : {}),
        })
        .eq("id", inst.id);

      return json({
        instance: {
          ...inst,
          status: statusResult.state,
          is_connected: statusResult.isConnected,
          last_validated_at: now,
          connected_phone: statusResult.phone,
          qr_code: statusResult.qrcode,
        },
        validation_error: statusResult.error,
      });
    }

    if (action === "disconnect_instance") {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância encontrada", 404);

      await adminClient
        .from("admin_whatsapp_instances")
        .update({ status: "disconnected", is_connected: false, qr_code: null, updated_at: new Date().toISOString() })
        .eq("id", inst.id);

      return json({ ok: true });
    }

    if (action === "send_text") {
      const { phone, message } = body;
      if (!phone || !message) return jsonErr("Missing phone or message");

      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância encontrada", 404);

      const sendResult = await sendWhatsAppMessage(inst, phone, message);
      return json({
        ok: sendResult.ok,
        endpoint: sendResult.endpoint,
        normalized_phone: sendResult.normalizedPhone,
        provider_message_id: sendResult.providerMessageId,
        error: sendResult.error,
        data: sendResult.payload,
      });
    }

    if (action === "process_campaign") {
      const { campaignId } = body;
      if (!campaignId) return jsonErr("Missing campaignId");

      const { data: campaign } = await adminClient
        .from("admin_broadcast_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (!campaign) return jsonErr("Campaign not found", 404);

      // Allow starting from draft/paused, or continuing a running campaign
      if (!["draft", "paused", "running"].includes(campaign.status)) {
        return jsonErr("Campaign not in valid state to process");
      }
      if (!campaign.message || !String(campaign.message).trim()) {
        return jsonErr("Campanha sem mensagem configurada");
      }

      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância ativa encontrada", 404);

      // Only check connection on first call (draft/paused → running)
      if (["draft", "paused"].includes(campaign.status)) {
        console.log("[process_campaign] First invocation — checking connection", {
          campaign_id: campaignId,
          instance: inst.instance_name,
        });

        const connectionState = await checkInstanceStatus(inst);
        const now = new Date().toISOString();
        await adminClient
          .from("admin_whatsapp_instances")
          .update({
            status: connectionState.state,
            is_connected: connectionState.isConnected,
            last_validated_at: now,
            updated_at: now,
            ...(connectionState.phone ? { connected_phone: connectionState.phone } : {}),
          })
          .eq("id", inst.id);

        if (!connectionState.isConnected) {
          return jsonErr(
            connectionState.error || `Instância não conectada. Estado: ${connectionState.state}`,
            400,
          );
        }

        await adminClient
          .from("admin_broadcast_campaigns")
          .update({ status: "running", started_at: now, finished_at: null, next_send_at: now, updated_at: now })
          .eq("id", campaignId);
      }

      // Check if campaign was canceled/paused between invocations
      const { data: currentCampaign } = await adminClient
        .from("admin_broadcast_campaigns")
        .select("status")
        .eq("id", campaignId)
        .single();

      if (["canceled", "paused"].includes(currentCampaign?.status || "")) {
        console.log("[process_campaign] Campaign interrupted", { status: currentCampaign?.status });
        return json({ ok: true, done: true, interrupted: true, status: currentCampaign?.status });
      }

      // Get ONE pending contact
      const { data: nextContacts } = await adminClient
        .from("admin_broadcast_campaign_contacts")
        .select("*, contact:admin_broadcast_contacts(*)")
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "failed"])
        .order("created_at", { ascending: true })
        .limit(1);

      const campaignContact = nextContacts?.[0] as any;

      if (!campaignContact) {
        // No more contacts — finalize
        const finalization = await finalizeCampaign(campaignId, {
          sent: campaign.total_sent || 0,
          failed: campaign.total_failed || 0,
        });
        console.log("[process_campaign] All contacts processed", finalization);
        return json({ ok: true, done: true, ...finalization });
      }

      const contact = campaignContact.contact;
      let sent = false;

      if (!contact) {
        const errorMessage = "Contato da campanha não encontrado";
        await adminClient
          .from("admin_broadcast_campaign_contacts")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignContact.id);
      } else {
        await adminClient
          .from("admin_broadcast_campaign_contacts")
          .update({
            status: "sending",
            attempt_count: (campaignContact.attempt_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", campaignContact.id);

        const sendResult = await sendWhatsAppMessage(inst, contact.normalized_phone || contact.phone, campaign.message);
        console.log("[process_campaign] Contact result", {
          campaign_contact_id: campaignContact.id,
          contact_id: contact.id,
          normalized_phone: sendResult.normalizedPhone,
          http_status: sendResult.httpStatus,
          interpreted_ok: sendResult.ok,
          provider_message_id: sendResult.providerMessageId,
          error: sendResult.error,
        });

        if (sendResult.ok) {
          sent = true;
          const sentAt = new Date().toISOString();
          await adminClient
            .from("admin_broadcast_campaign_contacts")
            .update({
              status: "sent",
              sent_at: sentAt,
              failed_at: null,
              error_message: null,
              provider_message_id: sendResult.providerMessageId,
              updated_at: sentAt,
            })
            .eq("id", campaignContact.id);

          await adminClient.from("admin_broadcast_logs").insert({
            campaign_id: campaignId,
            contact_id: contact.id,
            phone: sendResult.normalizedPhone,
            establishment_name: contact.establishment_name,
            message: campaign.message,
            status: "sent",
            provider_message_id: sendResult.providerMessageId,
          });
        } else {
          const failedAt = new Date().toISOString();
          const errorMessage = sendResult.error || "Falha desconhecida ao enviar mensagem";

          await adminClient
            .from("admin_broadcast_campaign_contacts")
            .update({
              status: "failed",
              failed_at: failedAt,
              error_message: truncate(errorMessage, 500),
              provider_message_id: sendResult.providerMessageId,
              updated_at: failedAt,
            })
            .eq("id", campaignContact.id);

          await adminClient.from("admin_broadcast_logs").insert({
            campaign_id: campaignId,
            contact_id: contact.id,
            phone: sendResult.normalizedPhone || normalizePhone(contact.phone || ""),
            establishment_name: contact.establishment_name,
            message: campaign.message,
            status: "failed",
            error: truncate({
              error: errorMessage,
              endpoint: sendResult.endpoint,
              http_status: sendResult.httpStatus,
              provider_response: sendResult.payload,
            }, 500),
            provider_message_id: sendResult.providerMessageId,
          });
        }
      }

      // Update campaign counters and schedule next
      const { data: allRows } = await adminClient
        .from("admin_broadcast_campaign_contacts")
        .select("status")
        .eq("campaign_id", campaignId);

      const totalSent = allRows?.filter((r) => r.status === "sent").length ?? 0;
      const totalFailed = allRows?.filter((r) => r.status === "failed").length ?? 0;
      const totalPending = allRows?.filter((r) => ["pending", "sending"].includes(r.status)).length ?? 0;

      const nextSendAt = totalPending > 0
        ? new Date(Date.now() + (campaign.delay_seconds || 0) * 1000).toISOString()
        : null;

      await adminClient
        .from("admin_broadcast_campaigns")
        .update({
          total_sent: totalSent,
          total_failed: totalFailed,
          last_sent_at: new Date().toISOString(),
          next_send_at: nextSendAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId);

      console.log("[process_campaign] Counters", { totalSent, totalFailed, totalPending, nextSendAt });

      // If no more pending, finalize
      if (totalPending === 0) {
        const finalization = await finalizeCampaign(campaignId, { sent: totalSent, failed: totalFailed });
        return json({ ok: true, done: true, sent: sent, ...finalization });
      }

      // More contacts remain — tell frontend to call again after delay
      return json({
        ok: true,
        done: false,
        sent: sent,
        totalSent,
        totalFailed,
        totalPending,
        delay_seconds: campaign.delay_seconds || 0,
      });
    }

    if (action === "update_instance_token") {
      const { newToken } = body;
      if (!newToken || typeof newToken !== "string" || newToken.trim().length < 10) {
        return jsonErr("Token inválido. Deve ter pelo menos 10 caracteres.");
      }

      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância encontrada para atualizar", 404);

      const { error: updateError } = await adminClient
        .from("admin_whatsapp_instances")
        .update({
          instance_token: newToken.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", inst.id);

      if (updateError) return jsonErr(`Erro ao atualizar token: ${updateError.message}`, 500);

      await adminClient
        .from("admin_audit_logs")
        .insert({
          admin_user_id: adminUser.id,
          action: "whatsapp_token_updated",
          metadata: { instance_id: inst.id, instance_name: inst.instance_name },
        })
        .catch((error) => console.error("Audit log failed:", error));

      return json({ ok: true, instance_name: inst.instance_name });
    }

    if (action === "connect_existing_instance") {
      const { instance_name, instance_token, server_url, device_name, connected_phone, notes } = body;
      if (!instance_name || !instance_token || !server_url) {
        return jsonErr("Campos obrigatórios: instance_name, instance_token, server_url");
      }

      console.log("[connect_existing] Validating instance", {
        instance_name,
        server_url,
        token_masked: maskToken(instance_token),
      });

      const statusResult = await checkInstanceStatus({
        id: "temp",
        instance_name,
        instance_token,
        server_url,
        connected_phone,
      });

      if (statusResult.state === "invalid_token") {
        return jsonErr(statusResult.error || "Token inválido ou sem permissão", 401);
      }

      const now = new Date().toISOString();
      await adminClient.from("admin_whatsapp_instances").update({ is_active: false, updated_at: now }).neq("is_active", false);

      const { data: existingByName } = await adminClient
        .from("admin_whatsapp_instances")
        .select("id")
        .eq("instance_name", instance_name)
        .maybeSingle();

      const upsertData = {
        instance_name,
        instance_token,
        server_url: server_url.replace(/\/+$/, ""),
        device_name: device_name || null,
        connected_phone: statusResult.phone || connected_phone || null,
        notes: notes || null,
        provider: "whatsapi",
        status: statusResult.state,
        is_connected: statusResult.isConnected,
        is_active: true,
        connected_at: statusResult.isConnected ? now : null,
        last_validated_at: now,
        updated_at: now,
      };

      let savedInstance: any;
      if (existingByName) {
        const { data, error } = await adminClient
          .from("admin_whatsapp_instances")
          .update(upsertData)
          .eq("id", existingByName.id)
          .select()
          .single();
        if (error) return jsonErr(`Erro ao atualizar instância: ${error.message}`, 500);
        savedInstance = data;
      } else {
        const { data, error } = await adminClient.from("admin_whatsapp_instances").insert(upsertData).select().single();
        if (error) return jsonErr(`Erro ao salvar instância: ${error.message}`, 500);
        savedInstance = data;
      }

      await adminClient
        .from("admin_audit_logs")
        .insert({
          admin_user_id: adminUser.id,
          action: "whatsapp_instance_connected_manually",
          metadata: {
            instance_id: savedInstance.id,
            instance_name,
            state: statusResult.state,
            is_connected: statusResult.isConnected,
          },
        })
        .catch((error) => console.error("Audit log failed:", error));

      return json({
        ok: true,
        instance: savedInstance,
        validation: {
          state: statusResult.state,
          is_connected: statusResult.isConnected,
          validation_error: statusResult.error,
        },
      });
    }

    if (action === "test_connection") {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância ativa encontrada", 404);
      if (!inst.instance_token || !inst.server_url) {
        return jsonErr("Instância sem token ou server_url configurado", 400);
      }

      console.log("[test_connection] Testing instance", {
        instance_name: inst.instance_name,
        server_url: inst.server_url,
        token_masked: maskToken(inst.instance_token),
      });

      const statusResult = await checkInstanceStatus(inst);
      const now = new Date().toISOString();
      await adminClient
        .from("admin_whatsapp_instances")
        .update({
          status: statusResult.state,
          is_connected: statusResult.isConnected,
          last_validated_at: now,
          updated_at: now,
          ...(statusResult.phone ? { connected_phone: statusResult.phone } : {}),
          ...(statusResult.isConnected ? { last_connection_at: now } : {}),
        })
        .eq("id", inst.id);

      if (statusResult.error) {
        return json({ ok: false, status: statusResult.state, state: statusResult.state, message: statusResult.error });
      }

      return json({
        ok: statusResult.isConnected,
        status: statusResult.isConnected ? "connected" : statusResult.state,
        state: statusResult.state,
        instance: {
          ...inst,
          status: statusResult.state,
          is_connected: statusResult.isConnected,
          last_validated_at: now,
        },
      });
    }

    if (action === "delete_instance") {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr("Nenhuma instância encontrada", 404);

      if (inst.server_url && inst.instance_token) {
        try {
          const base = String(inst.server_url).replace(/\/+$/, "");
          await fetch(`${base}/instance`, {
            method: "DELETE",
            headers: { token: inst.instance_token },
          });
        } catch (error) {
          console.error("Remote delete failed (continuing):", error);
        }
      }

      await adminClient.from("admin_whatsapp_instances").delete().eq("id", inst.id);
      return json({ ok: true, deleted: true });
    }

    return jsonErr("Unknown action");
  } catch (error) {
    console.error("admin-whatsapp error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});