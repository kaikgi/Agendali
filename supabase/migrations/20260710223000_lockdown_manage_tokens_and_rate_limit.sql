-- 1) appointment_manage_tokens: token_hash + appointment_id should never be publicly
-- readable; only SECURITY DEFINER RPCs (which bypass RLS) need this table.
DROP POLICY IF EXISTS "public_select_manage_tokens" ON public.appointment_manage_tokens;
DROP POLICY IF EXISTS "Public can view tokens" ON public.appointment_manage_tokens;

-- 2) business_hours / professional_hours / professional_services / time_blocks already
-- have correctly-scoped policies (booking_enabled establishments only) from an earlier
-- pass, but the old unconditional "true" policies were never cleaned up. Since RLS
-- policies are OR'd, the leftover unconditional ones make the correct ones meaningless.
DROP POLICY IF EXISTS "Public can view business hours" ON public.business_hours;
DROP POLICY IF EXISTS "Public can view professional hours" ON public.professional_hours;
DROP POLICY IF EXISTS "Public can view professional services" ON public.professional_services;
DROP POLICY IF EXISTS "Public can view time blocks" ON public.time_blocks;

-- 3) Rate limiting: public_rate_limits existed since the very first migration but was
-- never wired to any check function, and was wide open (ALL/public/true) meaning anyone
-- could read or tamper with other actors' counters directly. Centralize through a
-- SECURITY DEFINER function and remove direct public access.
DROP POLICY IF EXISTS "System can manage rate limits" ON public.public_rate_limits;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_ip_hash text,
  p_max_count integer,
  p_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_window_start timestamptz;
  v_count integer;
BEGIN
  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / (p_window_minutes * 60)) * (p_window_minutes * 60));

  INSERT INTO public.public_rate_limits (action, ip_hash, window_start, count)
  VALUES (p_action, p_ip_hash, v_window_start, 1)
  ON CONFLICT (action, ip_hash, window_start)
  DO UPDATE SET count = public_rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;
