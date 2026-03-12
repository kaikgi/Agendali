
-- ===================================================================
-- 1) Fix public_create_appointment to use p_requires_payment parameter
-- ===================================================================
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
SET search_path = 'public'
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
BEGIN
  SELECT id, name, phone, address, slug, max_future_days, auto_confirm_bookings, timezone
  INTO v_establishment
  FROM public.establishments
  WHERE establishments.slug = p_slug
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

  -- Check conflicts
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

  -- Determine status
  IF p_requires_payment THEN
    -- Payment required: start as pending_payment regardless of approval settings
    v_status := 'pending_payment';
  ELSIF v_establishment.auto_confirm_bookings THEN
    v_status := 'confirmed';
  ELSE
    -- Check if customer has a tag with bypass_approval
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
    p_start_at, p_end_at,
    nullif(btrim(coalesce(p_customer_notes, '')), ''),
    p_customer_reminder_hours,
    v_status
  )
  RETURNING id INTO v_appointment_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash)
  VALUES (v_appointment_id, v_token_hash);

  -- Build payload for email jobs
  v_payload := jsonb_build_object(
    'establishment_name', v_establishment.name,
    'establishment_phone', v_establishment.phone,
    'establishment_address', v_establishment.address,
    'establishment_slug', v_establishment.slug,
    'service_name', v_service_name,
    'service_duration', v_service_duration,
    'professional_name', v_professional_name,
    'start_at', p_start_at,
    'end_at', p_end_at,
    'customer_name', btrim(p_customer_name),
    'customer_phone', p_customer_phone,
    'manage_token', v_token,
    'appointment_status', v_status
  );

  -- Create email jobs based on status
  IF v_clean_email IS NOT NULL THEN
    IF v_status = 'confirmed' THEN
      SELECT public.create_appointment_email_jobs(
        p_appointment_id := v_appointment_id,
        p_appointment_start := p_start_at,
        p_customer_email := v_clean_email,
        p_customer_name := btrim(p_customer_name),
        p_establishment_id := v_establishment.id,
        p_customer_reminder_hours := p_customer_reminder_hours,
        p_payload := v_payload
      ) INTO v_job_result;
    ELSIF v_status = 'pending_approval' THEN
      INSERT INTO public.appointment_email_jobs (
        appointment_id, establishment_id, customer_email, customer_name,
        email_type, status, payload, scheduled_for, dedupe_key
      ) VALUES (
        v_appointment_id, v_establishment.id, v_clean_email, btrim(p_customer_name),
        'appointment_pending_approval', 'pending', v_payload, now(),
        'appointment_pending:' || v_appointment_id::text
      ) ON CONFLICT (dedupe_key) DO NOTHING;
    END IF;
    -- For pending_payment status, no email until payment is confirmed
  END IF;

  RETURN QUERY SELECT v_appointment_id, v_token;
END;
$$;

-- ===================================================================
-- 2) Update professional_update_appointment_status to support arrived + in_service
-- ===================================================================
CREATE OR REPLACE FUNCTION public.professional_update_appointment_status(
  p_token text,
  p_appointment_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_appointment record;
  v_old_status text;
  v_message text;
BEGIN
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  -- Validate new status - full set of transitions
  IF p_new_status NOT IN ('confirmed', 'arrived', 'in_service', 'completed', 'canceled', 'no_show', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Status inválido');
  END IF;

  -- Get appointment and verify it belongs to this professional
  SELECT a.* INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.professional_id = v_professional_id;

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  v_old_status := v_appointment.status;

  -- Check current status allows transition
  IF v_old_status IN ('completed', 'canceled', 'no_show', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi finalizado');
  END IF;

  -- Skip if no real change
  IF v_old_status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'message', 'Status já está como ' || p_new_status);
  END IF;

  -- Update appointment
  UPDATE public.appointments
  SET status = p_new_status,
      completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
      completed_by = CASE WHEN p_new_status = 'completed' THEN 'professional' ELSE completed_by END
  WHERE id = p_appointment_id;

  -- Set message
  v_message := CASE 
    WHEN p_new_status = 'confirmed' THEN 'Agendamento confirmado'
    WHEN p_new_status = 'arrived' THEN 'Cliente marcado como chegou'
    WHEN p_new_status = 'in_service' THEN 'Atendimento iniciado'
    WHEN p_new_status = 'completed' THEN 'Atendimento concluído'
    WHEN p_new_status = 'canceled' THEN 'Agendamento cancelado'
    WHEN p_new_status = 'no_show' THEN 'Marcado como não compareceu'
    WHEN p_new_status = 'rejected' THEN 'Agendamento recusado'
    ELSE 'Status atualizado'
  END;

  -- Create email notification job
  PERFORM public.notify_appointment_status_change(p_appointment_id, p_new_status, v_old_status);

  RETURN jsonb_build_object('success', true, 'message', v_message);
END;
$$;

-- ===================================================================
-- 3) RPC for professional to view establishment tags
-- ===================================================================
CREATE OR REPLACE FUNCTION public.get_professional_client_tags(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_establishment_id uuid;
  v_tags jsonb;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  SELECT p.establishment_id INTO v_establishment_id FROM professionals p WHERE p.id = v_professional_id;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.sort_order, t.name), '[]'::jsonb)
  INTO v_tags
  FROM client_tags t
  WHERE t.establishment_id = v_establishment_id AND t.is_active = true;

  RETURN jsonb_build_object('success', true, 'tags', v_tags);
