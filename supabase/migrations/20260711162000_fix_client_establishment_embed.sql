-- BUG (same class, found while reviewing customer-facing queries): several client-facing
-- hooks embed the raw `establishments` table via PostgREST's FK-join shorthand
-- (`establishment:establishments(...)`) inside an `appointments` query. A logged-in
-- customer has no RLS policy granting them visibility into `establishments` at all (the
-- table's only `authenticated` policies are owner/admin/staff-member scoped) - so this
-- embed comes back null for every real customer, which crashes `ClientAppointments.tsx`
-- (`apt.establishment.name.charAt(0)` with no null guard) and silently drops the
-- establishment id/name used by the auto-completed-appointment rating prompt.
--
-- Fix on the frontend is to stop embedding the raw table and instead do a second lookup
-- against the existing `public_establishments` view (already granted to anon+authenticated).
-- That view is missing two columns the client portal needs. Using CREATE OR REPLACE (not
-- DROP+CREATE) and appending columns at the end, since ~13 other tables' RLS policies
-- reference this view in subqueries (from the 2026-07-10 booking-page regression fix) and
-- a DROP would either fail or cascade-drop those policies.
CREATE OR REPLACE VIEW public.public_establishments AS
SELECT
    id,
    name,
    slug,
    description,
    logo_url,
    phone,
    address,
    city,
    state,
    instagram,
    timezone,
    booking_enabled,
    slot_interval_minutes,
    require_policy_acceptance,
    cancellation_policy_text,
    buffer_minutes,
    max_future_days
FROM public.establishments
WHERE booking_enabled = true
  AND status = 'active';

GRANT SELECT ON public.public_establishments TO anon, authenticated;

-- public_establishments filters to booking_enabled + status='active', which is right for
-- anon browsing/booking but wrong here: a customer's EXISTING appointment at an
-- establishment that's mid-trial, past_due, or has since disabled booking should still show
-- who it's with. This RPC returns establishment display info scoped to "the caller has at
-- least one appointment there" instead of the establishment's current bookability.
CREATE OR REPLACE FUNCTION public.customer_get_own_appointment_establishments(p_establishment_ids uuid[])
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  logo_url text,
  phone text,
  address text,
  city text,
  state text,
  max_future_days integer,
  slot_interval_minutes integer,
  buffer_minutes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT e.id, e.name, e.slug, e.logo_url, e.phone, e.address, e.city, e.state,
         e.max_future_days, e.slot_interval_minutes, e.buffer_minutes
  FROM public.establishments e
  WHERE e.id = ANY(p_establishment_ids)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.establishment_id = e.id AND a.customer_user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.customer_get_own_appointment_establishments(uuid[]) TO authenticated;
