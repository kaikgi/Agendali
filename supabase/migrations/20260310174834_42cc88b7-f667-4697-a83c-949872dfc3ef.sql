-- Drop the partial indexes that don't work with ON CONFLICT
DROP INDEX IF EXISTS public.ux_appointment_email_jobs_dedupe_key;
DROP INDEX IF EXISTS public.idx_appointment_email_jobs_dedupe_key;

-- Create a regular unique constraint (NULLs are distinct, so multiple NULLs are fine)
ALTER TABLE public.appointment_email_jobs ADD CONSTRAINT uq_appointment_email_jobs_dedupe_key UNIQUE (dedupe_key);