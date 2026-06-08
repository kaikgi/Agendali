
-- 1. Update get_professional_appointments to return ALL statuses (not just booked/confirmed/completed)
CREATE OR REPLACE FUNCTION public.get_professional_appointments(p_token text, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
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
    AND a.start_at < (p_end_date + 1)::timestamptz;

  RETURN v_result;
END;
$function$;

-- 2. Create professional_update_profile RPC
CREATE OR REPLACE FUNCTION public.professional_update_profile(p_token text, p_name text DEFAULT NULL, p_photo_url text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_updated record;
BEGIN
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  UPDATE public.professionals
  SET 
    name = COALESCE(NULLIF(TRIM(p_name), ''), name),
    photo_url = COALESCE(p_photo_url, photo_url)
  WHERE id = v_professional_id
  RETURNING id, name, photo_url, slug INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'professional', jsonb_build_object(
      'id', v_updated.id,
      'name', v_updated.name,
      'photo_url', v_updated.photo_url,
      'slug', v_updated.slug
    )
  );
END;
$function$;

-- 3. Add validate_professional_session result to include photo_url
CREATE OR REPLACE FUNCTION public.validate_professional_session(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
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

  SELECT p.id, p.name, p.portal_enabled, p.slug, p.photo_url,
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
    'professional_photo_url', v_prof.photo_url,
    'establishment_id', v_prof.establishment_id,
    'establishment_name', v_prof.establishment_name,
    'establishment_slug', v_prof.establishment_slug
  );
END;
$function$;
