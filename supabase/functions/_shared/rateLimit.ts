import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}

/**
 * Server-side rate limit backed by public.check_rate_limit (service_role only).
 * Returns true if the request is allowed, false if the limit was exceeded.
 * Fails open (allows the request) if the check itself errors, so a rate-limit
 * outage never becomes an availability outage for the underlying feature.
 */
export async function checkRateLimit(
  req: Request,
  action: string,
  maxCount: number,
  windowMinutes: number,
): Promise<boolean> {
  try {
    const ip = getClientIp(req);
    const ipHash = await hashIp(ip);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_action: action,
      p_ip_hash: ipHash,
      p_max_count: maxCount,
      p_window_minutes: windowMinutes,
    });

    if (error) {
      console.error(`[rate-limit] check failed for ${action}:`, error);
      return true;
    }

    return data === true;
  } catch (e) {
    console.error(`[rate-limit] unexpected error for ${action}:`, e);
    return true;
  }
}
