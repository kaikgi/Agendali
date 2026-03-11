import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Generate a random code verifier for PKCE
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate code challenge from verifier (S256)
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state"); // establishment_id or JSON with est_id
    const action = url.searchParams.get("action"); // 'connect' or 'disconnect'

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpClientId = Deno.env.get("MP_CLIENT_ID")!;
    const mpClientSecret = Deno.env.get("MP_CLIENT_SECRET")!;
    const appUrl = Deno.env.get("APP_URL") || "https://agendali.lovable.app";

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Disconnect ──
    if (action === "disconnect" && state) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsErr } = await userClient.auth.getUser();
      if (claimsErr || !claims?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("id", state)
        .eq("owner_user_id", claims.user.id)
        .single();

      if (!est) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("payment_accounts")
        .update({ status: "disconnected" })
        .eq("establishment_id", state)
        .eq("provider", "mercadopago");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate OAuth URL (with PKCE) ──
    if (action === "connect" && state) {
      const redirectUri = `${supabaseUrl}/functions/v1/mercadopago-oauth`;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code_verifier temporarily keyed by establishment_id
      // We use a simple approach: store in payment_accounts metadata or a temp record
      // Using the state parameter to encode both establishment_id and verifier
      // We'll store the verifier server-side in a temporary record
      
      // Store verifier in DB temporarily (upsert a pending record)
      await supabase.from("payment_accounts").upsert(
        {
          establishment_id: state,
          provider: "mercadopago",
          access_token: `pkce_pending:${codeVerifier}`,
          status: "pending_oauth",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "establishment_id,provider" }
      );

      const authUrl =
        `https://auth.mercadopago.com.br/authorization?client_id=${mpClientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── OAuth Callback ──
    if (!code || !state) {
      return new Response("Missing code or state", { status: 400 });
    }

    const redirectUri = `${supabaseUrl}/functions/v1/mercadopago-oauth`;

    // Retrieve stored code_verifier
    const { data: pendingAccount } = await supabase
      .from("payment_accounts")
      .select("access_token")
      .eq("establishment_id", state)
      .eq("provider", "mercadopago")
      .single();

    let codeVerifier: string | undefined;
    if (pendingAccount?.access_token?.startsWith("pkce_pending:")) {
      codeVerifier = pendingAccount.access_token.replace("pkce_pending:", "");
    }

    // Exchange code for tokens (with code_verifier for PKCE)
    const tokenBody: Record<string, string> = {
      client_secret: mpClientSecret,
      client_id: mpClientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    };

    if (codeVerifier) {
      tokenBody.code_verifier = codeVerifier;
    }

    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tokenBody),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("MP OAuth error:", tokenData);
      return Response.redirect(
        `${appUrl}/dashboard/configuracoes?mp_error=token_exchange_failed`,
        302,
      );
    }

    // Save tokens (overwrite the pending record)
    await supabase.from("payment_accounts").upsert(
      {
        establishment_id: state,
        provider: "mercadopago",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        mp_user_id: String(tokenData.user_id || ""),
        mp_public_key: tokenData.public_key || null,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        status: "active",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "establishment_id,provider" },
    );

    // Ensure payment_settings row exists
    await supabase.from("payment_settings").upsert(
      {
        establishment_id: state,
        online_payment_enabled: false,
      },
      { onConflict: "establishment_id" },
    );

    return Response.redirect(
      `${appUrl}/dashboard/configuracoes?mp_connected=true`,
      302,
    );
  } catch (err) {
    console.error("mercadopago-oauth error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
