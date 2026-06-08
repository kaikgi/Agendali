
-- =============================================
-- Fix RLS policies for tables with RLS enabled but NO policies
-- This is causing empty query results across the app
-- =============================================

-- 1. BUSINESS_HOURS: owner can CRUD, public can read (for booking page)
CREATE POLICY "Owner can manage business_hours"
ON public.business_hours
FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

CREATE POLICY "Public can read business_hours"
ON public.business_hours
FOR SELECT
TO public
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE booking_enabled = true
));

-- 2. APPOINTMENTS: owner can CRUD, public can read own establishment's
CREATE POLICY "Owner can manage appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

CREATE POLICY "Public can read appointments for booking"
ON public.appointments
FOR SELECT
TO public
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE booking_enabled = true
));

-- 3. TIME_BLOCKS: owner can CRUD, public can read
CREATE POLICY "Owner can manage time_blocks"
ON public.time_blocks
FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

CREATE POLICY "Public can read time_blocks for booking"
ON public.time_blocks
FOR SELECT
TO public
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE booking_enabled = true
));

-- 4. RECURRING_TIME_BLOCKS: owner can CRUD, public can read
CREATE POLICY "Owner can manage recurring_time_blocks"
ON public.recurring_time_blocks
FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

CREATE POLICY "Public can read recurring_time_blocks for booking"
ON public.recurring_time_blocks
FOR SELECT
TO public
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE booking_enabled = true
));

-- 5. CUSTOMERS: owner can CRUD
CREATE POLICY "Owner can manage customers"
ON public.customers
FOR ALL
TO authenticated
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
))
WITH CHECK (establishment_id IN (
  SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
));

-- Customers also need read access for client portal
CREATE POLICY "Public can read customers for booking"
ON public.customers
FOR SELECT
TO public
USING (establishment_id IN (
  SELECT id FROM public.establishments WHERE booking_enabled = true
));
