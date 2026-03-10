ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS customer_reminder_hours integer DEFAULT NULL;

COMMENT ON COLUMN public.appointments.customer_reminder_hours IS 'Hours before appointment to send reminder (null = no reminder, chosen by client)';