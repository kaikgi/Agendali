-- BUG (same class as the last two): right after public_create_appointment, PublicBooking.tsx
-- re-reads the new appointment's status directly from the `appointments` table to decide
-- whether to show the payment step. Anon has no SELECT policy on appointments at all, so
-- this read fails for GUEST customers (not logged in) whenever the service requires online
-- payment - the booking is created successfully but the frontend then throws right after,
-- since it can't tell whether to show the payment step.
--
-- Rather than changing public_create_appointment's RETURNS TABLE shape (risky to touch
-- given intermittent DB access this session - could lose its anon EXECUTE grant if a
-- DROP+CREATE doesn't restore it exactly), this is a small additive RPC: it proves the
-- caller legitimately owns the appointment via the same manage_token they were already
-- given back, then returns just the status.
CREATE OR REPLACE FUNCTION public.public_get_appointment_status(
  p_appointment_id uuid,
  p_manage_token text
)
RETURNS TABLE (status text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash text;
BEGIN
  v_token_hash := encode(digest(p_manage_token, 'sha256'), 'hex');

  RETURN QUERY
  SELECT a.status::text
  FROM public.appointments a
  JOIN public.appointment_manage_tokens t ON t.appointment_id = a.id
  WHERE a.id = p_appointment_id AND t.token_hash = v_token_hash;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_appointment_status(uuid, text) TO anon, authenticated;
