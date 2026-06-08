-- 1. Funções Auxiliares de Segurança
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT exists (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.status = 'ativo'
  );
$function$;

CREATE OR REPLACE FUNCTION public.check_access(p_establishment_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Super admin check
  IF public.is_admin() THEN
    RETURN true;
  END IF;

  -- User check (Owner or Member)
  RETURN EXISTS (
    SELECT 1 FROM public.establishments 
    WHERE id = p_establishment_id AND owner_user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.establishment_members 
    WHERE establishment_id = p_establishment_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. ESTABLISHMENTS
DROP POLICY IF EXISTS "admin_all_establishments" ON public.establishments;
DROP POLICY IF EXISTS "owner_member_select_establishments" ON public.establishments;
DROP POLICY IF EXISTS "owner_update_establishments" ON public.establishments;
DROP POLICY IF EXISTS "public_select_active_establishments" ON public.establishments;
DROP POLICY IF EXISTS "authenticated_insert_establishments" ON public.establishments;

CREATE POLICY "admin_all_establishments" ON public.establishments FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_member_select_establishments" ON public.establishments FOR SELECT TO authenticated USING (owner_user_id = auth.uid() OR id IN (SELECT establishment_id FROM public.establishment_members WHERE user_id = auth.uid()));
CREATE POLICY "owner_update_establishments" ON public.establishments FOR UPDATE TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "public_select_active_establishments" ON public.establishments FOR SELECT TO public USING (booking_enabled = true);
CREATE POLICY "authenticated_insert_establishments" ON public.establishments FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_user_id);

-- 3. APPOINTMENTS
DROP POLICY IF EXISTS "admin_all_appointments" ON public.appointments;
DROP POLICY IF EXISTS "staff_all_appointments" ON public.appointments;
DROP POLICY IF EXISTS "customer_select_own_appointments" ON public.appointments;
DROP POLICY IF EXISTS "public_insert_appointments" ON public.appointments;

CREATE POLICY "admin_all_appointments" ON public.appointments FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_appointments" ON public.appointments FOR ALL TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "customer_select_own_appointments" ON public.appointments FOR SELECT TO authenticated USING (customer_user_id = auth.uid());
CREATE POLICY "public_insert_appointments" ON public.appointments FOR INSERT TO public WITH CHECK (true);

-- 4. CUSTOMERS
DROP POLICY IF EXISTS "admin_all_customers" ON public.customers;
DROP POLICY IF EXISTS "staff_all_customers" ON public.customers;
DROP POLICY IF EXISTS "customer_own_profile" ON public.customers;

CREATE POLICY "admin_all_customers" ON public.customers FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_customers" ON public.customers FOR ALL TO authenticated USING (public.check_access(establishment_id));

-- 5. PROFESSIONALS
DROP POLICY IF EXISTS "admin_all_professionals" ON public.professionals;
DROP POLICY IF EXISTS "staff_all_professionals" ON public.professionals;
DROP POLICY IF EXISTS "public_select_professionals" ON public.professionals;
DROP POLICY IF EXISTS "professional_self_manage" ON public.professionals;

CREATE POLICY "admin_all_professionals" ON public.professionals FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_professionals" ON public.professionals FOR ALL TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "professional_self_manage" ON public.professionals FOR ALL TO authenticated USING (user_id = auth.uid());
CREATE POLICY "public_select_professionals" ON public.professionals FOR SELECT TO public USING (establishment_id IN (SELECT id FROM public.establishments WHERE booking_enabled = true));

-- 6. SERVICES
DROP POLICY IF EXISTS "admin_all_services" ON public.services;
DROP POLICY IF EXISTS "staff_all_services" ON public.services;
DROP POLICY IF EXISTS "public_select_services" ON public.services;

CREATE POLICY "admin_all_services" ON public.services FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_all_services" ON public.services FOR ALL TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "public_select_services" ON public.services FOR SELECT TO public USING (establishment_id IN (SELECT id FROM public.establishments WHERE booking_enabled = true));

-- 7. ESTABLISHMENT_MEMBERS
DROP POLICY IF EXISTS "admin_all_members" ON public.establishment_members;
DROP POLICY IF EXISTS "owner_manage_members" ON public.establishment_members;
DROP POLICY IF EXISTS "member_read_own" ON public.establishment_members;

CREATE POLICY "admin_all_members" ON public.establishment_members FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_manage_members" ON public.establishment_members FOR ALL TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));
CREATE POLICY "member_read_own" ON public.establishment_members FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 8. PROFILES
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "user_manage_own_profile" ON public.profiles;

CREATE POLICY "admin_all_profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "user_manage_own_profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- 9. ADMIN_USERS
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_insert" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_update" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_delete" ON public.admin_users;

CREATE POLICY "admin_all_admin_users" ON public.admin_users FOR ALL TO authenticated USING (public.is_admin());

-- 10. SUBSCRIPTIONS
DROP POLICY IF EXISTS "admin_all_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "owner_select_subscriptions" ON public.subscriptions;

CREATE POLICY "admin_all_subscriptions" ON public.subscriptions FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_select_subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

-- 11. PAYMENT_SETTINGS
DROP POLICY IF EXISTS "admin_all_payment_settings" ON public.payment_settings;
DROP POLICY IF EXISTS "owner_manage_payment_settings" ON public.payment_settings;

CREATE POLICY "admin_all_payment_settings" ON public.payment_settings FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "owner_manage_payment_settings" ON public.payment_settings FOR ALL TO authenticated USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

-- 12. APPOINTMENT_PAYMENTS
DROP POLICY IF EXISTS "admin_all_payments" ON public.appointment_payments;
DROP POLICY IF EXISTS "staff_select_payments" ON public.appointment_payments;
DROP POLICY IF EXISTS "customer_select_payments" ON public.appointment_payments;

CREATE POLICY "admin_all_payments" ON public.appointment_payments FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "staff_select_payments" ON public.appointment_payments FOR SELECT TO authenticated USING (public.check_access(establishment_id));
CREATE POLICY "customer_select_payments" ON public.appointment_payments FOR SELECT TO authenticated USING (appointment_id IN (SELECT id FROM public.appointments WHERE customer_user_id = auth.uid()));

-- Grants
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.check_access(uuid) TO authenticated, anon;
