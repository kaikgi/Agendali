
-- Fix security definer view by setting it to INVOKER explicitly
DROP VIEW IF EXISTS public.v_whatsapp_metrics_daily;

CREATE VIEW public.v_whatsapp_metrics_daily
WITH (security_invoker = true)
AS
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
