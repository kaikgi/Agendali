-- Allow clients to read their own appointment payments
CREATE POLICY "Client can read own appointment_payments"
ON public.appointment_payments
FOR SELECT
TO authenticated
USING (
  appointment_id IN (
    SELECT id FROM public.appointments
    WHERE customer_user_id = auth.uid()
  )
);