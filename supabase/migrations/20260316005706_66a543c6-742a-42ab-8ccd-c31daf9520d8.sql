
-- Add payment_method column to track Pix, card, etc.
ALTER TABLE public.appointment_payments 
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL;

-- Add provider_raw_payload for audit trail
ALTER TABLE public.appointment_payments 
  ADD COLUMN IF NOT EXISTS provider_raw_payload jsonb DEFAULT NULL;
