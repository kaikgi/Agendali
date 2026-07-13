-- BUG (same class as 20260711140000): useAvailableSlots.ts queries the base `appointments`
-- table directly to know which slots are already taken. Anon has no SELECT policy on
-- appointments since the IDOR fix (correctly - the old policy leaked every customer's
-- phone/email/notes), and the one authenticated-customer policy only shows their OWN
-- appointments. Net effect: every customer (anon or logged in) sees ALL time slots as
-- available, including already-booked ones. This doesn't cause double-booking - the
-- public_create_appointment RPC independently re-validates for overlaps server-side and
-- rejects the request - but it means customers routinely pick a slot, fill in the whole
-- form, and only then get told "esse horário acabou de ser reservado".
--
-- Fix: a SECURITY DEFINER RPC that returns only start_at/end_at (no customer PII) for a
-- professional's busy windows in a given range, safe for anon/authenticated to call.
-- p_ignore_appointment_id lets the reschedule flow exclude the appointment being moved
-- from its own conflict list.
CREATE OR REPLACE FUNCTION public.public_get_booked_slots(
  p_professional_id uuid,
  p_range_start timestamptz,
  p_range_end timestamptz,
  p_ignore_appointment_id uuid DEFAULT NULL
)
RETURNS TABLE (start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT a.start_at, a.end_at
  FROM public.appointments a
  WHERE a.professional_id = p_professional_id
    AND a.status IN ('booked', 'confirmed', 'pending_approval', 'paid_pending_confirmation', 'pending_payment')
    AND a.start_at < p_range_end
    AND a.end_at > p_range_start
    AND (p_ignore_appointment_id IS NULL OR a.id != p_ignore_appointment_id);
$$;

GRANT EXECUTE ON FUNCTION public.public_get_booked_slots(uuid, timestamptz, timestamptz, uuid) TO anon, authenticated;
