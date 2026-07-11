-- CRITICAL IDOR fix: public.appointments had "Public can view own appointments via token"
-- (role public, USING (true)) — any unauthenticated request could read every appointment
-- row (customer phone/email/notes) across every establishment, no token check enforced
-- at the database level. Token validation only existed client-side.
--
-- public.public_get_appointment_by_token(p_slug, p_token) already validates the token
-- server-side (SECURITY DEFINER) and returns only the matching appointment; the frontend
-- has been updated to call it instead of querying the table directly. Safe to drop the
-- wide-open policy now — direct table access requires real ownership/membership/admin.

DROP POLICY IF EXISTS "Public can view own appointments via token" ON public.appointments;
