-- Add reminder configuration column to establishments
ALTER TABLE public.establishments 
ADD COLUMN reminder_hours_before integer NOT NULL DEFAULT 3;

-- Add comment for documentation
COMMENT ON COLUMN public.establishments.reminder_hours_before IS 'Hours before appointment to send reminder email (0 = disabled)';