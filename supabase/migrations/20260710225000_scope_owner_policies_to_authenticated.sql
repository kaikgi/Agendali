DROP POLICY IF EXISTS "Owner can select professionals" ON public.professionals;
CREATE POLICY "Owner can select professionals" ON public.professionals
  FOR SELECT TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can select services" ON public.services;
CREATE POLICY "Owner can select services" ON public.services
  FOR SELECT TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can select professional_services" ON public.professional_services;
CREATE POLICY "Owner can select professional_services" ON public.professional_services
  FOR SELECT TO authenticated
  USING (professional_id IN (
    SELECT p.id FROM public.professionals p
    WHERE p.establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid())
  ));
DROP POLICY IF EXISTS "Owners can view audit logs for their establishment" ON public.audit_logs;
CREATE POLICY "Owners can view audit logs for their establishment" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = audit_logs.establishment_id AND e.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view establishment acceptances" ON public.legal_acceptance_logs;
CREATE POLICY "Owners can view establishment acceptances" ON public.legal_acceptance_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = legal_acceptance_logs.establishment_id AND e.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owners can view privacy requests for their establishment" ON public.privacy_requests;
CREATE POLICY "Owners can view privacy requests for their establishment" ON public.privacy_requests
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.establishments e WHERE e.id = privacy_requests.establishment_id AND e.owner_user_id = auth.uid()));
DROP POLICY IF EXISTS "Owner can delete professional_services" ON public.professional_services;
CREATE POLICY "Owner can delete professional_services" ON public.professional_services
  FOR DELETE TO authenticated
  USING (professional_id IN (SELECT p.id FROM public.professionals p WHERE p.establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid())));

DROP POLICY IF EXISTS "Owner can insert professional_services" ON public.professional_services;
CREATE POLICY "Owner can insert professional_services" ON public.professional_services
  FOR INSERT TO authenticated
  WITH CHECK (professional_id IN (SELECT p.id FROM public.professionals p WHERE p.establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid())));

DROP POLICY IF EXISTS "Owner can delete professionals" ON public.professionals;
CREATE POLICY "Owner can delete professionals" ON public.professionals
  FOR DELETE TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can insert professionals" ON public.professionals;
CREATE POLICY "Owner can insert professionals" ON public.professionals
  FOR INSERT TO authenticated
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can update professionals" ON public.professionals;
CREATE POLICY "Owner can update professionals" ON public.professionals
  FOR UPDATE TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can delete services" ON public.services;
CREATE POLICY "Owner can delete services" ON public.services
  FOR DELETE TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can update services" ON public.services;
CREATE POLICY "Owner can update services" ON public.services
  FOR UPDATE TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "Owner can insert services" ON public.services;
CREATE POLICY "Owner can insert services" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));
