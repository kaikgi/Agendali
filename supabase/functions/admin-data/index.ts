import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[admin-data] No authorization header');
      return respond({ error: 'Não autorizado' }, 401);
    }

    // Verify caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[admin-data] Auth failed:', userError?.message || 'no user');
      return respond({ error: 'Não autorizado' }, 401);
    }

    // Service role client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check admin access
    const { data: adminRow } = await adminClient
      .from('admin_users')
      .select('id, level')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRow) {
      console.error('[admin-data] User not admin:', user.email);
      return respond({ error: 'Acesso negado' }, 403);
    }

    const { action, ...params } = await req.json();
    console.log(`[admin-data] Action: ${action}, Admin: ${user.email}, Level: ${adminRow.level}`);

    // ---- ACTION: stats ----
    if (action === 'stats') {
      const { count: totalEst } = await adminClient
        .from('establishments')
        .select('id', { count: 'exact', head: true });

      const { data: statusCounts } = await adminClient
        .from('establishments')
        .select('status');

      const byStatus: Record<string, number> = {};
      (statusCounts || []).forEach((e: any) => {
        byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      });

      // Count canceled separately
      const canceledCount = byStatus['canceled'] || 0;
      const pastDueCount = byStatus['past_due'] || 0;

      const { count: totalCustomers } = await adminClient
        .from('customers')
        .select('id', { count: 'exact', head: true });

      const { count: activeSubscriptions } = await adminClient
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active');

      // Recent establishments
      const { data: recent } = await adminClient
        .from('establishments')
        .select('id, name, slug, status, created_at, owner_user_id')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get owner emails
      const recentWithEmails = [];
      for (const est of (recent || [])) {
        let ownerEmail = 'N/A';
        try {
          const { data: authUser } = await adminClient.auth.admin.getUserById(est.owner_user_id);
          ownerEmail = authUser?.user?.email || 'N/A';
        } catch { /* ignore */ }
        recentWithEmails.push({ ...est, owner_email: ownerEmail });
      }

      return respond({
        total_establishments: totalEst || 0,
        total_customers: totalCustomers || 0,
        active_subscriptions: activeSubscriptions || 0,
        by_status: byStatus,
        canceled: canceledCount,
        past_due: pastDueCount,
        recent_establishments: recentWithEmails,
      });
    }

    // ---- ACTION: list_establishments ----
    if (action === 'list_establishments') {
      const search = params.search || '';
      
      let query = adminClient
        .from('establishments')
        .select('id, name, slug, status, plano, created_at, owner_user_id, booking_enabled')
        .order('created_at', { ascending: false })
        .limit(200);

      if (search) {
        query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
      }

      const { data: establishments, error: estError } = await query;
      if (estError) {
        console.error('Error listing establishments:', estError);
        return respond({ error: `Erro ao listar: ${estError.message}` }, 500);
      }

      // Enrich with owner email, subscription (full), professionals count
      const enriched = [];
      for (const est of (establishments || [])) {
        let ownerEmail = 'N/A';
        try {
          const { data: authUser } = await adminClient.auth.admin.getUserById(est.owner_user_id);
          ownerEmail = authUser?.user?.email || 'N/A';
        } catch { /* ignore */ }
        
        // Active subscription — return more fields
        const { data: subs } = await adminClient
          .from('subscriptions')
          .select('id, plan_code, plan, status, billing_cycle, current_period_start, current_period_end, provider, provider_ref, buyer_email, cancel_at_period_end')
          .eq('owner_user_id', est.owner_user_id)
          .order('created_at', { ascending: false })
          .limit(1);

        // Counts
        const [
          { count: profCount },
          { count: svcCount },
          { count: custCount },
          { count: apptCount },
        ] = await Promise.all([
          adminClient.from('professionals').select('id', { count: 'exact', head: true }).eq('establishment_id', est.id).eq('active', true),
          adminClient.from('services').select('id', { count: 'exact', head: true }).eq('establishment_id', est.id).eq('active', true),
          adminClient.from('customers').select('id', { count: 'exact', head: true }).eq('establishment_id', est.id),
          adminClient.from('appointments').select('id', { count: 'exact', head: true }).eq('establishment_id', est.id),
        ]);

        enriched.push({
          ...est,
          owner_email: ownerEmail,
          subscription: subs?.[0] || null,
          professionals_count: profCount || 0,
          services_count: svcCount || 0,
          customers_count: custCount || 0,
          appointments_count: apptCount || 0,
        });
      }

      return respond({
        establishments: enriched,
        total: enriched.length,
      });
    }

    // ---- ACTION: list_subscriptions ----
    if (action === 'list_subscriptions') {
      const { data: subs, error: subsError } = await adminClient
        .from('subscriptions')
        .select('id, plan_code, plan, status, billing_cycle, current_period_start, current_period_end, provider, provider_ref, buyer_email, cancel_at_period_end, owner_user_id, establishment_id, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (subsError) {
        console.error('Error listing subscriptions:', subsError);
        return respond({ error: `Erro ao listar: ${subsError.message}` }, 500);
      }

      // Enrich with establishment name + owner email
      const enriched = [];
      for (const sub of (subs || [])) {
        let establishmentName = '—';
        let establishmentSlug = '—';
        let ownerEmail = '—';

        if (sub.establishment_id) {
          const { data: est } = await adminClient
            .from('establishments')
            .select('name, slug')
            .eq('id', sub.establishment_id)
            .maybeSingle();
          if (est) {
            establishmentName = est.name;
            establishmentSlug = est.slug;
          }
        }

        try {
          const { data: authUser } = await adminClient.auth.admin.getUserById(sub.owner_user_id);
          ownerEmail = authUser?.user?.email || sub.buyer_email || '—';
        } catch {
          ownerEmail = sub.buyer_email || '—';
        }

        enriched.push({
          ...sub,
          establishment_name: establishmentName,
          establishment_slug: establishmentSlug,
          owner_email: ownerEmail,
        });
      }

      return respond({ subscriptions: enriched });
    }

    // ---- ACTION: update_subscription ----
    if (action === 'update_subscription') {
      // Only master admins can directly edit subscriptions
      if (adminRow.level !== 'master') {
        return respond({ error: 'Apenas admins master podem editar assinaturas diretamente' }, 403);
      }

      const { subscription_id, plan_code, status, billing_cycle } = params;
      if (!subscription_id) {
        return respond({ error: 'subscription_id obrigatório' }, 400);
      }

      const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
      if (plan_code !== undefined) {
        updateData.plan_code = plan_code;
        updateData.plan = plan_code;
      }
      if (status !== undefined) updateData.status = status;
      if (billing_cycle !== undefined) updateData.billing_cycle = billing_cycle;

      // If activating, set period
      if (status === 'active' && !params.skip_period_reset) {
        updateData.current_period_start = new Date().toISOString();
        const days = billing_cycle === 'yearly' ? 365 : billing_cycle === 'quarterly' ? 90 : 30;
        updateData.current_period_end = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error: updateError } = await adminClient
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscription_id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return respond({ error: `Erro ao atualizar: ${updateError.message}` }, 500);
      }

      // Also update establishment plano if plan_code changed
      if (plan_code) {
        const { data: sub } = await adminClient
          .from('subscriptions')
          .select('establishment_id')
          .eq('id', subscription_id)
          .maybeSingle();

        if (sub?.establishment_id) {
          const estUpdate: Record<string, any> = { plano: plan_code };
          if (status === 'active') estUpdate.status = 'active';
          await adminClient.from('establishments').update(estUpdate).eq('id', sub.establishment_id);
        }
      }

      // Audit log
      await adminClient.from('admin_audit_logs').insert({
        admin_user_id: user.id,
        action: 'update_subscription',
        metadata: { subscription_id, changes: updateData },
      });

      console.log(`[admin-data] Admin ${user.email} updated subscription ${subscription_id}:`, updateData);
      return respond({ success: true });
    }

    // ---- ACTION: update_establishment ----
    if (action === 'update_establishment') {
      const { establishment_id, status, plano, billing_cycle } = params;
      if (!establishment_id) {
        return respond({ error: 'establishment_id obrigatório' }, 400);
      }

      // 1. Get current state for comparison
      const { data: currentEst } = await adminClient
        .from('establishments')
        .select('status, plano, owner_user_id')
        .eq('id', establishment_id)
        .single();

      if (!currentEst) return respond({ error: 'Estabelecimento não encontrado' }, 404);

      const oldPlano = currentEst.plano || 'nenhum';
      const oldStatus = currentEst.status;

      // 2. Update establishment
      const updateData: Record<string, any> = {};
      if (status !== undefined) updateData.status = status;
      if (plano !== undefined) updateData.plano = plano;

      const { error: updateError } = await adminClient
        .from('establishments')
        .update(updateData)
        .eq('id', establishment_id);

      if (updateError) {
        console.error('Error updating establishment:', updateError);
        return respond({ error: `Erro ao atualizar: ${updateError.message}` }, 500);
      }

      // 3. Sync subscription whenever plano or billing_cycle changes
      const effectivePlano = plano ?? oldPlano;
      const effectiveCycle = billing_cycle || 'monthly';
      const shouldSyncSub = plano !== undefined || billing_cycle !== undefined || status === 'active';

      if (shouldSyncSub && effectivePlano && effectivePlano !== 'nenhum') {
        const { data: existingSub } = await adminClient
          .from('subscriptions')
          .select('id, plan_code, billing_cycle, status')
          .eq('establishment_id', establishment_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const oldSubPlan = existingSub?.plan_code || oldPlano;
        const oldSubCycle = existingSub?.billing_cycle || 'monthly';

        const days = effectiveCycle === 'yearly' ? 365 : effectiveCycle === 'quarterly' ? 90 : 30;
        const now = new Date().toISOString();
        const periodEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

        const subData: Record<string, any> = {
          plan_code: effectivePlano,
          plan: effectivePlano,
          billing_cycle: effectiveCycle,
          updated_at: now,
        };

        // Only reset period if activating or changing cycle
        if (status === 'active' || billing_cycle !== undefined) {
          subData.current_period_start = now;
          subData.current_period_end = periodEnd;
        }
        if (status !== undefined) {
          subData.status = status;
        }

        if (existingSub) {
          await adminClient.from('subscriptions').update(subData).eq('id', existingSub.id);
        } else {
          await adminClient.from('subscriptions').insert({
            owner_user_id: currentEst.owner_user_id,
            establishment_id: establishment_id,
            ...subData,
            status: subData.status || 'active',
            provider: 'admin',
            current_period_start: now,
            current_period_end: periodEnd,
          });
        }

        // 4. Log subscription_event if plan or cycle changed
        const planChanged = plano !== undefined && plano !== oldSubPlan;
        const cycleChanged = billing_cycle !== undefined && billing_cycle !== oldSubCycle;

        if (planChanged || cycleChanged) {
          await adminClient.from('subscription_events').insert({
            establishment_id,
            plan: effectivePlano,
            billing_cycle: effectiveCycle,
            event_type: 'subscription_updated',
            provider: 'admin',
            metadata: {
              old_plan: oldSubPlan,
              new_plan: effectivePlano,
              old_cycle: oldSubCycle,
              new_cycle: effectiveCycle,
              updated_by: user.email,
            },
          });
        }
      }

      // 5. Audit log
      await adminClient.from('admin_audit_logs').insert({
        admin_user_id: user.id,
        action: 'update_establishment',
        target_establishment_id: establishment_id,
        metadata: { changes: updateData, billing_cycle },
      });

      console.log(`[admin-data] Admin ${user.email} updated establishment ${establishment_id}:`, updateData);

      return respond({ success: true });
    }

    // ---- ACTION: list_subscription_events ----
    if (action === 'list_subscription_events') {
      const { establishment_id } = params;
      if (!establishment_id) {
        return respond({ error: 'establishment_id obrigatório' }, 400);
      }

      const { data: events, error: evError } = await adminClient
        .from('subscription_events')
        .select('*')
        .eq('establishment_id', establishment_id)
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (evError) {
        return respond({ error: `Erro ao listar eventos: ${evError.message}` }, 500);
      }

      return respond({ events: events || [] });
    }

    return respond({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (error) {
    console.error('Error in admin-data:', error);
    return respond({ error: error.message || 'Erro interno' }, 500);
  }
});
