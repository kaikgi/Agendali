
-- Professionals: owner can do everything
CREATE POLICY "Owner can select professionals"
  ON public.professionals FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
    OR
    establishment_id IN (
      SELECT id FROM public.establishments WHERE booking_enabled = true
    )
  );

CREATE POLICY "Owner can insert professionals"
  ON public.professionals FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update professionals"
  ON public.professionals FOR UPDATE
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete professionals"
  ON public.professionals FOR DELETE
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  );

-- Services: owner can do everything, public can read for booking
CREATE POLICY "Owner can select services"
  ON public.services FOR SELECT
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
    OR
    establishment_id IN (
      SELECT id FROM public.establishments WHERE booking_enabled = true
    )
  );

CREATE POLICY "Owner can insert services"
  ON public.services FOR INSERT
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can update services"
  ON public.services FOR UPDATE
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Owner can delete services"
  ON public.services FOR DELETE
  USING (
    establishment_id IN (
      SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
    )
  );
