
-- Add professional_id and professional_stars to ratings table
ALTER TABLE public.ratings 
ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES public.professionals(id),
ADD COLUMN IF NOT EXISTS professional_stars integer;

-- Add constraint for professional_stars range
ALTER TABLE public.ratings 
ADD CONSTRAINT ratings_professional_stars_range CHECK (professional_stars IS NULL OR (professional_stars >= 1 AND professional_stars <= 5));

-- Create RPC for professional rating aggregation
CREATE OR REPLACE FUNCTION public.get_professional_rating(p_professional_id uuid)
RETURNS TABLE(rating_avg numeric, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(ROUND(AVG(professional_stars)::numeric, 1), 0) AS rating_avg,
    COUNT(professional_stars) AS rating_count
  FROM ratings
  WHERE professional_id = p_professional_id
    AND professional_stars IS NOT NULL;
$$;

-- Update get_establishment_rating to also return professional breakdown
-- (keeping existing function signature intact)
