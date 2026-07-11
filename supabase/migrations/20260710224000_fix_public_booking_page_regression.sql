-- CRITICAL regression fix: migration 20260613130000 (RLS recursion fix, applied earlier
-- today) ran "REVOKE ALL ON public.establishments FROM anon;" so that anon must go through
-- the public_establishments view instead of the base table. But 17 policies across 13
-- tables (the entire public booking page: professionals, services, hours, ratings,
-- time blocks, payment settings, etc.) still subquery "establishments" directly to check
-- booking_enabled — which now fails with "permission denied for table establishments" for
-- anon, since merely referencing the table in the policy requires SELECT privilege on it
-- even in an OR-branch that would otherwise evaluate to false. This broke the entire
-- public booking flow for anonymous visitors. Fix: point these subqueries at
-- public_establishments (already granted to anon), which is pre-filtered to
-- booking_enabled = true AND status = 'active'.

DROP POLICY IF EXISTS "Public can read business_hours" ON public.business_hours;
DROP POLICY IF EXISTS "public_select_business_hours" ON public.business_hours;
CREATE POLICY "public_select_business_hours" ON public.business_hours
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read customer_tag_assignments" ON public.customer_tag_assignments;
CREATE POLICY "Public can read customer_tag_assignments" ON public.customer_tag_assignments
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read payment_settings" ON public.payment_settings;
CREATE POLICY "Public can read payment_settings" ON public.payment_settings
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read professional_hours for booking" ON public.professional_hours;
DROP POLICY IF EXISTS "public_select_professional_hours" ON public.professional_hours;
CREATE POLICY "public_select_professional_hours" ON public.professional_hours
  FOR SELECT TO public
  USING (professional_id IN (
    SELECT p.id FROM public.professionals p
    WHERE p.establishment_id IN (SELECT id FROM public.public_establishments)
  ));

DROP POLICY IF EXISTS "Owner can select professional_services" ON public.professional_services;
CREATE POLICY "Owner can select professional_services" ON public.professional_services
  FOR SELECT TO public
  USING (
    (professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid())
    ))
    OR
    (professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.establishment_id IN (SELECT id FROM public.public_establishments)
    ))
  );

DROP POLICY IF EXISTS "Owner can select professionals" ON public.professionals;
CREATE POLICY "Owner can select professionals" ON public.professionals
  FOR SELECT TO public
  USING (
    (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()))
    OR
    (establishment_id IN (SELECT id FROM public.public_establishments))
  );

DROP POLICY IF EXISTS "public_select_professionals" ON public.professionals;
CREATE POLICY "public_select_professionals" ON public.professionals
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read ratings for booking" ON public.ratings;
CREATE POLICY "Public can read ratings for booking" ON public.ratings
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read recurring_time_blocks for booking" ON public.recurring_time_blocks;
CREATE POLICY "Public can read recurring_time_blocks for booking" ON public.recurring_time_blocks
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read service_categories" ON public.service_categories;
DROP POLICY IF EXISTS "public_select_service_categories" ON public.service_categories;
CREATE POLICY "public_select_service_categories" ON public.service_categories
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read service_payment_settings" ON public.service_payment_settings;
CREATE POLICY "Public can read service_payment_settings" ON public.service_payment_settings
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Owner can select services" ON public.services;
CREATE POLICY "Owner can select services" ON public.services
  FOR SELECT TO public
  USING (
    (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()))
    OR
    (establishment_id IN (SELECT id FROM public.public_establishments))
  );

DROP POLICY IF EXISTS "public_select_services" ON public.services;
CREATE POLICY "public_select_services" ON public.services
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));

DROP POLICY IF EXISTS "Public can read time_blocks for booking" ON public.time_blocks;
DROP POLICY IF EXISTS "public_select_time_blocks" ON public.time_blocks;
CREATE POLICY "public_select_time_blocks" ON public.time_blocks
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM public.public_establishments));
