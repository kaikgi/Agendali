
-- 1. Add portal_enabled check to validate_professional_session
-- This is the central gatekeeper — all portal RPCs call this first
CREATE OR REPLACE FUNCTION public.validate_professional_session(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token_hash text;
  v_session record;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT s.*, p.id as prof_id, p.name as prof_name, p.establishment_id, 
         p.portal_enabled, e.name as est_name, e.slug as est_slug
  INTO v_session
  FROM public.professional_portal_sessions s
  JOIN public.professionals p ON p.id = s.professional_id
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE s.token_hash = v_token_hash
    AND s.expires_at > now()
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  -- Block access if portal is disabled (even with valid session)
  IF NOT COALESCE(v_session.portal_enabled, false) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'portal_disabled');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'professional_id', v_session.prof_id,
    'professional_name', v_session.prof_name,
    'establishment_id', v_session.establishment_id,
    'establishment_name', v_session.est_name,
    'establishment_slug', v_session.est_slug
  );
END;
$function$;

-- 2. Unique index on (establishment_id, slug) for professionals
CREATE UNIQUE INDEX IF NOT EXISTS idx_professionals_slug_unique
ON public.professionals (establishment_id, slug)
WHERE slug IS NOT NULL;

-- 3. Slug normalization trigger
CREATE OR REPLACE FUNCTION public.normalize_professional_slug()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(trim(NEW.slug));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_professional_slug ON public.professionals;
CREATE TRIGGER trg_normalize_professional_slug
BEFORE INSERT OR UPDATE OF slug ON public.professionals
FOR EACH ROW EXECUTE FUNCTION public.normalize_professional_slug();
