-- Create RPC for logged-in clients to reschedule their own appointments
CREATE OR REPLACE FUNCTION public.client_reschedule_appointment(
  p_appointment_id uuid,
  p_new_start_at timestamptz,
  p_new_end_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
  v_appointment record;
  v_establishment record;
  v_old_start_at timestamptz;
  v_old_end_at timestamptz;
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Get appointment details and verify ownership
  SELECT a.*, e.reschedule_min_hours, e.name as establishment_name, e.slug
    INTO v_appointment
  FROM public.appointments a
  JOIN public.establishments e ON e.id = a.establishment_id
  WHERE a.id = p_appointment_id
    AND a.customer_user_id = v_user_id
  LIMIT 1;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado ou você não tem permissão';
  END IF;

  -- Check appointment status allows rescheduling
  IF v_appointment.status IN ('completed', 'canceled', 'no_show') THEN
    RAISE EXCEPTION 'Este agendamento não pode ser reagendado (status: %)', v_appointment.status;
  END IF;

  -- Check minimum reschedule hours
  IF v_appointment.start_at < (now() + (v_appointment.reschedule_min_hours || ' hours')::interval) THEN
    RAISE EXCEPTION 'Não é possível reagendar com menos de % horas de antecedência', v_appointment.reschedule_min_hours;
  END IF;

  -- Validate new times
  IF p_new_start_at IS NULL OR p_new_end_at IS NULL OR p_new_end_at <= p_new_start_at THEN
    RAISE EXCEPTION 'Horário inválido';
  END IF;

  -- Check for time block conflicts
  IF EXISTS (
    SELECT 1
    FROM public.time_blocks tb
    WHERE tb.establishment_id = v_appointment.establishment_id
      AND (tb.professional_id IS NULL OR tb.professional_id = v_appointment.professional_id)
      AND tb.start_at < p_new_end_at
      AND tb.end_at > p_new_start_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Este horário está bloqueado. Escolha outro horário.';
  END IF;

  -- Check for appointment conflicts (excluding current appointment)
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.establishment_id = v_appointment.establishment_id
      AND a.professional_id = v_appointment.professional_id
      AND a.id != p_appointment_id
      AND a.status IN ('booked', 'confirmed')
      AND a.start_at < p_new_end_at
      AND a.end_at > p_new_start_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Este horário já está ocupado. Escolha outro horário.';
  END IF;

  -- Store old values for audit
  v_old_start_at := v_appointment.start_at;
  v_old_end_at := v_appointment.end_at;

  -- Update appointment atomically
  UPDATE public.appointments
  SET 
    start_at = p_new_start_at,
    end_at = p_new_end_at,
    status = CASE 
      WHEN status = 'booked' THEN 'booked'::appointment_status
      ELSE 'confirmed'::appointment_status
    END
  WHERE id = p_appointment_id;

  -- Record event in audit log
  INSERT INTO public.appointment_events (
    appointment_id,
    actor_type,
    event_type,
    from_payload,
    to_payload
  ) VALUES (
    p_appointment_id,
    'customer'::event_actor_type,
    'rescheduled'::appointment_event_type,
    jsonb_build_object(
      'start_at', v_old_start_at,
      'end_at', v_old_end_at
    ),
    jsonb_build_object(
      'start_at', p_new_start_at,
      'end_at', p_new_end_at
    )
  );

  -- Return updated appointment data
  SELECT jsonb_build_object(
    'success', true,
    'appointment', jsonb_build_object(
      'id', a.id,
      'start_at', a.start_at,
      'end_at', a.end_at,
      'status', a.status,
      'establishment_id', a.establishment_id,
      'professional_id', a.professional_id,
      'customer_id', a.customer_id
    ),
    'message', 'Agendamento reagendado com sucesso'
  ) INTO v_result
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  RETURN v_result;
END;
$$;