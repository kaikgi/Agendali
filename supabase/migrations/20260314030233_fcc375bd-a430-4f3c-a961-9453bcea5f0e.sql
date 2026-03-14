
CREATE OR REPLACE FUNCTION public.enqueue_appointment_email(
  p_appointment_id uuid,
  p_establishment_id uuid,
  p_email_type text,
  p_customer_email text,
  p_customer_name text,
  p_payload jsonb,
  p_scheduled_for timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_dedupe_key text;
BEGIN
  -- Build dedupe key to prevent duplicate emails
  v_dedupe_key := p_appointment_id || ':' || p_email_type;

  -- Check if an identical job already exists and is pending
  SELECT id INTO v_job_id
  FROM public.appointment_email_jobs
  WHERE dedupe_key = v_dedupe_key
    AND status = 'pending'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'duplicate', 'job_id', v_job_id);
  END IF;

  INSERT INTO public.appointment_email_jobs (
    appointment_id,
    establishment_id,
    email_type,
    customer_email,
    customer_name,
    payload,
    scheduled_for,
    dedupe_key,
    status
  ) VALUES (
    p_appointment_id,
    p_establishment_id,
    p_email_type,
    p_customer_email,
    p_customer_name,
    p_payload,
    p_scheduled_for,
    v_dedupe_key,
    'pending'
  )
  RETURNING id INTO v_job_id;

  RETURN jsonb_build_object('status', 'queued', 'job_id', v_job_id);
END;
$$;
