
-- 1. Update public_create_appointment to use 'pending_approval' status when auto_confirm is OFF
-- and NOT send confirmation email (only send a "pending" notification)
CREATE OR REPLACE FUNCTION public.public_create_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_customer_user_id uuid DEFAULT NULL,
  p_customer_reminder_hours integer DEFAULT NULL
)
RETURNS TABLE(appointment_id uuid, manage_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment record;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_token text;
  v_token_hash text;
  v_clean_email text;
  v_job_result jsonb;
  v_service_name text;
  v_service_duration integer;
  v_professional_name text;
  v_payload jsonb;
  v_status text;
BEGIN
  SELECT id, name, phone, address, slug, max_future_days, auto_confirm_bookings, timezone
  INTO v_establishment
  FROM public.establishments
  WHERE slug = p_slug
    AND booking_enabled = true;

  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado ou agendamento desativado';
  END IF;

  IF btrim(coalesce(p_customer_name, '')) = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF btrim(coalesce(p_customer_phone, '')) = '' THEN
    RAISE EXCEPTION 'Telefone é obrigatório';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Horário inválido';
  END IF;

  IF p_start_at > (now() + (v_establishment.max_future_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Data fora da janela de agendamento permitida (máximo % dias no futuro)', v_establishment.max_future_days;
  END IF;

  IF p_start_at <= now() THEN
    RAISE EXCEPTION 'Não é possível agendar no passado';
  END IF;

  SELECT s.name, s.duration_minutes INTO v_service_name, v_service_duration
  FROM public.services s
  WHERE s.id = p_service_id AND s.establishment_id = v_establishment.id AND s.active = true;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Serviço não encontrado ou indisponível';
  END IF;

  SELECT p.name INTO v_professional_name
  FROM public.professionals p
  WHERE p.id = p_professional_id AND p.establishment_id = v_establishment.id AND p.active = true;

  IF v_professional_name IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado ou indisponível';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professional_services ps
    WHERE ps.professional_id = p_professional_id AND ps.service_id = p_service_id
  ) THEN
    RAISE EXCEPTION 'Este profissional não atende o serviço selecionado';
  END IF;

  -- Check conflicts: include pending_approval in conflict check
  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status IN ('booked', 'confirmed', 'pending_approval')
      AND a.start_at < p_end_at AND a.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro horário.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.time_blocks tb
    WHERE (tb.professional_id = p_professional_id OR (tb.establishment_id = v_establishment.id AND tb.professional_id IS NULL))
      AND tb.start_at < p_end_at AND tb.end_at > p_start_at
  ) THEN
    RAISE EXCEPTION 'Este horário está bloqueado. Escolha outro horário.';
  END IF;

  v_clean_email := nullif(lower(trim(coalesce(p_customer_email, ''))), '');

  -- Determine status
  IF v_establishment.auto_confirm_bookings THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_approval';
  END IF;

  -- Upsert customer
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.establishment_id = v_establishment.id AND c.phone = p_customer_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (establishment_id, name, phone, email)
    VALUES (v_establishment.id, btrim(p_customer_name), p_customer_phone, v_clean_email)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET name = COALESCE(NULLIF(btrim(p_customer_name), ''), name),
        email = COALESCE(v_clean_email, email)
    WHERE id = v_customer_id;
  END IF;

  INSERT INTO public.appointments (
    establishment_id, service_id, professional_id, customer_id,
    customer_user_id, customer_email, customer_phone,
    start_at, end_at, customer_notes, customer_reminder_hours, status
  )
  VALUES (
    v_establishment.id, p_service_id, p_professional_id, v_customer_id,
    p_customer_user_id, v_clean_email, p_customer_phone,
    p_start_at, p_end_at,
    nullif(btrim(coalesce(p_customer_notes, '')), ''),
    p_customer_reminder_hours,
    v_status
  )
  RETURNING id INTO v_appointment_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash)
  VALUES (v_appointment_id, v_token_hash);

  v_payload := jsonb_build_object(
    'customer_name', btrim(p_customer_name),
    'professional_name', v_professional_name,
    'service_name', v_service_name,
    'service_duration', v_service_duration,
    'establishment_name', v_establishment.name,
    'establishment_slug', v_establishment.slug,
    'establishment_phone', v_establishment.phone,
    'establishment_address', v_establishment.address,
    'start_at', p_start_at
  );

  IF v_clean_email IS NOT NULL AND length(v_clean_email) >= 4 THEN
    IF v_status = 'pending_approval' THEN
      -- Send "pending approval" email instead of confirmation
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        v_appointment_id, v_establishment.id, v_clean_email, btrim(p_customer_name),
        'appointment_pending_approval', 'pending', v_payload, now(),
        'appointment_pending:' || v_appointment_id::text
      ) ON CONFLICT (dedupe_key) DO NOTHING;
      -- Do NOT create reminder jobs yet (only after approval)
    ELSE
      -- Auto-confirmed: create confirmation + reminder jobs as before
      v_job_result := public.create_appointment_email_jobs(
        v_appointment_id,
        v_establishment.id,
        v_clean_email,
        btrim(p_customer_name),
        p_start_at,
        v_payload,
        p_customer_reminder_hours
      );
      RAISE LOG 'Email jobs created for appointment %: %', v_appointment_id, v_job_result;
    END IF;
  END IF;

  RETURN QUERY SELECT v_appointment_id, v_token;
END;
$$;

-- 2. Update notify_appointment_status_change to handle pending_approval -> confirmed (approval)
-- and pending_approval -> rejected
CREATE OR REPLACE FUNCTION public.notify_appointment_status_change(
  p_appointment_id uuid,
  p_new_status text,
  p_old_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      -- Handle approval: pending_approval -> confirmed
      IF p_old_status IN ('booked', 'pending_approval') THEN
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
$$;
