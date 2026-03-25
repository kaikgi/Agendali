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

    const SERVER_URL = (Deno.env.get('WHATSAPI_SERVER_URL') || '').replace(/\/+$/, '');
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
      const { data: active } = await adminClient.from('admin_whatsapp_instances').select('*').eq('is_active', true).limit(1).maybeSingle();
      if (active) return active;
      const { data } = await adminClient.from('admin_whatsapp_instances').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    };

    // Robust status check that works with uazapi.com via /instance/fetchInstances
    const checkInstanceStatus = async (inst: any): Promise<{ state: string; isConnected: boolean; phone: string | null; error: string | null }> => {
      const base = String(inst.server_url).replace(/\/+$/, '');
      const token = inst.instance_token || CREATE_TOKEN;
      const result = { state: 'unknown', isConnected: false, phone: inst.connected_phone || null, error: null as string | null };

      // Try /instance/fetchInstances (uazapi / Evolution v2)
      try {
        const url = `${base}/instance/fetchInstances`;
        console.log(`[checkStatus] GET ${url}`);
        const res = await fetch(url, {
          method: 'GET',
          headers: { apikey: token, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const text = await res.text();
        console.log(`[checkStatus] Response: ${res.status} ${text.substring(0, 800)}`);

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            result.state = 'invalid_token';
            result.error = `Token inválido ou sem permissão (${res.status})`;
            return result;
          }
          result.state = 'api_error';
          result.error = `API retornou ${res.status}`;
          return result;
        }

        let data: any;
        try { data = JSON.parse(text); } catch { data = null; }

        // Parse instances list — could be array or { instances: [...] } or { data: [...] }
        const instances = Array.isArray(data) ? data : (data?.instances || data?.data || []);
        const found = instances.find((i: any) =>
          i.name === inst.instance_name || i.instanceName === inst.instance_name || i.instance?.instanceName === inst.instance_name
        );

        if (!found) {
          result.state = 'instance_not_found';
          result.error = `Instância "${inst.instance_name}" não encontrada na API. ${instances.length} instância(s) disponíveis.`;
          return result;
        }

        // Normalize connection status from different response shapes
        const connStatus = found.connectionStatus || found.instance?.state || found.state || found.status || 'unknown';
        const normalized = String(connStatus).toLowerCase();

        if (normalized === 'open' || normalized === 'connected') {
          result.state = 'connected';
          result.isConnected = true;
        } else if (normalized === 'connecting' || normalized === 'qr') {
          result.state = 'connecting';
        } else if (normalized === 'close' || normalized === 'disconnected' || normalized === 'closed') {
          result.state = 'disconnected';
        } else {
          result.state = normalized || 'unknown';
        }

        // Extract phone if available
        const ownerJid = found.ownerJid || found.owner || found.instance?.owner || null;
        if (ownerJid) {
          result.phone = String(ownerJid).split('@')[0] || result.phone;
        }

        return result;
      } catch (fetchErr) {
        result.state = 'communication_error';
        result.error = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.error(`[checkStatus] Fetch error:`, result.error);
        return result;
      }
    };

    // ========== ACTIONS ==========

    if (action === 'check_or_create_instance') {
      const existing = await getInstanceFromDb();
      if (existing) {
        console.log('Instance already exists in DB:', existing.instance_name);
        try {
          const statusResult = await checkInstanceStatus(existing);
          const now = new Date().toISOString();
          await adminClient.from('admin_whatsapp_instances').update({
            status: statusResult.state, is_connected: statusResult.isConnected,
            updated_at: now, last_validated_at: now,
            ...(statusResult.phone ? { connected_phone: statusResult.phone } : {}),
            ...(statusResult.isConnected ? { last_connection_at: now } : {}),
          }).eq('id', existing.id);
          return json({ instance: { ...existing, status: statusResult.state, is_connected: statusResult.isConnected }, exists: true });
        } catch (e) {
          console.error('Status sync failed:', e);
          return json({ instance: existing, exists: true });
        }
      }

      // Create new instance
      const instanceName = `agendali-${Date.now()}`;
      const deviceName = 'Agendali Broadcast';
      const createUrl = `${SERVER_URL}/functions/v1/create-instance-url`;

      console.log('Creating new instance:', createUrl);
      const createResp = await fetch(createUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: CREATE_TOKEN, name: instanceName, deviceName }),
      });
      const createText = await createResp.text();
      console.log(`Create response: status=${createResp.status}, body=${createText.substring(0, 1000)}`);

      let rd: any = {};
      try { rd = JSON.parse(createText); } catch { rd = { raw: createText }; }

      if (!createResp.ok) {
        const errMsg = rd?.error || rd?.message || createText;
        let userMsg = `Falha ao criar instância (${createResp.status}): ${errMsg}`;
        return jsonErr(userMsg, createResp.status >= 400 && createResp.status < 500 ? createResp.status : 500);
      }

      const instanceToken = rd['Instance Token'] || rd?.instance_token || rd?.token || '';
      const serverUrlFromResponse = rd?.server_url || SERVER_URL;
      const instName = rd?.instance?.name || instanceName;

      const { data: newInst, error: insertErr } = await adminClient.from('admin_whatsapp_instances').insert({
        instance_name: instName, server_url: serverUrlFromResponse,
        instance_token: instanceToken, token: rd?.token || '',
        device_name: rd?.instance?.device_name || deviceName,
        webhook: rd?.webhook || '', api_key: '',
        status: 'created', is_connected: false,
      }).select().single();

      if (insertErr) return jsonErr(`Instância criada mas falhou ao salvar: ${insertErr.message}`, 500);
      return json({ instance: newInst, created: true });
    }

    if (action === 'connect_instance') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância encontrada', 404);
      const token = inst.instance_token || CREATE_TOKEN;
      const base = String(inst.server_url).replace(/\/+$/, '');
      const connectRes = await fetch(`${base}/instance/connect/${inst.instance_name}`, {
        method: 'GET', headers: { apikey: token, 'Content-Type': 'application/json' },
      });
      const connectText = await connectRes.text();
      let connectData: any;
      try { connectData = JSON.parse(connectText); } catch { connectData = { raw: connectText }; }
      const qr = connectData?.base64 || connectData?.qrcode?.base64 || connectData?.qrcode || null;
      await adminClient.from('admin_whatsapp_instances').update({
        status: qr ? 'qr_ready' : 'connecting', qr_code: qr, updated_at: new Date().toISOString()
      }).eq('id', inst.id);
      return json({ qrcode: qr, instance: { ...inst, qr_code: qr } });
    }

    if (action === 'get_status') {
      const inst = await getInstanceFromDb();
      if (!inst) return json({ instance: null });

      const statusResult = await checkInstanceStatus(inst);
      const now = new Date().toISOString();
      await adminClient.from('admin_whatsapp_instances').update({
        status: statusResult.state, is_connected: statusResult.isConnected,
        updated_at: now, last_validated_at: now,
        ...(statusResult.phone ? { connected_phone: statusResult.phone } : {}),
        ...(statusResult.isConnected ? { last_connection_at: now } : {}),
      }).eq('id', inst.id);
      return json({
        instance: { ...inst, status: statusResult.state, is_connected: statusResult.isConnected, last_validated_at: now, connected_phone: statusResult.phone || inst.connected_phone },
        validation_error: statusResult.error,
      });
    }

    if (action === 'disconnect_instance') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância encontrada', 404);
      const token = inst.instance_token || CREATE_TOKEN;
      const base = String(inst.server_url).replace(/\/+$/, '');
      try {
        await fetch(`${base}/instance/logout/${inst.instance_name}`, {
          method: 'DELETE', headers: { apikey: token, 'Content-Type': 'application/json' },
        });
      } catch (e) { console.error('Logout API error (non-blocking):', e); }
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
      const base = String(inst.server_url).replace(/\/+$/, '');
      const sendRes = await fetch(`${base}/message/sendText/${inst.instance_name}`, {
        method: 'POST',
        headers: { apikey: inst.instance_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text: message }),
      });
      const sendText = await sendRes.text();
      let sendData: any;
      try { sendData = JSON.parse(sendText); } catch { sendData = { raw: sendText }; }
      return json({ ok: sendRes.ok, data: sendData });
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

      const base = String(inst.server_url).replace(/\/+$/, '');
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
          const sendRes = await fetch(`${base}/message/sendText/${inst.instance_name}`, {
            method: 'POST',
            headers: { apikey: inst.instance_token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: contact.normalized_phone, text: campaign.message }),
          });
          const sendText = await sendRes.text();
          let sendData: any;
          try { sendData = JSON.parse(sendText); } catch { sendData = { raw: sendText }; }

          if (sendRes.ok) {
            const msgId = sendData?.key?.id || sendData?.messageId || null;
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
            const errMsg = typeof sendData === 'string' ? sendData : JSON.stringify(sendData);
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
        instance_token: newToken.trim(), updated_at: new Date().toISOString(),
      }).eq('id', inst.id);
      if (updErr) return jsonErr(`Erro ao atualizar token: ${updErr.message}`, 500);
      await adminClient.from('admin_audit_logs').insert({
        admin_user_id: adminUser.id, action: 'whatsapp_token_updated',
        metadata: { instance_id: inst.id, instance_name: inst.instance_name },
      }).catch(e => console.error('Audit log failed:', e));
      return json({ ok: true, instance_name: inst.instance_name });
    }

    // ===== CONNECT EXISTING INSTANCE =====
    if (action === 'connect_existing_instance') {
      const { instance_name, instance_token, server_url, device_name, connected_phone, notes } = body;
      if (!instance_name || !instance_token || !server_url) {
        return jsonErr('Campos obrigatórios: instance_name, instance_token, server_url');
      }
      console.log(`[connect_existing] Validating instance: ${instance_name} at ${server_url}`);

      // Validate using the robust checkInstanceStatus
      const tempInst = { instance_name, instance_token, server_url, connected_phone };
      const statusResult = await checkInstanceStatus(tempInst);

      // Only block on auth errors
      if (statusResult.state === 'invalid_token') {
        return jsonErr(statusResult.error || 'Token inválido ou sem permissão', 401);
      }

      const now = new Date().toISOString();

      // Deactivate all other instances
      await adminClient.from('admin_whatsapp_instances').update({ is_active: false, updated_at: now }).neq('is_active', false);

      // Upsert by instance_name
      const { data: existingByName } = await adminClient.from('admin_whatsapp_instances')
        .select('id').eq('instance_name', instance_name).maybeSingle();

      const upsertData: any = {
        instance_name, instance_token, server_url: server_url.replace(/\/+$/, ''),
        device_name: device_name || null, connected_phone: statusResult.phone || connected_phone || null,
        notes: notes || null, provider: 'whatsapi',
        status: statusResult.state, is_connected: statusResult.isConnected, is_active: true,
        connected_at: statusResult.isConnected ? now : null,
        last_validated_at: now, updated_at: now,
      };

      let savedInst: any;
      if (existingByName) {
        const { data, error } = await adminClient.from('admin_whatsapp_instances')
          .update(upsertData).eq('id', existingByName.id).select().single();
        if (error) return jsonErr(`Erro ao atualizar instância: ${error.message}`, 500);
        savedInst = data;
      } else {
        const { data, error } = await adminClient.from('admin_whatsapp_instances')
          .insert(upsertData).select().single();
        if (error) return jsonErr(`Erro ao salvar instância: ${error.message}`, 500);
        savedInst = data;
      }

      await adminClient.from('admin_audit_logs').insert({
        admin_user_id: adminUser.id, action: 'whatsapp_instance_connected_manually',
        metadata: { instance_id: savedInst.id, instance_name, state: statusResult.state, is_connected: statusResult.isConnected },
      }).catch(e => console.error('Audit log failed:', e));

      console.log(`[connect_existing] Instance saved: id=${savedInst.id}, state=${statusResult.state}, connected=${statusResult.isConnected}`);
      return json({ ok: true, instance: savedInst, validation: { state: statusResult.state, is_connected: statusResult.isConnected, validation_error: statusResult.error } });
    }

    // ===== TEST CONNECTION =====
    if (action === 'test_connection') {
      const inst = await getInstanceFromDb();
      if (!inst) return jsonErr('Nenhuma instância ativa encontrada', 404);
      if (!inst.instance_token || !inst.server_url) return jsonErr('Instância sem token ou server_url configurado', 400);

      console.log(`[test_connection] Testing ${inst.instance_name} at ${inst.server_url}`);
      const statusResult = await checkInstanceStatus(inst);
      const now = new Date().toISOString();

      await adminClient.from('admin_whatsapp_instances').update({
        status: statusResult.state, is_connected: statusResult.isConnected,
        last_validated_at: now, updated_at: now,
        ...(statusResult.phone ? { connected_phone: statusResult.phone } : {}),
        ...(statusResult.isConnected ? { last_connection_at: now } : {}),
      }).eq('id', inst.id);

      if (statusResult.error) {
        return json({ ok: false, status: statusResult.state, state: statusResult.state, message: statusResult.error });
      }

      return json({
        ok: statusResult.isConnected, status: statusResult.isConnected ? 'connected' : statusResult.state,
        state: statusResult.state,
        instance: { ...inst, status: statusResult.state, is_connected: statusResult.isConnected, last_validated_at: now },
      });
    }

    return jsonErr('Unknown action');
  } catch (error) {
    console.error('admin-whatsapp error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
