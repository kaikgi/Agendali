-- 1. Horários e Categorias
CREATE POLICY "admin_all_business_hours" ON public.business_hours FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_business_hours" ON public.business_hours FOR ALL TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "public_select_business_hours" ON public.business_hours FOR SELECT TO public USING (establishment_id IN (SELECT id FROM public.establishments WHERE booking_enabled = true));

CREATE POLICY "admin_all_professional_hours" ON public.professional_hours FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_professional_hours" ON public.professional_hours FOR ALL TO authenticated 
USING (professional_id IN (SELECT id FROM public.professionals WHERE public.check_access(establishment_id)));
CREATE POLICY "public_select_professional_hours" ON public.professional_hours FOR SELECT TO public 
USING (professional_id IN (SELECT id FROM public.professionals WHERE establishment_id IN (SELECT id FROM public.establishments WHERE booking_enabled = true)));

CREATE POLICY "admin_all_service_categories" ON public.service_categories FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_service_categories" ON public.service_categories FOR ALL TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "public_select_service_categories" ON public.service_categories FOR SELECT TO public USING (establishment_id IN (SELECT id FROM public.establishments WHERE booking_enabled = true));

-- 2. Time Blocks
CREATE POLICY "admin_all_time_blocks" ON public.time_blocks FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_time_blocks" ON public.time_blocks FOR ALL TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "public_select_time_blocks" ON public.time_blocks FOR SELECT TO public USING (establishment_id IN (SELECT id FROM public.establishments WHERE booking_enabled = true));

CREATE POLICY "admin_all_recurring_time_blocks" ON public.recurring_time_blocks FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_recurring_time_blocks" ON public.recurring_time_blocks FOR ALL TO authenticated USING (public.check_access(establishment_id));

-- 3. Comissões
CREATE POLICY "admin_all_commission_rules" ON public.commission_rules FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_manage_commission_rules" ON public.commission_rules FOR ALL TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

CREATE POLICY "admin_all_commission_entries" ON public.commission_entries FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_manage_commission_entries" ON public.commission_entries FOR ALL TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));
CREATE POLICY "professional_select_own_commissions" ON public.commission_entries FOR SELECT TO authenticated USING (professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid()));

-- 4. Tags e Notificações
CREATE POLICY "admin_all_client_tags" ON public.client_tags FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_client_tags" ON public.client_tags FOR ALL TO authenticated USING (public.check_access(establishment_id));

CREATE POLICY "admin_all_establishment_notifications" ON public.establishment_notifications FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_notifications" ON public.establishment_notifications FOR ALL TO authenticated USING (public.check_access(establishment_id));

-- 5. Audit, Privacy e Legal
CREATE POLICY "admin_all_audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_select_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

CREATE POLICY "admin_all_privacy_requests" ON public.privacy_requests FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_select_privacy_requests" ON public.privacy_requests FOR SELECT TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

CREATE POLICY "admin_all_legal_acceptance" ON public.legal_acceptance_logs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_select_legal_acceptance" ON public.legal_acceptance_logs FOR SELECT TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

-- 6. Tokens de Gestão (Public Access)
CREATE POLICY "admin_all_manage_tokens" ON public.appointment_manage_tokens FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "public_select_manage_tokens" ON public.appointment_manage_tokens FOR SELECT TO public USING (true);
CREATE POLICY "public_insert_manage_tokens" ON public.appointment_manage_tokens FOR INSERT TO public WITH CHECK (true);

-- 7. Ratings e Termos Aceitos
CREATE POLICY "admin_all_ratings" ON public.ratings FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_select_ratings" ON public.ratings FOR SELECT TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "public_insert_ratings" ON public.ratings FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "admin_all_accepted_terms" ON public.appointment_accepted_terms FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_select_accepted_terms" ON public.appointment_accepted_terms FOR SELECT TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "public_insert_accepted_terms" ON public.appointment_accepted_terms FOR INSERT TO public WITH CHECK (true);
