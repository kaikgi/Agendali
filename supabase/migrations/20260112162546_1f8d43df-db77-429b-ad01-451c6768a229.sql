-- Add description column to plans table
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS description text;

-- Add popular flag column
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS popular boolean NOT NULL DEFAULT false;