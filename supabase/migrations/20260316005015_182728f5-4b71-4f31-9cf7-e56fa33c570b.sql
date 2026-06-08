
-- Table to persist the exact terms accepted by the client at booking time
CREATE TABLE public.appointment_accepted_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  terms_type text NOT NULL, -- 'no_payment', 'deposit', 'full_payment_online'
  terms_text text NOT NULL,
  terms_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

ALTER TABLE public.appointment_accepted_terms ENABLE ROW LEVEL SECURITY;

-- Owner can read terms for their establishment
CREATE POLICY "Owner can read accepted terms"
  ON public.appointment_accepted_terms
  FOR SELECT
  TO authenticated
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()
  ));

-- Public can read terms for booking-enabled establishments (client area)
CREATE POLICY "Public can read accepted terms for booking"
  ON public.appointment_accepted_terms
  FOR SELECT
  TO public
  USING (establishment_id IN (
    SELECT id FROM public.establishments WHERE booking_enabled = true
  ));

-- Admin can read all
CREATE POLICY "Admin can read all accepted terms"
  ON public.appointment_accepted_terms
  FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));
