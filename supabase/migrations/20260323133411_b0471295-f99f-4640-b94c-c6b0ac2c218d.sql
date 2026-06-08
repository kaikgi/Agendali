-- Allow admins to INSERT into allowed_establishment_signups
CREATE POLICY "Admins can insert allowed signups"
ON public.allowed_establishment_signups
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to UPDATE allowed_establishment_signups (they already can via the Auth can mark own signup used, but admins need full access)
CREATE POLICY "Admins can update allowed signups"
ON public.allowed_establishment_signups
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Allow admins to DELETE allowed_establishment_signups
CREATE POLICY "Admins can delete allowed signups"
ON public.allowed_establishment_signups
FOR DELETE
TO authenticated
USING (is_admin(auth.uid()));