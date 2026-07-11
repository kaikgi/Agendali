-- Professional portal "logout" only cleared localStorage client-side; the session token
-- stayed valid server-side indefinitely (until natural expiry), so a captured/stolen
-- token kept working after the professional logged out. Add real server-side revocation.
CREATE OR REPLACE FUNCTION public.professional_portal_logout(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  DELETE FROM public.professional_portal_sessions WHERE token_hash = v_token_hash;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.professional_portal_logout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.professional_portal_logout(text) TO anon, authenticated;
