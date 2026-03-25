import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: adminUser } = await adminClient.from('admin_users').select('id').eq('user_id', claims.claims.sub).eq('status', 'ativo').maybeSingle();
    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const SERVER_URL = (Deno.env.get('WHATSAPI_SERVER_URL') || '').replace(/\/$/, '');
    const CREATE_TOKEN = Deno.env.get('WHATSAPI_CREATE_TOKEN') || '';

    if (!SERVER_URL || !CREATE_TOKEN) {
      return new Response(JSON.stringify({ error: 'WhatsApp API not configured. Set WHATSAPI_SERVER_URL and WHATSAPI_CREATE_TOKEN.' }), { status: 500, headers: corsHeaders });
    }

    const body = await req.json();
    const { action } = body;

    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const jsonErr = (msg: string, status = 400) => new Response(JSON.stringify({ error: msg }), { status, headers: corsHeaders });

    // Fetch with create token (admin-level operations)
    const fetchWithCreateToken = async (path: string, method = 'GET', payload?: any) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'apikey': CREATE_TOKEN };
      const opts: RequestInit = { method, headers };
      if (payload) opts.body = JSON.stringify(payload);
      const res = await fetch(`${SERVER_URL}${path}`, opts);
      const text = await res.text();
      try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; } catch { return { ok: res.ok, status: res.status, data: text }; }
    };

    // Fetch with instance token (per-instance operations)
    const fetchWithInstanceToken = async (instanceToken: string, path: string, method = 'GET', payload?: any) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json', 'apikey': instanceToken };
      const opts: RequestInit = { method, headers };
      if (payload) opts.body = JSON.stringify(payload);
      const res = await fetch(`${SERVER_URL}${path}`, opts);
      const text = await res.text();
      try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; } catch { return { ok: res.ok, status: res.status, data: text }; }
    };

    // Helper: get saved instance from DB
    const getInstanceFromDb = async () => {
      const { data } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    };

    // ========== ACTIONS ==========

    if (action === 'check_or_create_instance') {
      const existing = await getInstanceFromDb();

      if (existing) {
        // Check status using instance token if available, otherwise create token
        try {
          const token = existing.instance_token || CREATE_TOKEN;
          const statusRes = await fetchWithInstanceToken(token, `/instance/connectionState/${existing.instance_name}`);
          const state = statusRes.data?.instance?.state || statusRes.data?.state || 'unknown';
          const isConnected = state === 'open';
          await adminClient.from('admin_whatsapp_instances').update({
            status: state, is_connected: isConnected, updated_at: new Date().toISOString(),
            ...(isConnected ? { last_connection_at: new Date().toISOString() } : {})
          }).eq('id', existing.id);
          return json({ instance: { ...existing, status: state, is_connected: isConnected } });
        } catch {
          return json({ instance: existing });
        }
      }

      // Create new instance using CREATE_TOKEN
      const instanceName = `agendali-admin-${Date.now()}`;
      const createRes = await fetchWithCreateToken('/instance/create', 'POST', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      });

      if (!createRes.ok) {
        return jsonErr(`Failed to create instance: ${JSON.stringify(createRes.data)}`, 500);
      }

      const instanceData = createRes.data;
      // Extract the instance token from the response
      const instanceToken = instanceData?.hash?.apikey || instanceData?.token || instanceData?.instance?.apikey || instanceData?.instanceToken || instanceData?.instance_token || '';
      const qr = instanceData?.qrcode?.base64 || instanceData?.qrcode || null;

      const { data: newInst } = await adminClient.from('admin_whatsapp_instances').insert({
        instance_name: instanceName,
        server_url: SERVER_URL,
        instance_token: instanceToken, // Save the per-instance token
        api_key: '', // Not storing create token in DB
        status: qr ? 'qr_ready' : 'created',
        qr_code: qr,
      }).select().single();

      return json({ instance: newInst, qrcode: qr });
    }

    if (action === 'connect_instance') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('No instance found', 404);

      const token = inst.instance_token || CREATE_TOKEN;
      const connectRes = await fetchWithInstanceToken(token, `/instance/connect/${inst.instance_name}`);
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
        const statusRes = await fetchWithInstanceToken(token, `/instance/connectionState/${inst.instance_name}`);
        const state = statusRes.data?.instance?.state || statusRes.data?.state || 'unknown';
        const isConnected = state === 'open';
        await adminClient.from('admin_whatsapp_instances').update({
          status: state, is_connected: isConnected, updated_at: new Date().toISOString(),
          ...(isConnected ? { last_connection_at: new Date().toISOString() } : {})
        }).eq('id', inst.id);
        return json({ instance: { ...inst, status: state, is_connected: isConnected } });
      } catch {
        return json({ instance: inst });
      }
    }

    if (action === 'disconnect_instance') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('No instance', 404);
      const token = inst.instance_token || CREATE_TOKEN;
      await fetchWithInstanceToken(token, `/instance/logout/${inst.instance_name}`, 'DELETE');
      await adminClient.from('admin_whatsapp_instances').update({ status: 'disconnected', is_connected: false, qr_code: null, updated_at: new Date().toISOString() }).eq('id', inst.id);
      return json({ ok: true });
    }

    if (action === 'send_text') {
      const { phone, message } = body;
      if (!phone || !message) return jsonErr('Missing phone or message');

      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('No instance', 404);
      if (!inst.instance_token) return jsonErr('Instance token not available. Recreate instance.', 400);

      const sendRes = await fetchWithInstanceToken(inst.instance_token, `/message/sendText/${inst.instance_name}`, 'POST', {
        number: phone,
        text: message,
      });

      return json({ ok: sendRes.ok, data: sendRes.data });
    }

    if (action === 'process_campaign') {
      const { campaignId } = body;
      if (!campaignId) return jsonErr('Missing campaignId');

      const { data: campaign } = await adminClient.from('admin_broadcast_campaigns').select('*').eq('id', campaignId).single();
      if (!campaign) return jsonErr('Campaign not found', 404);
      if (campaign.status !== 'draft' && campaign.status !== 'paused') return jsonErr('Campaign not in valid state to start');

      const inst = await getInstanceFromDb();
      if (!inst || !inst.is_connected) return jsonErr('WhatsApp not connected');
      if (!inst.instance_token) return jsonErr('Instance token not available');

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

        // Check if campaign was canceled
        const { data: currentCampaign } = await adminClient.from('admin_broadcast_campaigns').select('status').eq('id', campaignId).single();
        if (currentCampaign?.status === 'canceled' || currentCampaign?.status === 'paused') break;

        await adminClient.from('admin_broadcast_campaign_contacts').update({ status: 'sending', attempt_count: cc.attempt_count + 1, updated_at: new Date().toISOString() }).eq('id', cc.id);

        try {
          const sendRes = await fetchWithInstanceToken(inst.instance_token, `/message/sendText/${inst.instance_name}`, 'POST', {
            number: contact.normalized_phone,
            text: campaign.message,
          });

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

        // Delay between messages
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

    return jsonErr('Unknown action');
  } catch (error) {
    console.error('admin-whatsapp error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
