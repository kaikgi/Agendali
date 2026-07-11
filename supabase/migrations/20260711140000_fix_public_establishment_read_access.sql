-- CRITICAL FIX: the public booking page (useEstablishment.ts -> PublicBooking.tsx) queries
-- the base `establishments` table directly. Anon has no GRANT on that table since the
-- 2026-07-10 RLS lockdown, and `authenticated` customers who aren't the owner/a member
-- fail the `establishments_select_auth` RLS policy. Both anon and logged-in customers were
-- getting "Estabelecimento não encontrado" on every public booking link.
--
-- The existing `public_establishments` view can't be reused as-is here: it's missing
-- buffer_minutes/auto_confirm_bookings/max_future_days (needed by the booking form) and its
-- WHERE clause excludes status <> 'active', which would hide the deliberate "blocked" message
-- for past_due/canceled establishments instead of showing it. So this is a dedicated RPC.

CREATE OR REPLACE FUNCTION public.public_get_establishment_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  logo_url text,
  phone text,
  address text,
  city text,
  state text,
  instagram text,
  timezone text,
  booking_enabled boolean,
  auto_confirm_bookings boolean,
  ask_email boolean,
  ask_notes boolean,
  require_policy_acceptance boolean,
  cancellation_policy_text text,
  reschedule_min_hours integer,
  max_future_days integer,
  slot_interval_minutes integer,
  buffer_minutes integer,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id, e.name, e.slug, e.description, e.logo_url, e.phone, e.address, e.city, e.state,
    e.instagram, e.timezone, e.booking_enabled, e.auto_confirm_bookings, e.ask_email,
    e.ask_notes, e.require_policy_acceptance, e.cancellation_policy_text,
    e.reschedule_min_hours, e.max_future_days, e.slot_interval_minutes, e.buffer_minutes,
    e.status
  FROM public.establishments e
  WHERE e.slug = p_slug AND e.booking_enabled = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_establishment_by_slug(text) TO anon, authenticated;
