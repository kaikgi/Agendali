
-- RPC: Cancel appointment by token (for unauthenticated users via manage link)
CREATE OR REPLACE FUNCTION public.public_cancel_appointment_by_token(
  p_token text,
  p_appointment_id uuid
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
  v_old_status text;
BEGIN
  -- Hash the token
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  -- Validate token
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

  -- Get appointment
  SELECT id, status
  INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed', 'pending_approval') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento não pode ser cancelado');
  END IF;

  v_old_status := v_appointment.status;

  -- Cancel the appointment
  UPDATE public.appointments
  SET status = 'canceled_by_customer'
  WHERE id = p_appointment_id;

  -- Mark token as used
  UPDATE public.appointment_manage_tokens
  SET used_at = now()
  WHERE token_hash = v_token_hash;

  -- Notify for email
  PERFORM public.notify_appointment_status_change(p_appointment_id, 'canceled_by_customer', v_old_status);

  RETURN jsonb_build_object('success', true, 'message', 'Agendamento cancelado');
END;
$function$;

-- Also update client_cancel_appointment to use canceled_by_customer
CREATE OR REPLACE FUNCTION public.client_cancel_appointment(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
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

  IF v_appointment.status NOT IN ('booked', 'confirmed', 'pending_approval') THEN
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
$function$;
