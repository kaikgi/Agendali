
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1a. ratings table - add RLS policies
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage ratings"
ON public.ratings FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

CREATE POLICY "Public can read ratings for booking"
ON public.ratings FOR SELECT
TO public
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE booking_enabled = true
));

CREATE POLICY "Customer can insert own rating"
ON public.ratings FOR INSERT
TO authenticated
WITH CHECK (customer_user_id = auth.uid());

-- 1b. establishment_members - add RLS policies
ALTER TABLE public.establishment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage members"
ON public.establishment_members FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

CREATE POLICY "Members can read own membership"
ON public.establishment_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 1c. establishment_deletion_jobs - add RLS policies
ALTER TABLE public.establishment_deletion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage deletion jobs"
ON public.establishment_deletion_jobs FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 1d. kiwify_webhook_events - add full RLS
CREATE POLICY "Only admins can manage kiwify events"
ON public.kiwify_webhook_events FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- 2. HARDEN PORTAL SESSION EXPIRATION (30 days -> 24 hours)
ALTER TABLE public.professional_portal_sessions 
ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- 3. ADD PASSWORD STRENGTH VALIDATION TO set_professional_portal_password
CREATE OR REPLACE FUNCTION public.set_professional_portal_password(p_professional_id uuid, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_hash text;
  v_est_owner uuid;
BEGIN
  SELECT e.owner_user_id INTO v_est_owner
  FROM public.professionals p
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE p.id = p_professional_id;

  IF v_est_owner IS NULL OR v_est_owner != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  IF length(p_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha deve ter pelo menos 8 caracteres');
  END IF;
  IF p_password !~ '[a-z]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha deve conter letra minúscula');
  END IF;
  IF p_password !~ '[A-Z]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha deve conter letra maiúscula');
  END IF;
  IF p_password !~ '[0-9]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha deve conter número');
  END IF;
  IF p_password !~ '[^a-zA-Z0-9]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha deve conter caractere especial');
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  UPDATE public.professionals
  SET portal_password_hash = v_hash
  WHERE id = p_professional_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

-- 4. HARDEN portal login - input validation, generic errors, session cleanup, 24h expiry
CREATE OR REPLACE FUNCTION public.professional_portal_login(p_establishment_slug text, p_professional_slug text, p_password text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_prof record;
  v_token text;
  v_token_hash text;
BEGIN
  IF p_establishment_slug IS NULL OR length(trim(p_establishment_slug)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados inválidos');
  END IF;
  IF p_professional_slug IS NULL OR length(trim(p_professional_slug)) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Dados inválidos');
  END IF;
  IF p_password IS NULL OR length(p_password) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha é obrigatória');
  END IF;

  SELECT p.id, p.name, p.portal_enabled, p.portal_password_hash,
         e.id AS establishment_id, e.name AS establishment_name, e.slug AS establishment_slug
  INTO v_prof
  FROM public.professionals p
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE e.slug = p_establishment_slug
    AND p.slug = p_professional_slug
    AND p.active = true;

  IF v_prof IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;

  IF v_prof.portal_enabled IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portal desativado para este profissional');
  END IF;

  IF v_prof.portal_password_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha não configurada. Solicite ao administrador.');
  END IF;

  IF v_prof.portal_password_hash != crypt(p_password, v_prof.portal_password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Credenciais inválidas');
  END IF;

  -- Clean up expired sessions
  DELETE FROM public.professional_portal_sessions
  WHERE professional_id = v_prof.id AND expires_at < now();

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.professional_portal_sessions (professional_id, token_hash, expires_at)
  VALUES (v_prof.id, v_token_hash, now() + interval '24 hours');

  UPDATE public.professionals SET portal_last_login_at = now() WHERE id = v_prof.id;

  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$function$;

-- 5. Secure client cancel appointment RPC
CREATE OR REPLACE FUNCTION public.client_cancel_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_appointment record;
  v_old_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id, status, customer_user_id, establishment_id
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
    AND customer_user_id = auth.uid();

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não pode ser cancelado');
  END IF;

  v_old_status := v_appointment.status;

  UPDATE public.appointments
  SET status = 'canceled'
  WHERE id = p_appointment_id
    AND customer_user_id = auth.uid();

  PERFORM public.notify_appointment_status_change(p_appointment_id, 'canceled', v_old_status);

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado');
END;
$function$;

-- 6. Cleanup expired portal sessions function
CREATE OR REPLACE FUNCTION public.cleanup_expired_portal_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.professional_portal_sessions
  WHERE expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
