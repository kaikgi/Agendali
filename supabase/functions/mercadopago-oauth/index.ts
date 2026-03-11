import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

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
    const state = url.searchParams.get("state");
    const action = url.searchParams.get("action");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const mpClientId = Deno.env.get("MP_CLIENT_ID");
    const mpClientSecret = Deno.env.get("MP_CLIENT_SECRET");
    const appUrl = Deno.env.get("APP_URL") || "https://agendali.lovable.app";

    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Disconnect ──
    if (action === "disconnect" && state) {
      console.log("[MP-OAuth] Disconnect requested for establishment:", state);

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
        console.error("[MP-OAuth] Disconnect auth failed:", claimsErr);
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
        console.error("[MP-OAuth] Disconnect forbidden: user doesn't own establishment");
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabase
        .from("payment_accounts")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("establishment_id", state)
        .eq("provider", "mercadopago");

      if (updateErr) {
        console.error("[MP-OAuth] Disconnect DB error:", updateErr);
      } else {
        console.log("[MP-OAuth] Disconnected successfully for:", state);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate OAuth URL (connect) ──
    if (action === "connect" && state) {
      console.log("[MP-OAuth] Connect requested for establishment:", state);

      if (!mpClientId || !mpClientSecret) {
        console.error("[MP-OAuth] Missing MP_CLIENT_ID or MP_CLIENT_SECRET");
        return new Response(
          JSON.stringify({ error: "Mercado Pago not configured. Contact support." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const redirectUri = `${supabaseUrl}/functions/v1/mercadopago-oauth`;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Store code_verifier temporarily in a pending record
      const { error: upsertErr } = await supabase.from("payment_accounts").upsert(
        {
          establishment_id: state,
          provider: "mercadopago",
          access_token: `pkce_pending:${codeVerifier}`,
          status: "pending_oauth",
          connected_at: new Date().toISOString(),
        },
        { onConflict: "establishment_id,provider" },
      );

      if (upsertErr) {
        console.error("[MP-OAuth] Failed to store PKCE verifier:", upsertErr);
        return new Response(
          JSON.stringify({ error: "Failed to initiate connection" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const authUrl =
        `https://auth.mercadopago.com.br/authorization?client_id=${mpClientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      console.log("[MP-OAuth] Auth URL generated, redirecting user to MP");

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── OAuth Callback ──
    if (code && state) {
      console.log("[MP-OAuth] Callback received. state (establishment_id):", state, "code length:", code.length);

      if (!mpClientId || !mpClientSecret) {
        console.error("[MP-OAuth] Missing MP_CLIENT_ID or MP_CLIENT_SECRET in callback");
        return Response.redirect(`${appUrl}/dashboard/pagamentos?mp_error=config_missing`, 302);
      }

      const redirectUri = `${supabaseUrl}/functions/v1/mercadopago-oauth`;

      // Retrieve stored code_verifier
      const { data: pendingAccount, error: fetchErr } = await supabase
        .from("payment_accounts")
        .select("access_token")
        .eq("establishment_id", state)
        .eq("provider", "mercadopago")
        .single();

      if (fetchErr) {
        console.error("[MP-OAuth] Failed to fetch pending account:", fetchErr);
      }

      let codeVerifier: string | undefined;
      if (pendingAccount?.access_token?.startsWith("pkce_pending:")) {
        codeVerifier = pendingAccount.access_token.replace("pkce_pending:", "");
        console.log("[MP-OAuth] PKCE code_verifier retrieved successfully");
      } else {
        console.warn("[MP-OAuth] No PKCE verifier found, proceeding without it");
      }

      // Exchange code for tokens
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

      console.log("[MP-OAuth] Exchanging code for token...");

      const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("[MP-OAuth] Token exchange FAILED. Status:", tokenRes.status, "Response:", JSON.stringify(tokenData));
        return Response.redirect(
          `${appUrl}/dashboard/pagamentos?mp_error=token_exchange_failed`,
          302,
        );
      }

      console.log("[MP-OAuth] Token exchange SUCCESS. user_id:", tokenData.user_id, "has refresh_token:", !!tokenData.refresh_token);

      // Save tokens - upsert by (establishment_id, provider) unique constraint
      const { error: saveErr } = await supabase.from("payment_accounts").upsert(
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
          updated_at: new Date().toISOString(),
        },
        { onConflict: "establishment_id,provider" },
      );

      if (saveErr) {
        console.error("[MP-OAuth] Failed to save payment account:", saveErr);
        return Response.redirect(
          `${appUrl}/dashboard/pagamentos?mp_error=save_failed`,
          302,
        );
      }

      console.log("[MP-OAuth] Payment account saved successfully for establishment:", state);

      // Ensure payment_settings row exists
      await supabase.from("payment_settings").upsert(
        {
          establishment_id: state,
          online_payment_enabled: false,
        },
        { onConflict: "establishment_id" },
      );

      console.log("[MP-OAuth] Redirecting to dashboard/pagamentos with success");

      return Response.redirect(
        `${appUrl}/dashboard/pagamentos?mp_connected=true`,
        302,
      );
    }

    // No valid action
    console.warn("[MP-OAuth] No valid action. Params:", { action, code: !!code, state: !!state });
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[MP-OAuth] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
