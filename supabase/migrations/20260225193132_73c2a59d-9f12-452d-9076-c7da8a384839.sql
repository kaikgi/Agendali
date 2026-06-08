
-- RPC for professional to update appointment status via portal token
CREATE OR REPLACE FUNCTION public.professional_update_appointment_status(
  p_token text,
  p_appointment_id uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_appointment record;
BEGIN
  -- Validate session
  v_session := validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  -- Validate new status
  IF p_new_status NOT IN ('completed', 'canceled', 'no_show') THEN
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

  -- Check current status allows transition
  IF v_appointment.status IN ('completed', 'canceled', 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este agendamento já foi finalizado');
  END IF;

  -- Update appointment
  UPDATE public.appointments
  SET status = p_new_status::appointment_status,
      completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END,
      completed_by = CASE WHEN p_new_status = 'completed' THEN 'professional' ELSE completed_by END
  WHERE id = p_appointment_id;

  -- Record event
  INSERT INTO public.appointment_events (
    appointment_id, actor_type, event_type, from_payload, to_payload
  ) VALUES (
    p_appointment_id,
    'staff'::event_actor_type,
    CASE 
      WHEN p_new_status = 'completed' THEN 'completed'::appointment_event_type
      WHEN p_new_status = 'canceled' THEN 'canceled'::appointment_event_type
      WHEN p_new_status = 'no_show' THEN 'no_show_marked'::appointment_event_type
    END,
    jsonb_build_object('status', v_appointment.status),
    jsonb_build_object('status', p_new_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', CASE 
      WHEN p_new_status = 'completed' THEN 'Agendamento marcado como concluído'
      WHEN p_new_status = 'canceled' THEN 'Agendamento cancelado'
      WHEN p_new_status = 'no_show' THEN 'Marcado como não compareceu'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.professional_update_appointment_status(text, uuid, text) TO anon, authenticated;
