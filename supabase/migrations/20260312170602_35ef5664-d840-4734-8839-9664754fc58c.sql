-- RPC: Submit rating via manage token (no auth required)
CREATE OR REPLACE FUNCTION public.public_submit_rating_by_token(
  p_token text,
  p_appointment_id uuid,
  p_stars integer,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
  v_token_record record;
  v_appointment record;
  v_rating_id uuid;
BEGIN
  -- Validate stars
  IF p_stars < 1 OR p_stars > 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nota deve ser entre 1 e 5');
  END IF;

  -- Hash token
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Verify token
  SELECT appointment_id, expires_at
  INTO v_token_record
  FROM public.appointment_manage_tokens
  WHERE token_hash = v_token_hash
    AND appointment_id = p_appointment_id;

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;

  IF v_token_record.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token expirado');
  END IF;

  -- Get appointment
  SELECT id, customer_id, establishment_id, customer_user_id, status
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  -- Only allow rating for completed appointments
  IF v_appointment.status != 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Apenas atendimentos concluídos podem ser avaliados');
  END IF;

  -- Check for duplicate rating
  IF EXISTS (SELECT 1 FROM public.ratings WHERE appointment_id = p_appointment_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este atendimento já foi avaliado');
  END IF;

  -- Insert rating
  INSERT INTO public.ratings (
    appointment_id,
    establishment_id,
    customer_id,
    customer_user_id,
    stars,
    comment
  ) VALUES (
    p_appointment_id,
    v_appointment.establishment_id,
    v_appointment.customer_id,
    v_appointment.customer_user_id,
    p_stars,
    nullif(btrim(coalesce(p_comment, '')), '')
  )
  RETURNING id INTO v_rating_id;

  RETURN jsonb_build_object('success', true, 'rating_id', v_rating_id);
END;
$$;

-- Update notify_appointment_status_change to include manage_token in completed payload
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
  v_manage_token text;
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

  -- Try to get manage token for this appointment (needed for rating link)
  SELECT encode(decode(replace(replace(t.token_hash, chr(10), ''), chr(13), ''), 'hex'), 'hex')
  INTO v_manage_token
  FROM public.appointment_manage_tokens t
  WHERE t.appointment_id = p_appointment_id
  LIMIT 1;

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
    WHEN 'canceled', 'canceled_by_customer', 'canceled_by_establishment' THEN
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
      
      -- For completed emails, include manage_token_hash so the email can build rating link
      IF v_manage_token IS NOT NULL THEN
        v_payload := v_payload || jsonb_build_object('manage_token_hash', v_manage_token);
      END IF;
      
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
      IF p_old_status IN ('booked', 'pending_approval', 'paid_pending_confirmation') THEN
        v_key := 'appointment_confirmed_manual:' || p_appointment_id::text;
        INSERT INTO public.appointment_email_jobs (
          appointment_id, establishment_id, customer_email, customer_name,
          email_type, status, payload, scheduled_for, dedupe_key
        ) VALUES (
          p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
          'appointment_confirmation', 'pending', v_payload, now(), v_key
        ) ON CONFLICT (dedupe_key) DO NOTHING;
        RETURN jsonb_build_object('ok', true, 'action', 'confirmed');
      END IF;
      RETURN jsonb_build_object('ok', true, 'action', 'confirmed_no_email');

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
      v_cancelled_count := public.cancel_pending_appointment_email_jobs(p_appointment_id);
      v_key := 'appointment_rescheduled:' || p_appointment_id::text || ':' || extract(epoch from now())::bigint::text;
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        p_appointment_id, v_apt.establishment_id, v_email, v_customer.name,
        'appointment_rescheduled', 'pending', v_payload, now(), v_key
      );
      RETURN jsonb_build_object('ok', true, 'action', 'rescheduled', 'cancelled_jobs', v_cancelled_count);

    ELSE
      RETURN jsonb_build_object('ok', true, 'action', 'no_email_for_status', 'status', p_new_status);
  END CASE;
END;
$function$;