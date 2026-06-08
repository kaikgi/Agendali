
-- 1) Update client_cancel_appointment to support paid_confirmed status
CREATE OR REPLACE FUNCTION public.client_cancel_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment record;
  v_old_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT id, status, customer_user_id, establishment_id
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id
    AND customer_user_id = auth.uid();

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não pode ser cancelado');
  END IF;

  v_old_status := v_appointment.status;

  UPDATE public.appointments
  SET status = 'canceled_by_customer'
  WHERE id = p_appointment_id
    AND customer_user_id = auth.uid();

  PERFORM public.notify_appointment_status_change(p_appointment_id, 'canceled_by_customer', v_old_status);

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado');
END;
$$;

-- 2) Update public_cancel_appointment_by_token to support paid_confirmed status
CREATE OR REPLACE FUNCTION public.public_cancel_appointment_by_token(p_token text, p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_token_record record;
  v_appointment record;
  v_old_status text;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT appointment_id, expires_at, used_at
  INTO v_token_record
  FROM public.appointment_manage_tokens
  WHERE token_hash = v_token_hash
    AND appointment_id = p_appointment_id;

  IF v_token_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;

  IF v_token_record.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este link expirou');
  END IF;

  SELECT id, status
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não pode ser cancelado');
  END IF;

  v_old_status := v_appointment.status;

  UPDATE public.appointments
  SET status = 'canceled_by_customer'
  WHERE id = p_appointment_id;

  UPDATE public.appointment_manage_tokens
  SET used_at = now()
  WHERE token_hash = v_token_hash;

  PERFORM public.notify_appointment_status_change(p_appointment_id, 'canceled_by_customer', v_old_status);

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado');
END;
$$;

-- 3) Update public_reschedule_appointment to support paid_confirmed and pending_approval
CREATE OR REPLACE FUNCTION public.public_reschedule_appointment(
  p_token text,
  p_appointment_id uuid,
  p_new_start_at timestamptz,
  p_new_end_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_token_record record;
  v_appointment record;
  v_max_future_days int;
BEGIN
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT amt.appointment_id, amt.expires_at, amt.used_at
  INTO v_token_record
  FROM public.appointment_manage_tokens amt
  WHERE amt.token_hash = v_token_hash
    AND amt.appointment_id = p_appointment_id;

  IF v_token_record IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF v_token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Este link expirou';
  END IF;

  SELECT a.id, a.status, a.start_at, a.establishment_id, a.professional_id, a.customer_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation') THEN
    RAISE EXCEPTION 'Agendamento não pode ser alterado (status: %)', v_appointment.status;
  END IF;

  SELECT COALESCE(e.max_future_days, 7) INTO v_max_future_days
  FROM public.establishments e
  WHERE e.id = v_appointment.establishment_id;

  IF p_new_start_at > (now() + (v_max_future_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Data fora da janela de agendamento permitida (máximo % dias no futuro)', v_max_future_days;
  END IF;

  IF p_new_start_at <= now() THEN
    RAISE EXCEPTION 'Não é possível reagendar para o passado';
  END IF;

  UPDATE public.appointments
  SET start_at = p_new_start_at,
      end_at = p_new_end_at,
      reminder_sent_at = NULL
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Agendamento reagendado com sucesso',
    'appointment', jsonb_build_object(
      'id', v_appointment.id,
      'start_at', p_new_start_at,
      'end_at', p_new_end_at,
      'status', v_appointment.status,
      'establishment_id', v_appointment.establishment_id,
      'professional_id', v_appointment.professional_id,
      'customer_id', v_appointment.customer_id
    )
  );
END;
$$;

-- 4) Create client_reschedule_appointment RPC (was completely missing!)
CREATE OR REPLACE FUNCTION public.client_reschedule_appointment(
  p_appointment_id uuid,
  p_new_start_at timestamptz,
  p_new_end_at timestamptz,
  p_new_professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment record;
  v_max_future_days int;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não autenticado');
  END IF;

  SELECT a.id, a.status, a.start_at, a.establishment_id, a.professional_id, a.customer_id, a.service_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id
    AND a.customer_user_id = auth.uid();

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed', 'pending_approval', 'paid_confirmed', 'paid_pending_confirmation') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não pode ser reagendado');
  END IF;

  SELECT COALESCE(e.max_future_days, 7) INTO v_max_future_days
  FROM public.establishments e
  WHERE e.id = v_appointment.establishment_id;

  IF p_new_start_at > (now() + (v_max_future_days || ' days')::interval) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Data fora da janela de agendamento permitida');
  END IF;

  IF p_new_start_at <= now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível reagendar para o passado');
  END IF;

  UPDATE public.appointments
  SET start_at = p_new_start_at,
      end_at = p_new_end_at,
      professional_id = COALESCE(p_new_professional_id, professional_id),
      reminder_sent_at = NULL
  WHERE id = p_appointment_id
    AND customer_user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Agendamento reagendado com sucesso',
    'appointment', jsonb_build_object(
      'id', v_appointment.id,
      'start_at', p_new_start_at,
      'end_at', p_new_end_at,
      'status', v_appointment.status,
      'establishment_id', v_appointment.establishment_id,
      'professional_id', COALESCE(p_new_professional_id, v_appointment.professional_id),
      'customer_id', v_appointment.customer_id
    )
  );
END;
$$;
