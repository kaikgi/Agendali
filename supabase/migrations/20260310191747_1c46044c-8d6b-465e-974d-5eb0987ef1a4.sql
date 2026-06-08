
-- Fix professional_update_appointment_status: remove type casts that may not exist,
-- add 'confirmed' as valid status, add email notifications
CREATE OR REPLACE FUNCTION public.professional_update_appointment_status(
  p_token text,
  p_appointment_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_appointment record;
  v_old_status text;
  v_message text;
BEGIN
  -- Validate session
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  -- Validate new status
  IF p_new_status NOT IN ('confirmed', 'completed', 'canceled', 'no_show') THEN
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
  IF v_old_status IN ('completed', 'canceled', 'no_show') THEN
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
    WHEN p_new_status = 'completed' THEN 'Agendamento marcado como concluído'
    WHEN p_new_status = 'canceled' THEN 'Agendamento cancelado'
    WHEN p_new_status = 'no_show' THEN 'Marcado como não compareceu'
    ELSE 'Status atualizado'
  END;

  -- Create email notification job
  PERFORM public.notify_appointment_status_change(p_appointment_id, p_new_status, v_old_status);

  RETURN jsonb_build_object('success', true, 'message', v_message);
END;
$$;

GRANT EXECUTE ON FUNCTION public.professional_update_appointment_status(text, uuid, text) TO anon, authenticated;
