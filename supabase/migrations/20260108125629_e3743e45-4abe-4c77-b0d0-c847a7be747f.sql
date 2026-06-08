-- Fix RLS: Allow public (anon) to INSERT customers for booking flow
-- The existing policy "Public can insert customers" uses restrictive mode but needs to allow anon role

-- Drop existing restrictive policy and create permissive one for anon
DROP POLICY IF EXISTS "Public can insert customers" ON public.customers;

CREATE POLICY "Public can insert customers"
ON public.customers
FOR INSERT
TO anon
WITH CHECK (
  establishment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.establishments e 
    WHERE e.id = customers.establishment_id 
    AND e.booking_enabled = true
  )
);

-- Fix RLS: Allow public (anon) to INSERT appointments for booking flow
DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;

CREATE POLICY "Public can insert appointments"
ON public.appointments
FOR INSERT
TO anon
WITH CHECK (
  establishment_id IS NOT NULL
  AND professional_id IS NOT NULL
  AND service_id IS NOT NULL
  AND customer_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.establishments e 
    WHERE e.id = appointments.establishment_id 
    AND e.booking_enabled = true
  )
);

-- Fix RLS: Allow public (anon) to INSERT appointment_manage_tokens
DROP POLICY IF EXISTS "System can insert tokens" ON public.appointment_manage_tokens;

CREATE POLICY "Public can insert tokens"
ON public.appointment_manage_tokens
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.establishments e ON e.id = a.establishment_id
    WHERE a.id = appointment_manage_tokens.appointment_id
    AND e.booking_enabled = true
  )
);