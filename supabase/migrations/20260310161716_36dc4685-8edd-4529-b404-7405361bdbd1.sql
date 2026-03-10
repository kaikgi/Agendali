-- Drop the OLD overload (without p_customer_reminder_hours) to resolve PostgREST ambiguity
DROP FUNCTION IF EXISTS public.create_appointment_email_jobs(uuid, uuid, text, text, timestamptz, jsonb);
