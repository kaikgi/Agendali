
-- Reset any failed/processing jobs back to pending so the new worker can reprocess them
UPDATE public.appointment_email_jobs
SET status = 'pending', attempts = 0, last_error = NULL, updated_at = now()
WHERE status IN ('failed', 'processing')
  AND email_type = 'appointment_confirmation'
  AND sent_at IS NULL;
