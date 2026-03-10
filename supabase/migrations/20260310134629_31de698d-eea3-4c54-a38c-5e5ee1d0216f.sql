-- Fix professional_portal_login to use UUID-based token (same fix as public_create_appointment)
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

  IF v_prof.portal_password_hash != crypt(p_password, v_prof.portal_password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha incorreta');
  END IF;

  -- Generate session token using UUID (no pgcrypto gen_random_bytes needed)
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.professional_portal_sessions (professional_id, token_hash)
  VALUES (v_prof.id, v_token_hash);

  UPDATE public.professionals SET portal_last_login_at = now() WHERE id = v_prof.id;

  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$function$;