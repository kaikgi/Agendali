
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create portal sessions table
CREATE TABLE IF NOT EXISTS public.professional_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

ALTER TABLE public.professional_portal_sessions ENABLE ROW LEVEL SECURITY;

-- No direct access - only via RPCs
CREATE POLICY "No direct access" ON public.professional_portal_sessions FOR SELECT USING (false);

-- 1. Set professional portal password
CREATE OR REPLACE FUNCTION public.set_professional_portal_password(
  p_professional_id uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_hash text;
  v_est_owner uuid;
BEGIN
  -- Verify the caller owns the establishment
  SELECT e.owner_user_id INTO v_est_owner
  FROM public.professionals p
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE p.id = p_professional_id;

  IF v_est_owner IS NULL OR v_est_owner != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  UPDATE public.professionals
  SET portal_password_hash = v_hash
  WHERE id = p_professional_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Professional portal login
CREATE OR REPLACE FUNCTION public.professional_portal_login(
  p_establishment_slug text,
  p_professional_slug text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_prof record;
  v_token text;
  v_token_hash text;
BEGIN
  -- Find professional by slugs
  SELECT p.id, p.name, p.portal_enabled, p.portal_password_hash,
         e.id AS establishment_id, e.name AS establishment_name, e.slug AS establishment_slug
  INTO v_prof
  FROM public.professionals p
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE e.slug = p_establishment_slug
    AND p.slug = p_professional_slug
    AND p.active = true;

  IF v_prof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado');
  END IF;

  IF v_prof.portal_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portal desativado para este profissional');
  END IF;

  IF v_prof.portal_password_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha não configurada. Solicite ao administrador.');
  END IF;

  -- Verify password
  IF v_prof.portal_password_hash != crypt(p_password, v_prof.portal_password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha incorreta');
  END IF;

  -- Generate session token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.professional_portal_sessions (professional_id, token_hash)
  VALUES (v_prof.id, v_token_hash);

  -- Update last login
  UPDATE public.professionals SET portal_last_login_at = now() WHERE id = v_prof.id;

  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

-- 3. Validate professional session
CREATE OR REPLACE FUNCTION public.validate_professional_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
  v_session record;
  v_prof record;
BEGIN
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT s.professional_id, s.expires_at
  INTO v_session
  FROM public.professional_portal_sessions s
  WHERE s.token_hash = v_token_hash;

  IF v_session IS NULL OR v_session.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  SELECT p.id, p.name, p.portal_enabled, p.slug,
         e.id AS establishment_id, e.name AS establishment_name, e.slug AS establishment_slug
  INTO v_prof
  FROM public.professionals p
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE p.id = v_session.professional_id;

  IF v_prof IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  IF v_prof.portal_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'portal_disabled');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'professional_id', v_prof.id,
    'professional_name', v_prof.name,
    'establishment_id', v_prof.establishment_id,
    'establishment_name', v_prof.establishment_name,
    'establishment_slug', v_prof.establishment_slug
  );
END;
$$;

-- 4. Get professional appointments
CREATE OR REPLACE FUNCTION public.get_professional_appointments(
  p_token text,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
  v_session record;
  v_prof_id uuid;
  v_result jsonb;
BEGIN
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT s.professional_id, s.expires_at
  INTO v_session
  FROM public.professional_portal_sessions s
  WHERE s.token_hash = v_token_hash;

  IF v_session IS NULL OR v_session.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_prof_id := v_session.professional_id;

  SELECT jsonb_build_object(
    'success', true,
    'appointments', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'start_at', a.start_at,
        'end_at', a.end_at,
        'status', a.status,
        'customer_name', c.name,
        'customer_phone', c.phone,
        'service_name', s.name,
        'service_duration', s.duration_minutes,
        'customer_notes', a.customer_notes
      ) ORDER BY a.start_at
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.appointments a
  JOIN public.customers c ON c.id = a.customer_id
  JOIN public.services s ON s.id = a.service_id
  WHERE a.professional_id = v_prof_id
    AND a.start_at >= p_start_date::timestamptz
    AND a.start_at < (p_end_date + 1)::timestamptz
    AND a.status IN ('booked', 'confirmed', 'completed');

  RETURN v_result;
END;
$$;

-- Grant execute to anon role (portal login doesn't require auth)
GRANT EXECUTE ON FUNCTION public.professional_portal_login TO anon;
GRANT EXECUTE ON FUNCTION public.validate_professional_session TO anon;
GRANT EXECUTE ON FUNCTION public.get_professional_appointments TO anon;
