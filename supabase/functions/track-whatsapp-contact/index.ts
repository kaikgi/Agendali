import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Rate limit config
const IP_LIMIT = 5;        // per minute
const EMAIL_LIMIT = 3;     // per minute
const BLOCK_MINUTES = 10;
const REPEAT_BLOCK_MINUTES = 30;
const DEDUPE_WINDOW_MINUTES = 10;
const DEDUPE_THRESHOLD = 3;
const COOLDOWN_SECONDS = 15;

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || 'unknown';
}

interface RequestBody {
  name: string;
  email: string;
  message: string;
  page_path?: string;
  honeypot?: string;
  fingerprint?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();
    const { name, email, message, page_path, honeypot, fingerprint } = body;

    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent') || '';
    const referrer = req.headers.get('referer') || '';

    // Helper to insert event
    const insertEvent = async (status: string, blockReason?: string, msgHash?: string) => {
      await adminClient.from('contact_whatsapp_events').insert({
        name: (name || '').substring(0, 100),
        email: (email || '').substring(0, 255),
        message_hash: msgHash || null,
        ip,
        fingerprint: fingerprint || null,
        user_agent: userAgent.substring(0, 500),
        referrer: referrer.substring(0, 500),
        page_path: page_path || '/contato',
        status,
        block_reason: blockReason || null,
      });
    };

    // 1. Honeypot check
    if (honeypot && honeypot.trim().length > 0) {
      await insertEvent('blocked', 'HONEYPOT');
      return new Response(
        JSON.stringify({ ok: false, code: 'BOT_BLOCKED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Basic validation
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ ok: false, code: 'INVALID_INPUT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ ok: false, code: 'INVALID_EMAIL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Rate limit check (hybrid IP + email)
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60_000);

    const checkRateLimit = async (key: string): Promise<{ blocked: boolean }> => {
      const endpoint = 'track-whatsapp-contact';

      // Check if currently blocked
      const { data: existing } = await adminClient
        .from('api_rate_limits')
        .select('*')
        .eq('key', key)
        .eq('endpoint', endpoint)
        .single();

      if (existing?.blocked_until) {
        const blockedUntil = new Date(existing.blocked_until);
        if (blockedUntil > now) {
          // Still blocked - extend if repeated
          const newBlockEnd = new Date(now.getTime() + REPEAT_BLOCK_MINUTES * 60_000);
          await adminClient
            .from('api_rate_limits')
            .update({ blocked_until: newBlockEnd.toISOString(), request_count: existing.request_count + 1 })
            .eq('id', existing.id);
          return { blocked: true };
        }
      }

      // Check window
      if (existing) {
        const windowStart = new Date(existing.window_start);
        if (windowStart > oneMinuteAgo) {
          // Within window
          const newCount = existing.request_count + 1;
          const limit = key.startsWith('ip:') ? IP_LIMIT : EMAIL_LIMIT;

          if (newCount > limit) {
            // Block
            const blockEnd = new Date(now.getTime() + BLOCK_MINUTES * 60_000);
            await adminClient
              .from('api_rate_limits')
              .update({
                request_count: newCount,
                blocked_until: blockEnd.toISOString(),
              })
              .eq('id', existing.id);
            return { blocked: true };
          }

          await adminClient
            .from('api_rate_limits')
            .update({ request_count: newCount })
            .eq('id', existing.id);
        } else {
          // Reset window
          await adminClient
            .from('api_rate_limits')
            .update({
              request_count: 1,
              window_start: now.toISOString(),
              blocked_until: null,
            })
            .eq('id', existing.id);
        }
      } else {
        // Create new entry
        await adminClient
          .from('api_rate_limits')
          .insert({
            key,
            endpoint,
            request_count: 1,
            window_start: now.toISOString(),
          });
      }

      return { blocked: false };
    };

    const ipCheck = await checkRateLimit(`ip:${ip}`);
    if (ipCheck.blocked) {
      await insertEvent('blocked', 'RATE_LIMIT');
      return new Response(
        JSON.stringify({ ok: false, code: 'RATE_LIMIT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailCheck = await checkRateLimit(`email:${email.toLowerCase().trim()}`);
    if (emailCheck.blocked) {
      await insertEvent('blocked', 'RATE_LIMIT');
      return new Response(
        JSON.stringify({ ok: false, code: 'RATE_LIMIT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Calculate message hash
    const messageHash = await sha256(`${name}|${email}|${message}`);

    // 5. Dedupe by hash (same hash > 3 times in 10 min)
    const dedupeWindowStart = new Date(now.getTime() - DEDUPE_WINDOW_MINUTES * 60_000);
    const { count: dupeCount } = await adminClient
      .from('contact_whatsapp_events')
      .select('*', { count: 'exact', head: true })
      .eq('message_hash', messageHash)
      .gte('created_at', dedupeWindowStart.toISOString());

    if ((dupeCount || 0) >= DEDUPE_THRESHOLD) {
      await insertEvent('blocked', 'DUPLICATE_HASH_SPAM', messageHash);
      return new Response(
        JSON.stringify({ ok: false, code: 'DUPLICATE' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Cooldown by fingerprint (max 1 per 15s)
    if (fingerprint) {
      const cooldownStart = new Date(now.getTime() - COOLDOWN_SECONDS * 1000);
      const { count: recentByFp } = await adminClient
        .from('contact_whatsapp_events')
        .select('*', { count: 'exact', head: true })
        .eq('fingerprint', fingerprint)
        .gte('created_at', cooldownStart.toISOString());

      if ((recentByFp || 0) > 0) {
        await insertEvent('blocked', 'COOLDOWN', messageHash);
        return new Response(
          JSON.stringify({ ok: false, code: 'COOLDOWN' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 7. All checks passed — insert clicked event
    await insertEvent('clicked', null, messageHash);

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-whatsapp-contact:', error);
    return new Response(
      JSON.stringify({ ok: true }), // Don't block user on errors
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
