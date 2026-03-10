
-- Create service_categories table
CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, name)
);

-- Enable RLS
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Owner can manage their own categories
CREATE POLICY "Owner can manage service_categories"
  ON public.service_categories FOR ALL
  TO authenticated
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ))
  WITH CHECK (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ));

-- Public can read categories for booking
CREATE POLICY "Public can read service_categories"
  ON public.service_categories FOR SELECT
  TO public
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE booking_enabled = true
  ));

-- Add category_id to services (nullable FK)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- Migrate existing category text to new table
INSERT INTO public.service_categories (establishment_id, name, sort_order)
SELECT DISTINCT s.establishment_id, s.category, 
  ROW_NUMBER() OVER (PARTITION BY s.establishment_id ORDER BY MIN(s.sort_order)) - 1
FROM public.services s
WHERE s.category IS NOT NULL AND s.category != ''
GROUP BY s.establishment_id, s.category
ON CONFLICT (establishment_id, name) DO NOTHING;

-- Link existing services to their category records
UPDATE public.services s
SET category_id = sc.id
FROM public.service_categories sc
WHERE sc.establishment_id = s.establishment_id
  AND sc.name = s.category
  AND s.category IS NOT NULL AND s.category != '';

-- Auto-update updated_at
CREATE TRIGGER set_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
