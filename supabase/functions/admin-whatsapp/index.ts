import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'ativo')
      .maybeSingle();

    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const SERVER_URL = (Deno.env.get('WHATSAPI_SERVER_URL') || '').replace(/\/$/, '');
    const CREATE_TOKEN = Deno.env.get('WHATSAPI_CREATE_TOKEN') || '';

    console.log('Config:', { hasServerUrl: !!SERVER_URL, hasCreateToken: !!CREATE_TOKEN, serverUrl: SERVER_URL });

    if (!SERVER_URL || !CREATE_TOKEN) {
      return new Response(JSON.stringify({ error: 'WhatsApp API not configured. Set WHATSAPI_SERVER_URL and WHATSAPI_CREATE_TOKEN.' }), { status: 500, headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;
    console.log('Action:', action);

    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const jsonErr = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders });

    const getInstanceFromDb = async () => {
      const { data } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    };

    const apiFetch = async (path: string, method: string, headers: Record<string, string>, payload?: any) => {
      const url = `${SERVER_URL}${path}`;
      console.log(`API call: ${method} ${url}`);
      if (payload) console.log('Payload:', JSON.stringify(payload).substring(0, 500));

      const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
      if (payload) opts.body = JSON.stringify(payload);

      const res = await fetch(url, opts);
      const text = await res.text();
      console.log(`API response: status=${res.status}, body=${text.substring(0, 1000)}`);

      let data: any;
      try { data = JSON.parse(text); } catch { data = text; }
      return { ok: res.ok, status: res.status, data };
    };

    // ========== ACTIONS ==========

    if (action === 'check_or_create_instance') {
      // 1. Check DB first
      const existing = await getInstanceFromDb();
      if (existing) {
        console.log('Instance already exists in DB:', existing.instance_name);
        try {
          const token = existing.instance_token || CREATE_TOKEN;
          const statusRes = await apiFetch(
            `/instance/connectionState/${existing.instance_name}`,
            'GET',
            { apikey: token }
          );
          const state = statusRes.data?.instance?.state || statusRes.data?.state || 'unknown';
          const isConnected = state === 'open';
          await adminClient.from('admin_whatsapp_instances').update({
            status: state, is_connected: isConnected, updated_at: new Date().toISOString(),
            ...(isConnected ? { last_connection_at: new Date().toISOString() } : {})
          }).eq('id', existing.id);
          return json({ instance: { ...existing, status: state, is_connected: isConnected }, exists: true });
        } catch (e) {
          console.error('Status sync failed:', e);
          return json({ instance: existing, exists: true });
        }
      }

      // 2. Create new instance via /functions/v1/create-instance-url
      const instanceName = `agendali-${Date.now()}`;
      const deviceName = 'Agendali Broadcast';
      const createUrl = `${SERVER_URL}/functions/v1/create-instance-url`;

      console.log('Creating new instance via correct endpoint:', createUrl);
      console.log('Payload:', JSON.stringify({ token: '***', name: instanceName, deviceName }));

      const createOpts: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: CREATE_TOKEN, name: instanceName, deviceName }),
      };

      const createResp = await fetch(createUrl, createOpts);
      const createText = await createResp.text();
      console.log(`Create response: status=${createResp.status}, body=${createText.substring(0, 1000)}`);

      let rd: any = {};
      try { rd = JSON.parse(createText); } catch { rd = { raw: createText }; }

      if (!createResp.ok) {
        const errMsg = rd?.error || rd?.message || createText;
        let userMsg = `Falha ao criar instância (${createResp.status})`;
        if (createResp.status === 400) userMsg = `Parâmetros faltando: ${errMsg}`;
        else if (createResp.status === 401) userMsg = `Token inválido ou expirado: ${errMsg}`;
        else if (createResp.status === 403) userMsg = `Saldo insuficiente ou acesso negado: ${errMsg}`;
        else userMsg = `${userMsg}: ${errMsg}`;
        console.error('Create instance failed:', userMsg);
        return jsonErr(userMsg, createResp.status >= 400 && createResp.status < 500 ? createResp.status : 500);
      }

      // Parse response per documentation
      const instanceToken = rd['Instance Token'] || rd?.instance_token || rd?.token || '';
      const serverUrlFromResponse = rd?.server_url || SERVER_URL;
      const instName = rd?.instance?.name || instanceName;
      const instDeviceName = rd?.instance?.device_name || deviceName;
      const instWebhook = rd?.webhook || '';
      const instToken = rd?.token || '';

      console.log('Parsed create response:', { instName, hasInstanceToken: !!instanceToken, serverUrl: serverUrlFromResponse });

      const { data: newInst, error: insertErr } = await adminClient.from('admin_whatsapp_instances').insert({
        instance_name: instName,
        server_url: serverUrlFromResponse,
        instance_token: instanceToken,
        token: instToken,
        device_name: instDeviceName,
        webhook: instWebhook,
        api_key: '',
        status: 'created',
        is_connected: false,
      }).select().single();

      if (insertErr) {
        console.error('DB insert error:', insertErr);
        return jsonErr(`Instância criada mas falhou ao salvar: ${insertErr.message}`, 500);
      }

      console.log('New instance saved:', newInst?.id);
      return json({ instance: newInst, created: true });
    }

    if (action === 'connect_instance') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância encontrada', 404);

      const token = inst.instance_token || CREATE_TOKEN;
      const connectRes = await apiFetch(`/instance/connect/${inst.instance_name}`, 'GET', { apikey: token });

      const qr = connectRes.data?.base64 || connectRes.data?.qrcode?.base64 || connectRes.data?.qrcode || null;
      await adminClient.from('admin_whatsapp_instances').update({
        status: qr ? 'qr_ready' : 'connecting', qr_code: qr, updated_at: new Date().toISOString()
      }).eq('id', inst.id);

      return json({ qrcode: qr, instance: { ...inst, qr_code: qr } });
    }

    if (action === 'get_status') {
      const inst = await getInstanceFromDb();
      if (!inst) return json({ instance: null });

      try {
        const token = inst.instance_token || CREATE_TOKEN;
        const statusRes = await apiFetch(`/instance/connectionState/${inst.instance_name}`, 'GET', { apikey: token });
        const state = statusRes.data?.instance?.state || statusRes.data?.state || 'unknown';
        const isConnected = state === 'open';
        await adminClient.from('admin_whatsapp_instances').update({
          status: state, is_connected: isConnected, updated_at: new Date().toISOString(),
          ...(isConnected ? { last_connection_at: new Date().toISOString() } : {})
        }).eq('id', inst.id);
        return json({ instance: { ...inst, status: state, is_connected: isConnected } });
      } catch (e) {
        console.error('get_status error:', e);
        return json({ instance: inst });
      }
    }

    if (action === 'disconnect_instance') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância encontrada', 404);
      const token = inst.instance_token || CREATE_TOKEN;
      await apiFetch(`/instance/logout/${inst.instance_name}`, 'DELETE', { apikey: token });
      await adminClient.from('admin_whatsapp_instances').update({
        status: 'disconnected', is_connected: false, qr_code: null, updated_at: new Date().toISOString()
      }).eq('id', inst.id);
      return json({ ok: true });
    }

    if (action === 'send_text') {
      const { phone, message } = body;
      if (!phone || !message) return jsonErr('Missing phone or message');
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância encontrada', 404);
      if (!inst.instance_token) return jsonErr('Instance token não disponível. Recrie a instância.', 400);

      const sendRes = await apiFetch(`/message/sendText/${inst.instance_name}`, 'POST', { apikey: inst.instance_token }, { number: phone, text: message });
      return json({ ok: sendRes.ok, data: sendRes.data });
    }

    if (action === 'process_campaign') {
      const { campaignId } = body;
      if (!campaignId) return jsonErr('Missing campaignId');

      const { data: campaign } = await adminClient.from('admin_broadcast_campaigns').select('*').eq('id', campaignId).single();
      if (!campaign) return jsonErr('Campaign not found', 404);
      if (campaign.status !== 'draft' && campaign.status !== 'paused') return jsonErr('Campaign not in valid state to start');

      const inst = await getInstanceFromDb();
      if (!inst || !inst.is_connected) return jsonErr('WhatsApp não conectado');
      if (!inst.instance_token) return jsonErr('Instance token não disponível');

      await adminClient.from('admin_broadcast_campaigns').update({
        status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', campaignId);

      const { data: campaignContacts } = await adminClient
        .from('admin_broadcast_campaign_contacts')
        .select('*, contact:admin_broadcast_contacts(*)')
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'failed'])
        .order('created_at', { ascending: true });

      if (!campaignContacts || campaignContacts.length === 0) {
        await adminClient.from('admin_broadcast_campaigns').update({
          status: 'completed', finished_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }).eq('id', campaignId);
        return json({ ok: true, message: 'No contacts to process' });
      }

      let totalSent = campaign.total_sent || 0;
      let totalFailed = campaign.total_failed || 0;

      for (let i = 0; i < campaignContacts.length; i++) {
        const cc = campaignContacts[i];
        const contact = cc.contact;
        if (!contact) continue;

        const { data: currentCampaign } = await adminClient.from('admin_broadcast_campaigns').select('status').eq('id', campaignId).single();
        if (currentCampaign?.status === 'canceled' || currentCampaign?.status === 'paused') break;

        await adminClient.from('admin_broadcast_campaign_contacts').update({
          status: 'sending', attempt_count: cc.attempt_count + 1, updated_at: new Date().toISOString()
        }).eq('id', cc.id);

        try {
          const sendRes = await apiFetch(`/message/sendText/${inst.instance_name}`, 'POST', { apikey: inst.instance_token }, { number: contact.normalized_phone, text: campaign.message });

          if (sendRes.ok) {
            const msgId = sendRes.data?.key?.id || sendRes.data?.messageId || null;
            await adminClient.from('admin_broadcast_campaign_contacts').update({
              status: 'sent', sent_at: new Date().toISOString(), provider_message_id: msgId, updated_at: new Date().toISOString()
            }).eq('id', cc.id);
            await adminClient.from('admin_broadcast_logs').insert({
              campaign_id: campaignId, contact_id: contact.id, phone: contact.normalized_phone,
              establishment_name: contact.establishment_name, message: campaign.message,
              status: 'sent', provider_message_id: msgId,
            });
            totalSent++;
          } else {
            const errMsg = typeof sendRes.data === 'string' ? sendRes.data : JSON.stringify(sendRes.data);
            await adminClient.from('admin_broadcast_campaign_contacts').update({
              status: 'failed', failed_at: new Date().toISOString(), error_message: errMsg.substring(0, 500), updated_at: new Date().toISOString()
            }).eq('id', cc.id);
            await adminClient.from('admin_broadcast_logs').insert({
              campaign_id: campaignId, contact_id: contact.id, phone: contact.normalized_phone,
              establishment_name: contact.establishment_name, message: campaign.message,
              status: 'failed', error: errMsg.substring(0, 500),
            });
            totalFailed++;
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          await adminClient.from('admin_broadcast_campaign_contacts').update({
            status: 'failed', failed_at: new Date().toISOString(), error_message: errMsg.substring(0, 500), updated_at: new Date().toISOString()
          }).eq('id', cc.id);
          await adminClient.from('admin_broadcast_logs').insert({
            campaign_id: campaignId, contact_id: contact.id, phone: contact.normalized_phone,
            establishment_name: contact.establishment_name, message: campaign.message,
            status: 'failed', error: errMsg.substring(0, 500),
          });
          totalFailed++;
        }

        await adminClient.from('admin_broadcast_campaigns').update({
          total_sent: totalSent, total_failed: totalFailed, updated_at: new Date().toISOString()
        }).eq('id', campaignId);

        if (i < campaignContacts.length - 1 && campaign.delay_seconds > 0) {
          await new Promise(resolve => setTimeout(resolve, campaign.delay_seconds * 1000));
        }
      }

      const { data: finalCampaign } = await adminClient.from('admin_broadcast_campaigns').select('status').eq('id', campaignId).single();
      if (finalCampaign?.status === 'running') {
        await adminClient.from('admin_broadcast_campaigns').update({
          status: 'completed', finished_at: new Date().toISOString(), total_sent: totalSent, total_failed: totalFailed, updated_at: new Date().toISOString()
        }).eq('id', campaignId);
      }

      return json({ ok: true, totalSent, totalFailed });
    }

    if (action === 'update_instance_token') {
      const { newToken } = body;
      if (!newToken || typeof newToken !== 'string' || newToken.trim().length < 10) {
        return jsonErr('Token inválido. Deve ter pelo menos 10 caracteres.');
      }

      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância encontrada para atualizar', 404);

      const { error: updErr } = await adminClient.from('admin_whatsapp_instances').update({
        instance_token: newToken.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', inst.id);

      if (updErr) {
        console.error('Failed to update instance token:', updErr);
        return jsonErr(`Erro ao atualizar token: ${updErr.message}`, 500);
      }

      console.log(`Instance token updated for ${inst.instance_name} by admin ${user.id}`);

      // Log to audit
      await adminClient.from('admin_audit_logs').insert({
        admin_user_id: adminUser.id,
        action: 'whatsapp_token_updated',
        metadata: { instance_id: inst.id, instance_name: inst.instance_name },
      }).catch(e => console.error('Audit log insert failed:', e));

      return json({ ok: true, instance_name: inst.instance_name });
    }

    return jsonErr('Unknown action');
  } catch (error) {
    console.error('admin-whatsapp error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
