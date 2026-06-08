
-- Ensure unique constraint on slug (may already exist, use IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'establishments_slug_unique'
  ) THEN
    ALTER TABLE public.establishments ADD CONSTRAINT establishments_slug_unique UNIQUE (slug);
  END IF;
END $$;

-- Normalize slug trigger
CREATE OR REPLACE FUNCTION public.normalize_establishment_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.slug := lower(trim(NEW.slug));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_slug ON public.establishments;
CREATE TRIGGER trg_normalize_slug
BEFORE INSERT OR UPDATE OF slug ON public.establishments
FOR EACH ROW EXECUTE FUNCTION public.normalize_establishment_slug();

-- RPC for slug availability check
CREATE OR REPLACE FUNCTION public.check_establishment_slug_available(
  p_slug text,
  p_current_establishment_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.slug = lower(trim(p_slug))
      AND (p_current_establishment_id IS NULL OR e.id <> p_current_establishment_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_establishment_slug_available(text, uuid) TO anon, authenticated;
