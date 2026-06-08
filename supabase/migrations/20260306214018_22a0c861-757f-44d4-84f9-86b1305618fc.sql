
CREATE OR REPLACE FUNCTION public.public_reschedule_appointment(
  p_token text,
  p_appointment_id uuid,
  p_new_start_at timestamp with time zone,
  p_new_end_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_token_hash text;
  v_token_record record;
  v_appointment record;
  v_max_future_days int;
BEGIN
  -- Hash the token
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  -- Verify token
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

  -- Verify appointment exists and is modifiable
  SELECT a.id, a.status, a.start_at, a.establishment_id, a.professional_id, a.customer_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed') THEN
    RAISE EXCEPTION 'Agendamento não pode ser alterado (status: %)', v_appointment.status;
  END IF;

  -- Validate booking window
  SELECT COALESCE(e.max_future_days, 7) INTO v_max_future_days
  FROM public.establishments e
  WHERE e.id = v_appointment.establishment_id;

  IF p_new_start_at > (now() + (v_max_future_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Data fora da janela de agendamento permitida (máximo % dias no futuro)', v_max_future_days;
  END IF;

  IF p_new_start_at <= now() THEN
    RAISE EXCEPTION 'Não é possível reagendar para o passado';
  END IF;

  -- Update appointment
  UPDATE public.appointments
  SET start_at = p_new_start_at,
      end_at = p_new_end_at
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
$function$;
