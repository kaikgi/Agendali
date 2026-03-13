CREATE OR REPLACE FUNCTION public.get_establishment_rating(p_establishment_id uuid)
RETURNS TABLE(rating_avg numeric, rating_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(ROUND(AVG(stars)::numeric, 1), 0) AS rating_avg,
    COUNT(*)::bigint AS rating_count
  FROM public.ratings
  WHERE establishment_id = p_establishment_id;
$$;