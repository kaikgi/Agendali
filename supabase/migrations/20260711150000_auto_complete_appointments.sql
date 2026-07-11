-- Auto-complete appointments once their time window has passed, so completion (and the
-- existing trg_appointment_status_email trigger -> "please rate" email) doesn't depend on
-- someone having the app open to confirm it manually. Manual completion (establishment
-- dashboard, professional portal) already existed and keeps working exactly as before.
--
-- Also fixes a real bug found along the way: useUpdateAppointmentStatus (establishment
-- dashboard "mark completed" button) sets completed_by = 'owner', but the CHECK constraint
-- on this column never allowed that value - only ('customer','establishment','professional').
-- That manual button has been silently failing with a constraint violation.
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT con.conname INTO v_constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
  WHERE rel.relname = 'appointments' AND con.contype = 'c' AND att.attname = 'completed_by';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.appointments ADD CONSTRAINT appointments_completed_by_check
  CHECK (completed_by IN ('customer', 'establishment', 'professional', 'owner', 'system'));

CREATE OR REPLACE FUNCTION public.auto_complete_past_appointments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.appointments
  SET status = 'completed'::appointment_status,
      completed_at = end_at,
      completed_by = 'system'
  WHERE status IN ('booked', 'confirmed')
    AND end_at <= now();
END;
$$;

SELECT cron.schedule(
  'auto-complete-appointments',
  '*/5 * * * *',
  $$ SELECT public.auto_complete_past_appointments(); $$
);
