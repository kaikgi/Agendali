-- Fix: "function is_admin() is not unique"
-- Root cause: is_admin(uuid DEFAULT auth.uid()) was introduced alongside the legacy
-- is_admin() (zero-arg), making any bare is_admin() call ambiguous. 23 policies used
-- the bare form. Repoint them to the explicit is_admin(auth.uid()) call, then drop the
-- legacy zero-arg overload since nothing references it anymore.

DROP POLICY IF EXISTS "admin_all_accepted_terms" ON public.appointment_accepted_terms;
CREATE POLICY "admin_all_accepted_terms" ON public.appointment_accepted_terms FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "appointment_email_jobs_admin_all" ON public.appointment_email_jobs;
CREATE POLICY "appointment_email_jobs_admin_all" ON public.appointment_email_jobs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_manage_tokens" ON public.appointment_manage_tokens;
CREATE POLICY "admin_all_manage_tokens" ON public.appointment_manage_tokens FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_payments" ON public.appointment_payments;
CREATE POLICY "admin_all_payments" ON public.appointment_payments FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_appointments" ON public.appointments;
CREATE POLICY "admin_all_appointments" ON public.appointments FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_all_audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_business_hours" ON public.business_hours;
CREATE POLICY "admin_all_business_hours" ON public.business_hours FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_client_tags" ON public.client_tags;
CREATE POLICY "admin_all_client_tags" ON public.client_tags FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_commission_entries" ON public.commission_entries;
CREATE POLICY "admin_all_commission_entries" ON public.commission_entries FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_commission_rules" ON public.commission_rules;
CREATE POLICY "admin_all_commission_rules" ON public.commission_rules FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_customers" ON public.customers;
CREATE POLICY "admin_all_customers" ON public.customers FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_establishment_notifications" ON public.establishment_notifications;
CREATE POLICY "admin_all_establishment_notifications" ON public.establishment_notifications FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_legal_acceptance" ON public.legal_acceptance_logs;
CREATE POLICY "admin_all_legal_acceptance" ON public.legal_acceptance_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_payment_settings" ON public.payment_settings;
CREATE POLICY "admin_all_payment_settings" ON public.payment_settings FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_privacy_requests" ON public.privacy_requests;
CREATE POLICY "admin_all_privacy_requests" ON public.privacy_requests FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_professional_hours" ON public.professional_hours;
CREATE POLICY "admin_all_professional_hours" ON public.professional_hours FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_professionals" ON public.professionals;
CREATE POLICY "admin_all_professionals" ON public.professionals FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_ratings" ON public.ratings;
CREATE POLICY "admin_all_ratings" ON public.ratings FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_recurring_time_blocks" ON public.recurring_time_blocks;
CREATE POLICY "admin_all_recurring_time_blocks" ON public.recurring_time_blocks FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_service_categories" ON public.service_categories;
CREATE POLICY "admin_all_service_categories" ON public.service_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_services" ON public.services;
CREATE POLICY "admin_all_services" ON public.services FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "signup_tokens_admin_all" ON public.signup_tokens;
CREATE POLICY "signup_tokens_admin_all" ON public.signup_tokens FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin_all_time_blocks" ON public.time_blocks;
CREATE POLICY "admin_all_time_blocks" ON public.time_blocks FOR ALL TO authenticated USING (public.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.is_admin();
