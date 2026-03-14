
DROP FUNCTION IF EXISTS public.public_create_appointment(text,uuid,uuid,timestamptz,timestamptz,text,text,text,text,uuid,integer,boolean);

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
  p_customer_reminder_hours integer DEFAULT NULL,
  p_requires_payment boolean DEFAULT false
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
  v_has_bypass boolean;
  v_has_bypass_payment boolean;
BEGIN
  SELECT e.id, e.name, e.phone, e.address, e.slug, e.max_future_days, e.auto_confirm_bookings, e.timezone
  INTO v_establishment
  FROM public.establishments e
  WHERE e.slug = p_slug
    AND e.booking_enabled = true;

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

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.professional_id = p_professional_id
      AND a.status IN ('booked', 'confirmed', 'pending_approval', 'paid_pending_confirmation', 'pending_payment')
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

  -- Determine status: check bypass_payment before requiring payment
  v_has_bypass_payment := public.customer_has_bypass_payment(v_customer_id, v_establishment.id);

  IF p_requires_payment AND NOT v_has_bypass_payment THEN
    v_status := 'pending_payment';
  ELSIF v_establishment.auto_confirm_bookings THEN
    v_status := 'confirmed';
  ELSE
    v_has_bypass := public.customer_has_bypass_approval(v_customer_id, v_establishment.id);
    IF v_has_bypass THEN
      v_status := 'confirmed';
    ELSE
      v_status := 'pending_approval';
    END IF;
  END IF;

  INSERT INTO public.appointments (
    establishment_id, service_id, professional_id, customer_id,
    customer_user_id, customer_email, customer_phone,
    start_at, end_at, customer_notes, customer_reminder_hours, status
  )
  VALUES (
    v_establishment.id, p_service_id, p_professional_id, v_customer_id,
    p_customer_user_id, v_clean_email, p_customer_phone,
    p_start_at, p_end_at, p_customer_notes, p_customer_reminder_hours, v_status
  )
  RETURNING id INTO v_appointment_id;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash)
  VALUES (v_appointment_id, v_token_hash);

  SELECT s.name INTO v_service_name
  FROM public.services s WHERE s.id = p_service_id;

  v_payload := jsonb_build_object(
    'establishment_name', v_establishment.name,
    'establishment_phone', v_establishment.phone,
    'establishment_address', v_establishment.address,
    'establishment_slug', v_establishment.slug,
    'service_name', v_service_name,
    'service_duration', v_service_duration,
    'professional_name', v_professional_name,
    'customer_name', btrim(p_customer_name),
    'start_at', p_start_at,
    'end_at', p_end_at,
    'manage_token', v_token,
    'status', v_status
  );

  IF v_clean_email IS NOT NULL AND v_status NOT IN ('pending_payment') THEN
    v_job_result := public.enqueue_appointment_email(
      v_appointment_id,
      v_establishment.id,
      CASE
        WHEN v_status = 'pending_approval' THEN 'appointment_pending_approval'
        ELSE 'appointment_confirmation'
      END,
      v_clean_email,
      btrim(p_customer_name),
      v_payload,
      now()
    );
  END IF;

  RETURN QUERY SELECT v_appointment_id, v_token;
END;
$$;
