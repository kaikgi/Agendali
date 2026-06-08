-- Allow owner to SELECT professional_services
CREATE POLICY "Owner can select professional_services"
ON public.professional_services
FOR SELECT
USING (
  professional_id IN (
    SELECT p.id FROM public.professionals p
    WHERE p.establishment_id IN (
      SELECT e.id FROM public.establishments e WHERE e.owner_user_id = auth.uid()
    )
  )
  OR
  professional_id IN (
    SELECT p.id FROM public.professionals p
    WHERE p.establishment_id IN (
      SELECT e.id FROM public.establishments e WHERE e.booking_enabled = true
    )
  )
);

-- Allow owner to INSERT professional_services
CREATE POLICY "Owner can insert professional_services"
ON public.professional_services
FOR INSERT
WITH CHECK (
  professional_id IN (
    SELECT p.id FROM public.professionals p
    WHERE p.establishment_id IN (
      SELECT e.id FROM public.establishments e WHERE e.owner_user_id = auth.uid()
    )
  )
);

-- Allow owner to DELETE professional_services
CREATE POLICY "Owner can delete professional_services"
ON public.professional_services
FOR DELETE
USING (
  professional_id IN (
    SELECT p.id FROM public.professionals p
    WHERE p.establishment_id IN (
      SELECT e.id FROM public.establishments e WHERE e.owner_user_id = auth.uid()
    )
  )
);