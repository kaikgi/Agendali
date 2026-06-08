
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Set initial sort_order based on current name ordering
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY establishment_id ORDER BY name) - 1 AS rn
  FROM public.services
)
UPDATE public.services s
SET sort_order = o.rn
FROM ordered o
WHERE s.id = o.id;
