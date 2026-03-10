-- Fix: Change RESTRICTIVE policies to PERMISSIVE so they OR together
-- Drop existing broken policies
DROP POLICY IF EXISTS "Admins can view allowed signups" ON public.allowed_establishment_signups;
DROP POLICY IF EXISTS "Anon can check allowed signups" ON public.allowed_establishment_signups;
DROP POLICY IF EXISTS "Auth can mark own signup used" ON public.allowed_establishment_signups;

-- Recreate as PERMISSIVE (default) so anon OR admin can SELECT
CREATE POLICY "Anon can check allowed signups"
  ON public.allowed_establishment_signups
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can check own allowed signup"
  ON public.allowed_establishment_signups
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email'::text)));

CREATE POLICY "Admins can view allowed signups"
  ON public.allowed_establishment_signups
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- Fix UPDATE policy to be PERMISSIVE too
CREATE POLICY "Auth can mark own signup used"
  ON public.allowed_establishment_signups
  FOR UPDATE
  TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email'::text)))
  WITH CHECK (lower(email) = lower((auth.jwt() ->> 'email'::text)));