-- Add RLS policies for professional_hours so public booking can read them
-- and owners can manage them

-- Public read for booking-enabled establishments
CREATE POLICY "Public can read professional_hours for booking"
  ON public.professional_hours
  FOR SELECT
  TO public
  USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.establishment_id IN (
        SELECT e.id FROM public.establishments e
        WHERE e.booking_enabled = true
      )
    )
  );

-- Owner can manage professional_hours
CREATE POLICY "Owner can manage professional_hours"
  ON public.professional_hours
  FOR ALL
  TO authenticated
  USING (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.establishment_id IN (
        SELECT e.id FROM public.establishments e
        WHERE e.owner_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    professional_id IN (
      SELECT p.id FROM public.professionals p
      WHERE p.establishment_id IN (
        SELECT e.id FROM public.establishments e
        WHERE e.owner_user_id = auth.uid()
      )
    )
  );