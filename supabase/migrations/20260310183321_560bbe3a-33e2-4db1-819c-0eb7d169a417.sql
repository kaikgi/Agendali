
-- Update public_create_appointment to populate payload with all data the worker needs
CREATE OR REPLACE FUNCTION public.public_create_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_start_at timestamp with time zone,
  p_end_at timestamp with time zone,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_notes text DEFAULT NULL::text,
  p_customer_user_id uuid DEFAULT NULL::uuid,
  p_customer_reminder_hours integer DEFAULT NULL::integer
)
RETURNS TABLE(appointment_id uuid, manage_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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

  -- Validate service
  SELECT s.name, s.duration_minutes INTO v_service_name, v_service_duration
  FROM public.services s
  WHERE s.id = p_service_id AND s.establishment_id = v_establishment.id AND s.active = true;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Serviço não encontrado ou indisponível';
  END IF;

  -- Validate professional
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

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status IN ('booked', 'confirmed')
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

  -- Create appointment
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
    CASE WHEN v_establishment.auto_confirm_bookings THEN 'confirmed' ELSE 'booked' END
  )
  RETURNING id INTO v_appointment_id;

  -- Generate manage token
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash)
  VALUES (v_appointment_id, v_token_hash);

  -- Build rich payload with ALL data the email worker needs
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

  -- Create email jobs atomically
  IF v_clean_email IS NOT NULL AND length(v_clean_email) >= 4 THEN
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

  RETURN QUERY SELECT v_appointment_id, v_token;
END;
$function$;
