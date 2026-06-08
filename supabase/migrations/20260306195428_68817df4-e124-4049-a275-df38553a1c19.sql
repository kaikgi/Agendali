-- Add unique constraint on business_hours for upsert to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_hours_establishment_weekday_unique'
  ) THEN
    ALTER TABLE public.business_hours ADD CONSTRAINT business_hours_establishment_weekday_unique UNIQUE (establishment_id, weekday);
  END IF;
END $$;

-- Create slug availability check function
CREATE OR REPLACE FUNCTION public.check_establishment_slug_available(p_slug text, p_current_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.establishments
    WHERE slug = p_slug AND id != p_current_establishment_id
  );
$$;