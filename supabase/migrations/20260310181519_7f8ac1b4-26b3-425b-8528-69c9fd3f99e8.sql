
-- Drop the OLD overload (without p_customer_reminder_hours) to prevent PostgREST ambiguity
DROP FUNCTION IF EXISTS public.public_create_appointment(
  text, uuid, uuid, timestamp with time zone, timestamp with time zone,
  text, text, text, text, uuid
);
