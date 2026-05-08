
DROP POLICY IF EXISTS "Public can view establishments by slug" ON public.establishments;
CREATE POLICY "Public can view establishments with booking enabled"
ON public.establishments FOR SELECT
USING (booking_enabled = true);

DROP POLICY IF EXISTS "Permissão total de inserção de salão" ON public.establishments;
CREATE POLICY "Users can create their own establishment"
ON public.establishments FOR INSERT
WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Public can read client_tags" ON public.client_tags;

ALTER FUNCTION public.slugify(text) SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.add_billing_interval(timestamp with time zone, text) SET search_path = public;
ALTER FUNCTION public.entitlements_update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.normalize_email(text) SET search_path = public;
ALTER FUNCTION public.check_has_active_entitlement(text) SET search_path = public;
ALTER FUNCTION public.get_professional_appointments(uuid) SET search_path = public;
ALTER FUNCTION public.get_professional_appointments(text, date, date) SET search_path = public;

ALTER VIEW public.appointment_email_jobs_summary SET (security_invoker = true);