END;
$$;

-- ===================================================================
-- 4) RPC for professional to get tags for a specific customer
-- ===================================================================
CREATE OR REPLACE FUNCTION public.get_professional_customer_tags(
  p_token text,
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_establishment_id uuid;
  v_tags jsonb;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  SELECT p.establishment_id INTO v_establishment_id FROM professionals p WHERE p.id = v_professional_id;

  -- Verify customer belongs to same establishment
  IF NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p_customer_id AND c.establishment_id = v_establishment_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'tag_id', cta.tag_id,
    'tag_name', ct.name,
    'tag_color', ct.color
  )), '[]'::jsonb)
  INTO v_tags
  FROM customer_tag_assignments cta
  JOIN client_tags ct ON ct.id = cta.tag_id AND ct.is_active = true
  WHERE cta.customer_id = p_customer_id AND cta.establishment_id = v_establishment_id;

  RETURN jsonb_build_object('success', true, 'tags', v_tags);
END;
$$;

-- ===================================================================
-- 5) RPC for professional to assign/remove tag from customer
-- ===================================================================
CREATE OR REPLACE FUNCTION public.professional_toggle_customer_tag(
  p_token text,
  p_customer_id uuid,
  p_tag_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_establishment_id uuid;
  v_exists boolean;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  SELECT p.establishment_id INTO v_establishment_id FROM professionals p WHERE p.id = v_professional_id;

  -- Verify customer and tag belong to same establishment
  IF NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = p_customer_id AND c.establishment_id = v_establishment_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cliente não encontrado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM client_tags ct WHERE ct.id = p_tag_id AND ct.establishment_id = v_establishment_id AND ct.is_active = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tag não encontrada');
  END IF;

  -- Check if assignment exists
  SELECT EXISTS(
    SELECT 1 FROM customer_tag_assignments cta
    WHERE cta.customer_id = p_customer_id AND cta.tag_id = p_tag_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM customer_tag_assignments
    WHERE customer_id = p_customer_id AND tag_id = p_tag_id;
    RETURN jsonb_build_object('success', true, 'action', 'removed');
  ELSE
    INSERT INTO customer_tag_assignments (customer_id, tag_id, establishment_id)
    VALUES (p_customer_id, p_tag_id, v_establishment_id);
    RETURN jsonb_build_object('success', true, 'action', 'added');
  END IF;
END;
$$;

-- ===================================================================
-- 6) Update get_professional_appointments to include customer_id for tag management
-- ===================================================================
CREATE OR REPLACE FUNCTION public.get_professional_appointments(
  p_token text,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_appointments jsonb;
BEGIN
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.start_at), '[]'::jsonb)
  INTO v_appointments
  FROM (
    SELECT 
      a.id,
      a.start_at,
      a.end_at,
      a.status,
      a.customer_notes,
      a.internal_notes,
      a.completed_at,
      a.created_at,
      c.id AS customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.email AS customer_email,
      s.name AS service_name,
      s.duration_minutes AS service_duration,
      s.price_cents AS service_price_cents,
      (SELECT ap.status FROM appointment_payments ap WHERE ap.appointment_id = a.id ORDER BY ap.created_at DESC LIMIT 1) AS payment_status,
      (SELECT ap.amount_cents FROM appointment_payments ap WHERE ap.appointment_id = a.id ORDER BY ap.created_at DESC LIMIT 1) AS payment_amount_cents,
      (SELECT ce.commission_amount_cents FROM commission_entries ce WHERE ce.appointment_id = a.id LIMIT 1) AS commission_amount_cents,
      (SELECT ce.commission_type FROM commission_entries ce WHERE ce.appointment_id = a.id LIMIT 1) AS commission_type,
      (SELECT ce.commission_value FROM commission_entries ce WHERE ce.appointment_id = a.id LIMIT 1) AS commission_value
    FROM appointments a
    JOIN customers c ON c.id = a.customer_id
    JOIN services s ON s.id = a.service_id
    WHERE a.professional_id = v_professional_id
      AND a.start_at::date >= p_start_date
      AND a.start_at::date <= p_end_date
  ) t;

  RETURN jsonb_build_object('success', true, 'appointments', v_appointments);
END;
$$;
