-- Fix set_professional_portal_password: add extensions to search_path for pgcrypto
CREATE OR REPLACE FUNCTION public.set_professional_portal_password(
  p_professional_id uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $$
DECLARE
  v_hash text;
  v_est_owner uuid;
  v_rows int;
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

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Fix professional_portal_login: add extensions to search_path for pgcrypto
CREATE OR REPLACE FUNCTION public.professional_portal_login(
  p_establishment_slug text,
  p_professional_slug text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $$
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
$$;