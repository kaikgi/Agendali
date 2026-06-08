
-- Add account_type column to profiles table
-- Values: 'customer' (client), 'establishment_owner' (establishment)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'customer';

-- Update existing establishment owners based on establishments table
UPDATE public.profiles
SET account_type = 'establishment_owner'
WHERE id IN (
  SELECT DISTINCT owner_user_id FROM public.establishments
);

-- Also update based on establishment_members
UPDATE public.profiles
SET account_type = 'establishment_owner'
WHERE id IN (
  SELECT DISTINCT user_id FROM public.establishment_members
) AND account_type = 'customer';
