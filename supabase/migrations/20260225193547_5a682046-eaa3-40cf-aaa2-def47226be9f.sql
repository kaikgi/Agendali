
-- Fix search_path on normalize_professional_slug
CREATE OR REPLACE FUNCTION public.normalize_professional_slug()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.slug IS NOT NULL THEN
    NEW.slug := lower(trim(NEW.slug));
  END IF;
  RETURN NEW;
END;
$$;
