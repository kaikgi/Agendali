
-- Add activation tracking columns to allowed_establishment_signups
ALTER TABLE public.allowed_establishment_signups
ADD COLUMN IF NOT EXISTS activation_sent_at timestamptz;
