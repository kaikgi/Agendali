-- Add new columns for more complete establishment information
ALTER TABLE public.establishments 
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS instagram text;

-- Add unique constraint for business_hours upsert to work correctly
ALTER TABLE public.business_hours 
ADD CONSTRAINT business_hours_establishment_weekday_unique 
UNIQUE (establishment_id, weekday);