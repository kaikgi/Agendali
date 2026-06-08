
-- 1. Contact WhatsApp events tracking table
CREATE TABLE IF NOT EXISTS public.contact_whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text,
  email text,
  message_hash text,
  ip text,
  fingerprint text,
  user_agent text,
  referrer text,
  page_path text NOT NULL DEFAULT '/contato',
  status text NOT NULL DEFAULT 'clicked'
    CHECK (status IN ('clicked','blocked','failed')),
  block_reason text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.contact_whatsapp_events ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT
CREATE POLICY "admin_select_whatsapp_events"
  ON public.contact_whatsapp_events
  FOR SELECT
  USING (public.is_admin());

-- No public INSERT/UPDATE/DELETE (service role only)

-- 2. API rate limits table
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  endpoint text NOT NULL,
  request_count int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  UNIQUE(key, endpoint)
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only admins can SELECT
CREATE POLICY "admin_select_rate_limits"
  ON public.api_rate_limits
  FOR SELECT
  USING (public.is_admin());

-- 3. Aggregated view for dashboard
CREATE OR REPLACE VIEW public.v_whatsapp_metrics_daily AS
SELECT
  date_trunc('day', created_at)::date AS day,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE status = 'clicked') AS clicked,
  COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
  COUNT(*) FILTER (WHERE status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE block_reason = 'RATE_LIMIT') AS reason_rate_limit,
  COUNT(*) FILTER (WHERE block_reason = 'HONEYPOT') AS reason_honeypot,
  COUNT(*) FILTER (WHERE block_reason = 'DUPLICATE_HASH_SPAM') AS reason_duplicate,
  COUNT(*) FILTER (WHERE block_reason = 'COOLDOWN') AS reason_cooldown
FROM public.contact_whatsapp_events
GROUP BY date_trunc('day', created_at)::date;
