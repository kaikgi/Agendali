CREATE OR REPLACE FUNCTION public.create_appointment_email_jobs(
  p_appointment_id uuid,
  p_establishment_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_appointment_start timestamp with time zone,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_customer_reminder_hours integer DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text;
  v_now timestamptz := now();
  v_confirmation_key text;
  v_reminder_key text;
begin
  v_email := lower(trim(p_customer_email));

  if v_email is null or length(v_email) < 4 then
    return jsonb_build_object(
      'ok', false,
      'reason', 'invalid_email'
    );
  end if;

  -- Confirmação imediata
  v_confirmation_key := 'appointment_confirmation:' || p_appointment_id::text;

  insert into public.appointment_email_jobs (
    appointment_id, establishment_id, customer_email, customer_name,
    email_type, status, payload, scheduled_for, dedupe_key
  )
  values (
    p_appointment_id, p_establishment_id, v_email, p_customer_name,
    'appointment_confirmation', 'pending',
    coalesce(p_payload, '{}'::jsonb), v_now, v_confirmation_key
  )
  on conflict (dedupe_key) do nothing;

  -- Lembrete baseado na escolha do cliente
  if p_customer_reminder_hours is not null and p_customer_reminder_hours > 0 then
    if p_appointment_start > (v_now + (p_customer_reminder_hours || ' hours')::interval) then
      v_reminder_key := 'appointment_reminder_' || p_customer_reminder_hours || 'h:' || p_appointment_id::text;

      insert into public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      )
      values (
        p_appointment_id, p_establishment_id, v_email, p_customer_name,
        'appointment_reminder_' || p_customer_reminder_hours || 'h', 'pending',
        coalesce(p_payload, '{}'::jsonb),
        p_appointment_start - (p_customer_reminder_hours || ' hours')::interval,
        v_reminder_key
      )
      on conflict (dedupe_key) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'appointment_id', p_appointment_id
  );
end;
$function$;