
-- Allow public inserts into appointment_accepted_terms (needed for guest bookings)
CREATE POLICY "Public can insert accepted terms"
  ON public.appointment_accepted_terms
  FOR INSERT
  TO public
  WITH CHECK (true);
