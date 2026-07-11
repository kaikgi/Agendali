-- Public-facing reviews list for the booking page. Returns only what a public reviews
-- list should ever show (stars, comment, first name, service/professional context) —
-- never phone/email, unlike the raw `ratings`/`customers` tables which are correctly
-- locked down to staff/admin/owner only.
CREATE OR REPLACE FUNCTION public.get_establishment_reviews(p_establishment_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  stars integer,
  professional_stars integer,
  comment text,
  created_at timestamptz,
  customer_first_name text,
  service_name text,
  professional_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.establishments e
    WHERE e.id = p_establishment_id AND e.booking_enabled = true AND e.status = 'active'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.stars,
    r.professional_stars,
    r.comment,
    r.created_at,
    split_part(coalesce(c.name, 'Cliente'), ' ', 1) AS customer_first_name,
    s.name AS service_name,
    p.name AS professional_name
  FROM public.ratings r
  LEFT JOIN public.customers c ON c.id = r.customer_id
  LEFT JOIN public.appointments a ON a.id = r.appointment_id
  LEFT JOIN public.services s ON s.id = a.service_id
  LEFT JOIN public.professionals p ON p.id = r.professional_id
  WHERE r.establishment_id = p_establishment_id
  ORDER BY r.created_at DESC
  LIMIT LEAST(p_limit, 200);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_establishment_reviews(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_establishment_reviews(uuid, integer) TO anon, authenticated;
