
-- 1. Drop overly permissive public SELECT policies
DROP POLICY IF EXISTS "Public can read customers for booking" ON public.customers;
DROP POLICY IF EXISTS "Public can read appointments for booking" ON public.appointments;
DROP POLICY IF EXISTS "Anyone can read tokens by hash" ON public.appointment_manage_tokens;
DROP POLICY IF EXISTS "Public can read accepted terms for booking" ON public.appointment_accepted_terms;
DROP POLICY IF EXISTS "Public can insert accepted terms" ON public.appointment_accepted_terms;

-- 2. Revoke column-level access to portal_password_hash
REVOKE SELECT (portal_password_hash) ON public.professionals FROM anon, authenticated;

-- 3. RPC: Busy ranges for a professional (anon-safe)
CREATE OR REPLACE FUNCTION public.public_get_busy_ranges(
  p_professional_id uuid,
  p_day_start timestamptz,
  p_day_end timestamptz
)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.start_at, a.end_at
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.start_at >= p_day_start
    AND a.start_at < p_day_end
    AND a.status IN ('booked','confirmed','pending_approval','pending_payment','paid_pending_confirmation');
$$;

GRANT EXECUTE ON FUNCTION public.public_get_busy_ranges(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- 4. RPC: Get appointment status by token (anon-safe, used right after creation)
CREATE OR REPLACE FUNCTION public.public_get_appointment_status(
  p_token text,
  p_appointment_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_status text;
BEGIN
  IF p_token IS NULL OR p_appointment_id IS NULL THEN
    RETURN NULL;
  END IF;
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  IF NOT EXISTS (
    SELECT 1 FROM public.appointment_manage_tokens
    WHERE appointment_id = p_appointment_id AND token_hash = v_token_hash
  ) THEN
    RETURN NULL;
  END IF;

  SELECT status INTO v_status FROM public.appointments WHERE id = p_appointment_id;
  RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_appointment_status(text, uuid) TO anon, authenticated;

-- 5. RPC: Get appointment + related info by token (replaces direct SELECT)
CREATE OR REPLACE FUNCTION public.public_get_appointment_by_token(
  p_slug text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_tok record;
  v_apt record;
  v_cust record;
  v_prof record;
  v_serv record;
  v_est record;
  v_terms record;
BEGIN
  IF p_token IS NULL OR p_slug IS NULL THEN
    RAISE EXCEPTION 'Token e slug são obrigatórios';
  END IF;

  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT appointment_id, expires_at, used_at
  INTO v_tok
  FROM public.appointment_manage_tokens
  WHERE token_hash = v_token_hash;

  IF v_tok IS NULL THEN
    RAISE EXCEPTION 'Token inválido ou não encontrado';
  END IF;

  IF v_tok.expires_at < now() THEN
    RAISE EXCEPTION 'Este link expirou';
  END IF;

  SELECT id, start_at, end_at, status, customer_notes, customer_id, professional_id, service_id, establishment_id
  INTO v_apt FROM public.appointments WHERE id = v_tok.appointment_id;

  IF v_apt IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  SELECT id, name, slug, phone, address, reschedule_min_hours, cancellation_policy_text
  INTO v_est FROM public.establishments WHERE id = v_apt.establishment_id;

  IF v_est.slug IS DISTINCT FROM p_slug THEN
    RAISE EXCEPTION 'Agendamento não pertence a este estabelecimento';
  END IF;

  SELECT id, name, phone, email INTO v_cust FROM public.customers WHERE id = v_apt.customer_id;
  SELECT id, name INTO v_prof FROM public.professionals WHERE id = v_apt.professional_id;
  SELECT id, name, duration_minutes, price_cents INTO v_serv FROM public.services WHERE id = v_apt.service_id;
  SELECT terms_type, terms_params INTO v_terms FROM public.appointment_accepted_terms WHERE appointment_id = v_apt.id LIMIT 1;

  RETURN jsonb_build_object(
    'id', v_apt.id,
    'start_at', v_apt.start_at,
    'end_at', v_apt.end_at,
    'status', v_apt.status,
    'customer_notes', v_apt.customer_notes,
    'customer', CASE WHEN v_cust.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_cust.id, 'name', v_cust.name, 'phone', v_cust.phone, 'email', v_cust.email) END,
    'professional', CASE WHEN v_prof.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_prof.id, 'name', v_prof.name) END,
    'service', CASE WHEN v_serv.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_serv.id, 'name', v_serv.name, 'duration_minutes', v_serv.duration_minutes, 'price_cents', v_serv.price_cents) END,
    'establishment', jsonb_build_object('id', v_est.id, 'name', v_est.name, 'slug', v_est.slug, 'phone', v_est.phone, 'address', v_est.address, 'reschedule_min_hours', v_est.reschedule_min_hours, 'cancellation_policy_text', v_est.cancellation_policy_text),
    'accepted_terms', CASE WHEN v_terms.terms_type IS NULL THEN NULL ELSE jsonb_build_object('terms_type', v_terms.terms_type, 'terms_params', v_terms.terms_params) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_appointment_by_token(text, text) TO anon, authenticated;

-- 6. RPC: Save accepted terms (token-validated)
CREATE OR REPLACE FUNCTION public.public_save_accepted_terms(
  p_token text,
  p_appointment_id uuid,
  p_terms_type text,
  p_terms_text text,
  p_terms_params jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_est_id uuid;
BEGIN
  IF p_token IS NULL OR p_appointment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parâmetros obrigatórios');
  END IF;
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  IF NOT EXISTS (
    SELECT 1 FROM public.appointment_manage_tokens
    WHERE appointment_id = p_appointment_id AND token_hash = v_token_hash AND expires_at > now()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;

  SELECT establishment_id INTO v_est_id FROM public.appointments WHERE id = p_appointment_id;
  IF v_est_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  INSERT INTO public.appointment_accepted_terms (appointment_id, establishment_id, terms_type, terms_text, terms_params)
  VALUES (p_appointment_id, v_est_id, p_terms_type, p_terms_text, p_terms_params)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_save_accepted_terms(text, uuid, text, text, jsonb) TO anon, authenticated;
