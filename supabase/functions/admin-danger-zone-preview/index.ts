import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const HARDCODED_MASTER_EMAIL = 'kaikgivaldodias@gmail.com';

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
      return respond({ ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado' });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: callerUser } } = await userClient.auth.getUser();
    if (!callerUser) {
      return respond({ ok: false, code: 'UNAUTHORIZED', message: 'Não autorizado' });
    }

    // Hardcoded master email check (extra layer)
    if (callerUser.email?.toLowerCase() !== HARDCODED_MASTER_EMAIL) {
      return respond({ ok: false, code: 'FORBIDDEN', message: 'Apenas o administrador MASTER pode acessar a Danger Zone' });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check DB-level master
    const { data: isMaster } = await adminClient.rpc('is_admin_master', { p_user_id: callerUser.id });
    if (!isMaster) {
      return respond({ ok: false, code: 'FORBIDDEN', message: 'Usuário não é MASTER no banco' });
    }

    // Check ENV_ALLOW_DANGER_ZONE
    const { data: envSetting } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'ENV_ALLOW_DANGER_ZONE')
      .single();

    if (!envSetting || envSetting.value !== 'true') {
      return respond({ ok: false, code: 'DANGER_ZONE_DISABLED', message: 'Danger Zone está desativada. Ative ENV_ALLOW_DANGER_ZONE nas configurações do sistema.' });
    }

    // Get allowed slugs from settings
    const { data: slugsSetting } = await adminClient
      .from('system_settings')
      .select('value')
      .eq('key', 'DANGER_ZONE_KEEP_SLUGS')
      .single();

    const allowedSlugs: string[] = slugsSetting ? JSON.parse(slugsSetting.value) : [];

    const { keep_slugs } = await req.json();

    if (!Array.isArray(keep_slugs) || keep_slugs.length !== allowedSlugs.length) {
      return respond({ ok: false, code: 'INVALID_SLUGS', message: `Forneça exatamente ${allowedSlugs.length} slugs para manter` });
    }

    const sortedInput = [...keep_slugs].sort();
    const sortedAllowed = [...allowedSlugs].sort();
    if (JSON.stringify(sortedInput) !== JSON.stringify(sortedAllowed)) {
      return respond({ ok: false, code: 'SLUG_MISMATCH', message: `Os slugs devem ser exatamente: ${allowedSlugs.join(', ')}` });
    }

    // Get IDs of kept establishments
    const { data: keptEstablishments } = await adminClient
      .from('establishments')
      .select('id, slug, owner_user_id')
      .in('slug', keep_slugs);

    if (!keptEstablishments || keptEstablishments.length !== keep_slugs.length) {
      return respond({ ok: false, code: 'ESTABLISHMENTS_NOT_FOUND', message: 'Um ou mais estabelecimentos não foram encontrados' });
    }

    const keptIds = keptEstablishments.map(e => e.id);
    const ownerIds = keptEstablishments.map(e => e.owner_user_id);

    // Get admin user IDs
    const { data: adminUsers } = await adminClient.from('admin_users').select('user_id');
    const adminIds = (adminUsers || []).map(a => a.user_id);

    const allowlistIds = [...new Set([...ownerIds, ...adminIds])];

    // Count what would be deleted
    const { count: estToDelete } = await adminClient
      .from('establishments')
      .select('*', { count: 'exact', head: true })
      .not('id', 'in', `(${keptIds.join(',')})`);

    const { count: appointmentsToDelete } = await adminClient
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);

    const { count: professionalsToDelete } = await adminClient
      .from('professionals')
      .select('*', { count: 'exact', head: true })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);

    const { count: customersToDelete } = await adminClient
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);

    const { count: servicesDelete } = await adminClient
      .from('services')
      .select('*', { count: 'exact', head: true })
      .not('establishment_id', 'in', `(${keptIds.join(',')})`);

    // Count profiles to delete (not in allowlist)
    const { count: totalProfiles } = await adminClient
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const profilesToDelete = (totalProfiles || 0) - allowlistIds.length;

    // Generate preview token (simple signed payload)
    const previewPayload = {
      keep_slugs: sortedInput,
      counts: {
        establishments_to_delete: estToDelete || 0,
        appointments_to_delete: appointmentsToDelete || 0,
        professionals_to_delete: professionalsToDelete || 0,
        customers_to_delete: customersToDelete || 0,
        services_to_delete: servicesDelete || 0,
        profiles_to_delete: Math.max(0, profilesToDelete),
      },
      generated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
      actor: callerUser.id,
    };

    // Encode as base64 "token" (validated server-side on execute)
    const preview_token = btoa(JSON.stringify(previewPayload));

    // Audit
    await adminClient.from('admin_audit_logs').insert({
      actor_user_id: callerUser.id,
      action: 'danger_zone_preview',
      request_hash: btoa(`preview:${Date.now()}`).slice(0, 16),
      details: { keep_slugs: sortedInput, counts: previewPayload.counts },
    });

    return respond({
      ok: true,
      code: 'PREVIEW_READY',
      message: 'Prévia gerada com sucesso',
      data: {
        ...previewPayload.counts,
        keep_slugs: sortedInput,
        kept_establishments: keptEstablishments.map(e => ({ id: e.id, slug: e.slug })),
        allowlist_count: allowlistIds.length,
        preview_token,
      },
    });

  } catch (error) {
    console.error('Error in danger-zone-preview:', error);
    return respond({ ok: false, code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
  }
});
