
CREATE OR REPLACE FUNCTION public.notify_appointment_status_change(p_appointment_id uuid, p_new_status text, p_old_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_apt record;
  v_customer record;
  v_service record;
  v_professional record;
  v_establishment record;
  v_payload jsonb;
  v_email text;
  v_key text;
  v_cancelled_count integer;
BEGIN
  SELECT * INTO v_apt FROM public.appointments WHERE id = p_appointment_id;
  IF v_apt IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'APPOINTMENT_NOT_FOUND');
  END IF;

  IF p_old_status IS NOT NULL AND p_old_status = p_new_status AND p_new_status != 'rescheduled' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_change');
  END IF;

  v_email := v_apt.customer_email;
  IF v_email IS NULL OR length(trim(v_email)) < 4 THEN
    SELECT email INTO v_email FROM public.customers WHERE id = v_apt.customer_id;
  END IF;

  IF v_email IS NULL OR length(trim(v_email)) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_customer_email');
  END IF;

  v_email := lower(trim(v_email));

  SELECT name INTO v_customer FROM public.customers WHERE id = v_apt.customer_id;
  SELECT name, duration_minutes INTO v_service FROM public.services WHERE id = v_apt.service_id;
  SELECT name INTO v_professional FROM public.professionals WHERE id = v_apt.professional_id;
  SELECT name, slug, phone, address INTO v_establishment FROM public.establishments WHERE id = v_apt.establishment_id;

  v_payload := jsonb_build_object(
    'customer_name', coalesce(v_customer.name, 'Cliente'),
    'professional_name', coalesce(v_professional.name, 'Profissional'),
    'service_name', coalesce(v_service.name, 'Serviço'),
    'service_duration', coalesce(v_service.duration_minutes, 30),
    'establishment_name', coalesce(v_establishment.name, 'Agendali'),
    'establishment_slug', coalesce(v_establishment.slug, 'agendali'),
    'establishment_phone', v_establishment.phone,
    'establishment_address', v_establishment.address,
    'start_at', v_apt.start_at
  );

  CASE p_new_status
    WHEN 'canceled' THEN
      v_cancelled_count := public.cancel_pending_appointment_email_jobs(p_appointment_id);
      v_key := 'appointment_cancelled:' || p_appointment_id::text || ':' || extract(epoch from now())::bigint::text;
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
        'appointment_cancelled', 'pending', v_payload, now(), v_key
      );
      RETURN jsonb_build_object('ok', true, 'action', 'cancelled', 'cancelled_jobs', v_cancelled_count);

    WHEN 'completed' THEN
      v_cancelled_count := public.cancel_pending_appointment_email_jobs(p_appointment_id);
      v_key := 'appointment_completed:' || p_appointment_id::text;
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
        'appointment_completed', 'pending', v_payload, now(), v_key
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      RETURN jsonb_build_object('ok', true, 'action', 'completed', 'cancelled_jobs', v_cancelled_count);

    WHEN 'no_show' THEN
      v_cancelled_count := public.cancel_pending_appointment_email_jobs(p_appointment_id);
      v_key := 'appointment_no_show:' || p_appointment_id::text;
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
        'appointment_no_show', 'pending', v_payload, now(), v_key
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      RETURN jsonb_build_object('ok', true, 'action', 'no_show', 'cancelled_jobs', v_cancelled_count);

    WHEN 'confirmed' THEN
      -- Handle approval: pending_approval OR paid_pending_confirmation -> confirmed
      IF p_old_status IN ('booked', 'pending_approval', 'paid_pending_confirmation') THEN
        v_key := 'appointment_confirmed_manual:' || p_appointment_id::text;
        INSERT INTO public.appointment_email_jobs (
          appointment_id, establishment_id, customer_email, customer_name,
          email_type, status, payload, scheduled_for, dedupe_key
        ) VALUES (
          p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
          'appointment_confirmation', 'pending', v_payload, now(), v_key
        ) ON CONFLICT (dedupe_key) DO NOTHING;

        -- Also create reminder job now that it's approved
        IF v_apt.customer_reminder_hours IS NOT NULL AND v_apt.customer_reminder_hours > 0 THEN
          DECLARE
            v_reminder_time timestamptz;
          BEGIN
            v_reminder_time := v_apt.start_at - (v_apt.customer_reminder_hours || ' hours')::interval;
            IF v_reminder_time > now() THEN
              INSERT INTO public.appointment_email_jobs (
                appointment_id, establishment_id, customer_email, customer_name,
                email_type, status, payload, scheduled_for, dedupe_key
              ) VALUES (
                p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
                'appointment_reminder', 'pending', v_payload, v_reminder_time,
                'appointment_reminder:' || p_appointment_id::text
              ) ON CONFLICT (dedupe_key) DO NOTHING;
            END IF;
          END;
        END IF;

        RETURN jsonb_build_object('ok', true, 'action', 'confirmed');
      END IF;
      RETURN jsonb_build_object('ok', true, 'reason', 'no_action_needed');

    WHEN 'rejected' THEN
      v_cancelled_count := public.cancel_pending_appointment_email_jobs(p_appointment_id);
      v_key := 'appointment_rejected:' || p_appointment_id::text;
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
        'appointment_rejected', 'pending', v_payload, now(), v_key
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      RETURN jsonb_build_object('ok', true, 'action', 'rejected', 'cancelled_jobs', v_cancelled_count);

    WHEN 'rescheduled' THEN
      PERFORM public.recreate_appointment_email_jobs_for_reschedule(
        p_appointment_id,
        v_apt.establishment_id,
        v_email,
        coalesce(v_customer.name, 'Cliente'),
        v_apt.start_at,
        v_payload
      );
      RETURN jsonb_build_object('ok', true, 'action', 'rescheduled');

    ELSE
      RETURN jsonb_build_object('ok', true, 'reason', 'unhandled_status');
  END CASE;
END;
$function$;
