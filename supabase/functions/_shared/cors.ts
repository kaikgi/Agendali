const ALLOWED_ORIGINS = new Set([
  "https://www.agendali.online",
  "https://agendali.online",
  "https://agendali.lovable.app",
  "http://localhost:8088",
  "http://localhost:5173",
]);

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

/**
 * CORS + baseline security headers for edge functions. Reflects Origin only when it
 * matches the allowlist above instead of a blanket "*", closing the reflected-origin gap.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : "https://www.agendali.online";
  return {
    ...BASE_HEADERS,
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
  };
}
