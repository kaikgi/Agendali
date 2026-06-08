import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  establishment_id: string;
  plan_code: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the Authorization header to identify the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's token to verify they are admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the current user
    const { data: { user: callerUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callerUser) {
      console.error('Error getting caller user:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for privileged operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if caller is admin
    const { data: isAdmin, error: adminError } = await adminClient.rpc('is_admin', {
      p_user_id: callerUser.id
    });

    if (adminError || !isAdmin) {
      console.error('Admin check failed:', adminError);
      return new Response(
        JSON.stringify({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { establishment_id, plan_code }: RequestBody = await req.json();
    
    if (!establishment_id || !plan_code) {
      return new Response(
        JSON.stringify({ error: 'establishment_id e plan_code são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate plan code
    const validPlans = ['solo', 'studio', 'pro'];
    if (!validPlans.includes(plan_code)) {
      return new Response(
        JSON.stringify({ error: 'Plano inválido. Use: solo, studio ou pro' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-set-plan] Admin ${callerUser.email} setting plan ${plan_code} for establishment ${establishment_id}`);

    // Get establishment details
    const { data: establishment, error: estError } = await adminClient
      .from('establishments')
      .select('id, name, owner_user_id')
      .eq('id', establishment_id)
      .single();

    if (estError || !establishment) {
      console.error('Error fetching establishment:', estError);
      return new Response(
        JSON.stringify({ error: 'Estabelecimento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or create subscription
    const { data: existingSubscription } = await adminClient
      .from('subscriptions')
      .select('id')
      .eq('owner_user_id', establishment.owner_user_id)
      .single();

    if (existingSubscription) {
      // Update existing subscription
      const { error: updateError } = await adminClient
        .from('subscriptions')
        .update({
          plan_code,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('owner_user_id', establishment.owner_user_id);

      if (updateError) {
        console.error('Error updating subscription:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar assinatura' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Create new subscription
      const { error: insertError } = await adminClient
        .from('subscriptions')
        .insert({
          owner_user_id: establishment.owner_user_id,
          plan_code,
          status: 'active',
          provider: 'admin',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (insertError) {
        console.error('Error inserting subscription:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar assinatura' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`[admin-set-plan] Successfully updated plan for ${establishment.name} to ${plan_code}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Plano atualizado para ${plan_code}`,
        establishment_id,
        plan_code
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in admin-set-plan:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
