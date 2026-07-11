import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const STATE_MAX_AGE_MS = 20 * 60 * 1000;

type OAuthStatePayload = {
  e: string; // establishment_id
  u: string; // user_id
  t: number; // issued timestamp
  cv: string; // PKCE code verifier
};

function encodeBase64Url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map((char) => char.charCodeAt(0)));
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return encodeBase64Url(new Uint8Array(digest));
}

async function signText(text: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(text),
  );

  return encodeBase64Url(new Uint8Array(signature));
}

async function encodeState(payload: OAuthStatePayload, secret: string): Promise<string> {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = encodeBase64Url(new TextEncoder().encode(payloadJson));
  const sig = await signText(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

async function decodeAndVerifyState(
  rawState: string,
  secret: string,
): Promise<OAuthStatePayload | null> {
  const [payloadB64, sig] = rawState.split(".");
  if (!payloadB64 || !sig) return null;

  const expectedSig = await signText(payloadB64, secret);
  if (sig !== expectedSig) return null;

  const payloadText = new TextDecoder().decode(decodeBase64Url(payloadB64));
  const payload = JSON.parse(payloadText) as OAuthStatePayload;

  if (!payload?.e || !payload?.u || !payload?.cv || !payload?.t) return null;
  if (Date.now() - payload.t > STATE_MAX_AGE_MS) return null;

  return payload;
}

async function getAuthenticatedUserId(req: Request, supabaseUrl: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims?.sub) return null;
  return claims.claims.sub;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const mpClientId = Deno.env.get("MP_CLIENT_ID");
  const mpClientSecret = Deno.env.get("MP_CLIENT_SECRET");
  const appUrl = Deno.env.get("APP_URL") || "https://agendali.lovable.app";
  const stateSecret = Deno.env.get("MP_OAUTH_STATE_SECRET") || serviceKey;

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const action = url.searchParams.get("action");

    // ── Disconnect ──
    if (action === "disconnect" && state) {
      console.log("[MP-OAuth] disconnect:start", { establishment_id: state });

      const userId = await getAuthenticatedUserId(req, supabaseUrl);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("id", state)
        .eq("owner_user_id", userId)
        .single();

      if (!est) {
        console.error("[MP-OAuth] disconnect:forbidden", {
          establishment_id: state,
          user_id: userId,
        });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updateErr } = await supabase
        .from("payment_accounts")
        .update({
          status: "disconnected",
          refresh_token: null,
          updated_at: new Date().toISOString(),
        })
        .eq("establishment_id", state)
        .eq("provider", "mercadopago");

      if (updateErr) {
        console.error("[MP-OAuth] disconnect:update_failed", updateErr);
      } else {
        console.log("[MP-OAuth] disconnect:success", { establishment_id: state });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Connect ──
    if (action === "connect" && state) {
      console.log("[MP-OAuth] connect:start", { establishment_id: state });

      if (!mpClientId || !mpClientSecret) {
        console.error("[MP-OAuth] connect:missing_credentials");
        return new Response(
          JSON.stringify({ error: "Mercado Pago não configurado. Contate o suporte." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const userId = await getAuthenticatedUserId(req, supabaseUrl);
      if (!userId) {
        console.error("[MP-OAuth] connect:unauthorized");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("id", state)
        .eq("owner_user_id", userId)
        .single();

      if (!est) {
        console.error("[MP-OAuth] connect:establishment_not_found_or_forbidden", {
          establishment_id: state,
          user_id: userId,
        });
        return new Response(
          JSON.stringify({ error: "Estabelecimento inválido para este usuário" }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const redirectUri = `${supabaseUrl}/functions/v1/mercadopago-oauth`;
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      const secureState = await encodeState(
        {
          e: state,
          u: userId,
          t: Date.now(),
          cv: codeVerifier,
        },
        stateSecret,
      );

      const authUrl =
        `https://auth.mercadopago.com.br/authorization?client_id=${mpClientId}&response_type=code&platform_id=mp&state=${encodeURIComponent(secureState)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      console.log("[MP-OAuth] connect:url_generated", {
        establishment_id: state,
        user_id: userId,
      });

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Callback ──
    if (code && state) {
      console.log("[MP-OAuth] callback:received", {
        code_received: Boolean(code),
        state_received: Boolean(state),
      });

      if (!mpClientId || !mpClientSecret) {
        console.error("[MP-OAuth] callback:missing_credentials");
        return Response.redirect(`${appUrl}/dashboard/pagamentos?mp_error=config_missing`, 302);
      }

      const decodedState = await decodeAndVerifyState(state, stateSecret);
      if (!decodedState) {
        console.error("[MP-OAuth] callback:invalid_state", { state });
        return Response.redirect(`${appUrl}/dashboard/pagamentos?mp_error=invalid_state`, 302);
      }

      const establishmentId = decodedState.e;
      const stateUserId = decodedState.u;
      const codeVerifier = decodedState.cv;

      console.log("[MP-OAuth] callback:state_resolved", {
        establishment_id: establishmentId,
        user_id: stateUserId,
      });

      const { data: est } = await supabase
        .from("establishments")
        .select("id")
        .eq("id", establishmentId)
        .eq("owner_user_id", stateUserId)
        .single();

      if (!est) {
        console.error("[MP-OAuth] callback:establishment_not_found_or_forbidden", {
          establishment_id: establishmentId,
          user_id: stateUserId,
        });
        return Response.redirect(
          `${appUrl}/dashboard/pagamentos?mp_error=establishment_invalid`,
          302,
        );
      }

      const redirectUri = `${supabaseUrl}/functions/v1/mercadopago-oauth`;

      console.log("[MP-OAuth] callback:token_exchange_start", {
        establishment_id: establishmentId,
      });

      const tokenParams = new URLSearchParams({
        client_secret: mpClientSecret,
        client_id: mpClientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      });

      const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenParams.toString(),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok || !tokenData.access_token) {
        console.error("[MP-OAuth] callback:token_exchange_failed", {
          status: tokenRes.status,
          response: tokenData,
        });
        return Response.redirect(
          `${appUrl}/dashboard/pagamentos?mp_error=token_exchange_failed`,
          302,
        );
      }

      console.log("[MP-OAuth] callback:token_exchange_success", {
        establishment_id: establishmentId,
      });

      let mpUserId = tokenData.user_id ? String(tokenData.user_id) : null;
      if (!mpUserId) {
        const meRes = await fetch("https://api.mercadopago.com/users/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          mpUserId = meData?.id ? String(meData.id) : null;
        }
      }

      if (!mpUserId) {
        console.error("[MP-OAuth] callback:mp_user_id_missing");
        return Response.redirect(`${appUrl}/dashboard/pagamentos?mp_error=token_no_user`, 302);
      }

      const { error: upsertErr } = await supabase.from("payment_accounts").upsert(
        {
          establishment_id: establishmentId,
          provider: "mercadopago",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || null,
          mp_user_id: mpUserId,
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

      if (upsertErr) {
        console.error("[MP-OAuth] callback:upsert_failed", upsertErr);
        return Response.redirect(`${appUrl}/dashboard/pagamentos?mp_error=save_failed`, 302);
      }

      console.log("[MP-OAuth] callback:upsert_success", {
        establishment_id: establishmentId,
        mp_user_id: mpUserId,
      });

      await supabase.from("payment_settings").upsert(
        {
          establishment_id: establishmentId,
          online_payment_enabled: false,
        },
        { onConflict: "establishment_id" },
      );

      return Response.redirect(`${appUrl}/dashboard/pagamentos?mp_connected=true`, 302);
    }

    console.warn("[MP-OAuth] invalid_request", { action, code: Boolean(code), state: Boolean(state) });
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[MP-OAuth] unhandled_error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
