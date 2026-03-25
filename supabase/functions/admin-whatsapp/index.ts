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

    // Check admin
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: adminUser } = await adminClient.from('admin_users').select('id').eq('user_id', claims.claims.sub).eq('status', 'ativo').maybeSingle();
    if (!adminUser) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });
    }

    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')!;
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY')!;
    const body = await req.json();
    const { action } = body;

    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, '');

    // Helper for Evolution API calls
    const evoFetch = async (path: string, method = 'GET', payload?: any, useAdminToken = true) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useAdminToken) {
        headers['apikey'] = EVOLUTION_API_KEY;
      } else if (body.instanceToken) {
        headers['apikey'] = body.instanceToken;
      }
      const opts: RequestInit = { method, headers };
      if (payload) opts.body = JSON.stringify(payload);
      const res = await fetch(`${baseUrl}${path}`, opts);
      const text = await res.text();
      try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; } catch { return { ok: res.ok, status: res.status, data: text }; }
    };

    // ---- ACTIONS ----

    if (action === 'check_or_create_instance') {
      // Check if we already have an instance saved
      const { data: existing } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();

      if (existing) {
        // Check status on the server
        try {
          const statusRes = await evoFetch(`/instance/connectionState/${existing.instance_name}`);
          const state = statusRes.data?.instance?.state || statusRes.data?.state || 'unknown';
          const isConnected = state === 'open';
          await adminClient.from('admin_whatsapp_instances').update({
            status: state, is_connected: isConnected, updated_at: new Date().toISOString(),
            ...(isConnected ? { last_connection_at: new Date().toISOString() } : {})
          }).eq('id', existing.id);
          return new Response(JSON.stringify({ instance: { ...existing, status: state, is_connected: isConnected } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } catch {
          return new Response(JSON.stringify({ instance: existing }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      // Create new instance
      const instanceName = `agendali-admin-${Date.now()}`;
      const createRes = await evoFetch('/instance/create', 'POST', {
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      });

      if (!createRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to create instance', details: createRes.data }), { status: 500, headers: corsHeaders });
      }

      const instanceData = createRes.data;
      const token = instanceData?.hash?.apikey || instanceData?.token || instanceData?.instance?.apikey || '';
      const qr = instanceData?.qrcode?.base64 || instanceData?.qrcode || null;

      const { data: newInst } = await adminClient.from('admin_whatsapp_instances').insert({
        instance_name: instanceName,
        server_url: baseUrl,
        instance_token: token,
        api_key: EVOLUTION_API_KEY,
        status: qr ? 'qr_ready' : 'created',
        qr_code: qr,
      }).select().single();

      return new Response(JSON.stringify({ instance: newInst, qrcode: qr }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'connect_instance') {
      const { data: inst } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inst) return new Response(JSON.stringify({ error: 'No instance found' }), { status: 404, headers: corsHeaders });

      const connectRes = await evoFetch(`/instance/connect/${inst.instance_name}`);
      const qr = connectRes.data?.base64 || connectRes.data?.qrcode?.base64 || connectRes.data?.qrcode || null;

      await adminClient.from('admin_whatsapp_instances').update({
        status: qr ? 'qr_ready' : 'connecting', qr_code: qr, updated_at: new Date().toISOString()
      }).eq('id', inst.id);

      return new Response(JSON.stringify({ qrcode: qr, instance: { ...inst, qr_code: qr } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_status') {
      const { data: inst } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inst) return new Response(JSON.stringify({ instance: null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      try {
        const statusRes = await evoFetch(`/instance/connectionState/${inst.instance_name}`);
        const state = statusRes.data?.instance?.state || statusRes.data?.state || 'unknown';
        const isConnected = state === 'open';
        await adminClient.from('admin_whatsapp_instances').update({
          status: state, is_connected: isConnected, updated_at: new Date().toISOString(),
          ...(isConnected ? { last_connection_at: new Date().toISOString() } : {})
        }).eq('id', inst.id);
        return new Response(JSON.stringify({ instance: { ...inst, status: state, is_connected: isConnected } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch {
        return new Response(JSON.stringify({ instance: inst }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (action === 'disconnect_instance') {
      const { data: inst } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inst) return new Response(JSON.stringify({ error: 'No instance' }), { status: 404, headers: corsHeaders });
      await evoFetch(`/instance/logout/${inst.instance_name}`, 'DELETE');
      await adminClient.from('admin_whatsapp_instances').update({ status: 'disconnected', is_connected: false, qr_code: null, updated_at: new Date().toISOString() }).eq('id', inst.id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'send_text') {
      const { phone, message, instanceName, instanceToken } = body;
      if (!phone || !message) return new Response(JSON.stringify({ error: 'Missing phone or message' }), { status: 400, headers: corsHeaders });

      const { data: inst } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inst) return new Response(JSON.stringify({ error: 'No instance' }), { status: 404, headers: corsHeaders });

      const sendRes = await evoFetch(`/message/sendText/${inst.instance_name}`, 'POST', {
        number: phone,
        text: message,
      });

      return new Response(JSON.stringify({ ok: sendRes.ok, data: sendRes.data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'process_campaign') {
      const { campaignId } = body;
      if (!campaignId) return new Response(JSON.stringify({ error: 'Missing campaignId' }), { status: 400, headers: corsHeaders });

      // Get campaign
      const { data: campaign } = await adminClient.from('admin_broadcast_campaigns').select('*').eq('id', campaignId).single();
      if (!campaign) return new Response(JSON.stringify({ error: 'Campaign not found' }), { status: 404, headers: corsHeaders });
      if (campaign.status !== 'draft' && campaign.status !== 'paused') {
        return new Response(JSON.stringify({ error: 'Campaign not in valid state to start' }), { status: 400, headers: corsHeaders });
      }

      // Get instance
      const { data: inst } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!inst || !inst.is_connected) return new Response(JSON.stringify({ error: 'WhatsApp not connected' }), { status: 400, headers: corsHeaders });

      // Mark campaign as running
      await adminClient.from('admin_broadcast_campaigns').update({
        status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', campaignId);

      // Get pending contacts
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
        return new Response(JSON.stringify({ ok: true, message: 'No contacts to process' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

        // Mark as sending
        await adminClient.from('admin_broadcast_campaign_contacts').update({ status: 'sending', attempt_count: cc.attempt_count + 1, updated_at: new Date().toISOString() }).eq('id', cc.id);

        try {
          const sendRes = await evoFetch(`/message/sendText/${inst.instance_name}`, 'POST', {
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

        // Update campaign counters
        await adminClient.from('admin_broadcast_campaigns').update({
          total_sent: totalSent, total_failed: totalFailed, updated_at: new Date().toISOString()
        }).eq('id', campaignId);

        // Delay between messages (skip delay for last message)
        if (i < campaignContacts.length - 1 && campaign.delay_seconds > 0) {
          await new Promise(resolve => setTimeout(resolve, campaign.delay_seconds * 1000));
        }
      }

      // Mark as completed
      const { data: finalCampaign } = await adminClient.from('admin_broadcast_campaigns').select('status').eq('id', campaignId).single();
      if (finalCampaign?.status === 'running') {
        await adminClient.from('admin_broadcast_campaigns').update({
          status: 'completed', finished_at: new Date().toISOString(), total_sent: totalSent, total_failed: totalFailed, updated_at: new Date().toISOString()
        }).eq('id', campaignId);
      }

      return new Response(JSON.stringify({ ok: true, totalSent, totalFailed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('admin-whatsapp error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
