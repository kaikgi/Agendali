CREATE OR REPLACE FUNCTION public.recreate_appointment_email_jobs_for_reschedule(
  p_appointment_id uuid,
  p_establishment_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_new_appointment_start timestamp with time zone,
  p_payload jsonb DEFAULT '{}'::jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cancelled_count integer;
  v_key text;
  v_reminder_hours integer;
begin
  v_cancelled_count := public.cancel_pending_appointment_email_jobs(p_appointment_id);

  -- Get customer's reminder preference from the appointment
  SELECT a.customer_reminder_hours INTO v_reminder_hours
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  v_key := 'appointment_rescheduled:' || p_appointment_id::text || ':' || extract(epoch from now())::bigint::text;

  insert into public.appointment_email_jobs (
    appointment_id, establishment_id, customer_email, customer_name,
    email_type, status, payload, scheduled_for, dedupe_key
  )
  values (
    p_appointment_id, p_establishment_id,
    lower(trim(p_customer_email)), p_customer_name,
    'appointment_rescheduled', 'pending',
    coalesce(p_payload, '{}'::jsonb), now(), v_key
  );

  perform public.create_appointment_email_jobs(
    p_appointment_id,
    p_establishment_id,
    p_customer_email,
    p_customer_name,
    p_new_appointment_start,
    p_payload,
    v_reminder_hours
  );

  return jsonb_build_object(
    'ok', true,
    'cancelled_jobs', v_cancelled_count,
    'appointment_id', p_appointment_id
  );
end;
$function$;