import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HARDCODED_MASTER_EMAIL = 'kaikgivaldodias@gmail.com';
const CONFIRM_PHRASE = 'DELETE ALL EXCEPT TWO';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  let adminClient: ReturnType<typeof createClient> | null = null;
  let lockAcquired = false;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return respond({ ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado' });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: callerUser } } = await userClient.auth.getUser();
    if (!callerUser) {
      return respond({ ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado' });
    }

    // Hardcoded master check
    if (callerUser.email?.toLowerCase() !== HARDCODED_MASTER_EMAIL) {
      return respond({ ok: false, code: 'FORBIDDEN', message: 'Apenas o administrador MASTER pode executar a Danger Zone' });
    }

    adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // DB-level master check
    const { data: isMaster } = await adminClient.rpc('is_admin_master', { p_user_id: callerUser.id });
    if (!isMaster) {
      return respond({ ok: false, code: 'FORBIDDEN', message: 'Usuário não é MASTER' });
    }

    // Check ENV flag
    const { data: envSetting } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'ENV_ALLOW_DANGER_ZONE')
      .single();

    if (!envSetting || envSetting.value !== 'true') {
      return respond({ ok: false, code: 'DANGER_ZONE_DISABLED', message: 'Danger Zone desativada' });
    }

    // Parse input
    const { keep_slugs, confirm_phrase, typed_slugs, preview_token } = await req.json();

    // Validate confirm phrase
    if (confirm_phrase !== CONFIRM_PHRASE) {
      return respond({ ok: false, code: 'INVALID_PHRASE', message: `Frase de confirmação incorreta. Digite: "${CONFIRM_PHRASE}"` });
    }

    // Validate typed slugs
    const { data: slugsSetting } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'DANGER_ZONE_KEEP_SLUGS')
      .single();

    const allowedSlugs: string[] = slugsSetting ? JSON.parse(slugsSetting.value) : [];
    const sortedTyped = typed_slugs?.split(',').map((s: string) => s.trim().toLowerCase()).sort() || [];
    const sortedAllowed = [...allowedSlugs].sort();

    if (JSON.stringify(sortedTyped) !== JSON.stringify(sortedAllowed)) {
      return respond({ ok: false, code: 'SLUG_MISMATCH', message: `Digite exatamente: ${allowedSlugs.join(',')}` });
    }

    // Validate preview token
    if (!preview_token) {
      return respond({ ok: false, code: 'NO_PREVIEW', message: 'Execute a prévia primeiro' });
    }

    let previewPayload;
    try {
      previewPayload = JSON.parse(atob(preview_token));
    } catch {
      return respond({ ok: false, code: 'INVALID_TOKEN', message: 'Token de prévia inválido' });
    }

    if (new Date(previewPayload.expires_at) < new Date()) {
      return respond({ ok: false, code: 'TOKEN_EXPIRED', message: 'Token de prévia expirado. Gere uma nova prévia.' });
    }

    if (JSON.stringify([...previewPayload.keep_slugs].sort()) !== JSON.stringify(sortedAllowed)) {
      return respond({ ok: false, code: 'TOKEN_MISMATCH', message: 'Token não corresponde aos slugs' });
    }

    // Acquire lock
    const { error: lockError } = await adminClient
      .from('admin_locks')
      .insert({ key: 'danger_zone', locked_by: callerUser.id, locked_at: new Date().toISOString() });

    if (lockError) {
      // Check if it's a conflict (already locked)
      if (lockError.code === '23505') {
        return respond({ ok: false, code: 'LOCKED_TRY_LATER', message: 'Operação já em andamento. Tente novamente em alguns minutos.' });
      }
      throw lockError;
    }
    lockAcquired = true;

    console.log(`[danger-zone] EXECUTING by ${callerUser.email}. Keeping: ${allowedSlugs.join(', ')}`);

    // Resolve kept establishment IDs
    const { data: keptEstablishments } = await adminClient
      .from('establishments')
      .select('id, slug, owner_user_id')
      .in('slug', allowedSlugs);

    if (!keptEstablishments || keptEstablishments.length !== allowedSlugs.length) {
      return respond({ ok: false, code: 'ESTABLISHMENTS_NOT_FOUND', message: 'Estabelecimentos não encontrados' });
    }

    const keptIds = keptEstablishments.map(e => e.id);
    const ownerIds = keptEstablishments.map(e => e.owner_user_id);

    // Build allowlist: owners + all admins
    const { data: adminUsers } = await adminClient.from('admin_users').select('user_id');
    const adminIds = (adminUsers || []).map(a => a.user_id);
    const allowlistIds = [...new Set([...ownerIds, ...adminIds])];

    const deletedCounts: Record<string, number> = {};

    // Delete in FK-safe order
    // 1. Ratings for appointments outside kept establishments
    const { count: ratingsDeleted } = await adminClient
      .from('ratings')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.ratings = ratingsDeleted || 0;

    // 2. Appointment events
    const { data: aptsToDelete } = await adminClient
      .from('appointments')
      .select('id')
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    const aptIds = (aptsToDelete || []).map(a => a.id);

    if (aptIds.length > 0) {
      // Process in batches
      for (let i = 0; i < aptIds.length; i += 100) {
        const batch = aptIds.slice(i, i + 100);
        await adminClient.from('appointment_events').delete().in('appointment_id', batch);
        await adminClient.from('appointment_manage_tokens').delete().in('appointment_id', batch);
        await adminClient.from('appointment_completion_prompts').delete().in('appointment_id', batch);
      }
    }

    // 3. Appointments
    const { count: appointmentsDeleted } = await adminClient
      .from('appointments')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.appointments = appointmentsDeleted || 0;

    // 4. Time blocks
    const { count: timeBlocksDeleted } = await adminClient
      .from('time_blocks')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.time_blocks = timeBlocksDeleted || 0;

    // 5. Recurring time blocks
    const { count: recurringDeleted } = await adminClient
      .from('recurring_time_blocks')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.recurring_time_blocks = recurringDeleted || 0;

    // 6. Professional services, professional hours, professional portal sessions
    const { data: profsToDelete } = await adminClient
      .from('professionals')
      .select('id')
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    const profIds = (profsToDelete || []).map(p => p.id);

    if (profIds.length > 0) {
      for (let i = 0; i < profIds.length; i += 100) {
        const batch = profIds.slice(i, i + 100);
        await adminClient.from('professional_services').delete().in('professional_id', batch);
        await adminClient.from('professional_hours').delete().in('professional_id', batch);
        await adminClient.from('professional_portal_sessions').delete().in('professional_id', batch);
      }
    }

    // 7. Professionals
    const { count: professionalsDeleted } = await adminClient
      .from('professionals')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.professionals = professionalsDeleted || 0;

    // 8. Customers
    const { count: customersDeleted } = await adminClient
      .from('customers')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.customers = customersDeleted || 0;

    // 9. Services
    const { count: servicesDeleted } = await adminClient
      .from('services')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.services = servicesDeleted || 0;

    // 10. Business hours
    const { count: bhDeleted } = await adminClient
      .from('business_hours')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.business_hours = bhDeleted || 0;

    // 11. Establishment monthly usage
    const { count: usageDeleted } = await adminClient
      .from('establishment_monthly_usage')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.monthly_usage = usageDeleted || 0;

    // 12. Establishment members
    const { count: membersDeleted } = await adminClient
      .from('establishment_members')
      .delete({ count: 'exact' })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.establishment_members = membersDeleted || 0;

    // 13. Subscriptions for owners outside allowlist
    const { count: subsDeleted } = await adminClient
      .from('subscriptions')
      .delete({ count: 'exact' })
      .not('owner_user_id', 'in', `(${allowlistIds.join(',')})`);
    deletedCounts.subscriptions = subsDeleted || 0;

    // 14. Establishments
    const { count: estDeleted } = await adminClient
      .from('establishments')
      .delete({ count: 'exact' })
      .not('id', 'in', `(${keptIds.join(',')})`);
    deletedCounts.establishments = estDeleted || 0;

    // 15. Profiles outside allowlist
    const { count: profilesDeleted } = await adminClient
      .from('profiles')
      .delete({ count: 'exact' })
      .not('id', 'in', `(${allowlistIds.join(',')})`);
    deletedCounts.profiles = profilesDeleted || 0;

    // 16. Delete auth.users outside allowlist
    let usersDeleted = 0;
    const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (allUsers) {
      for (const u of allUsers) {
        if (!allowlistIds.includes(u.id)) {
          const { error: delErr } = await adminClient.auth.admin.deleteUser(u.id);
          if (!delErr) usersDeleted++;
          else console.error(`Failed to delete auth user ${u.id}:`, delErr.message);
        }
      }
    }
    deletedCounts.auth_users = usersDeleted;

    // Audit log
    await adminClient.from('admin_audit_logs').insert({
      actor_user_id: callerUser.id,
      action: 'danger_zone_execute',
      request_hash: btoa(`execute:${Date.now()}`).slice(0, 16),
      details: { keep_slugs: allowedSlugs, deleted_counts: deletedCounts, allowlist_count: allowlistIds.length },
    });

    console.log(`[danger-zone] COMPLETED. Deleted counts:`, JSON.stringify(deletedCounts));

    return respond({
      ok: true,
      code: 'EXECUTED',
      message: 'Danger Zone executada com sucesso',
      data: { deleted_counts: deletedCounts, kept_slugs: allowedSlugs },
    });

  } catch (error) {
    console.error('[danger-zone] FATAL ERROR:', error);

    // Log failure
    if (adminClient) {
      try {
        await adminClient.from('admin_audit_logs').insert({
          actor_user_id: null,
          action: 'danger_zone_error',
          request_hash: btoa(`error:${Date.now()}`).slice(0, 16),
          details: { error: String(error) },
        });
      } catch { /* best effort */ }
    }

    return respond({ ok: false, code: 'INTERNAL_ERROR', message: 'Erro fatal na execução. Verifique os logs de auditoria.' });

  } finally {
    // Always release lock
    if (lockAcquired && adminClient) {
      try {
        await adminClient.from('admin_locks').delete().eq('key', 'danger_zone');
      } catch (e) {
        console.error('[danger-zone] Failed to release lock:', e);
      }
    }
  }
});
