-- Drop and recreate client_reschedule_appointment to support changing professional
DROP FUNCTION IF EXISTS public.client_reschedule_appointment(uuid, timestamp with time zone, timestamp with time zone);

CREATE OR REPLACE FUNCTION public.client_reschedule_appointment(
  p_appointment_id uuid,
  p_new_start_at timestamp with time zone,
  p_new_end_at timestamp with time zone,
  p_new_professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_user_id uuid;
  v_appointment record;
  v_old_start_at timestamptz;
  v_old_end_at timestamptz;
  v_old_professional_id uuid;
  v_target_professional_id uuid;
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

  -- Determine target professional (use new if provided, otherwise keep current)
  v_target_professional_id := COALESCE(p_new_professional_id, v_appointment.professional_id);

  -- If changing professional, validate the new professional
  IF p_new_professional_id IS NOT NULL AND p_new_professional_id != v_appointment.professional_id THEN
    -- Check professional belongs to same establishment and is active
    IF NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = p_new_professional_id
        AND p.establishment_id = v_appointment.establishment_id
        AND p.active = true
    ) THEN
      RAISE EXCEPTION 'Profissional inválido ou não disponível';
    END IF;

    -- Check professional offers the same service
    IF NOT EXISTS (
      SELECT 1 FROM public.professional_services ps
      WHERE ps.professional_id = p_new_professional_id
        AND ps.service_id = v_appointment.service_id
    ) THEN
      RAISE EXCEPTION 'Este profissional não realiza o serviço selecionado';
    END IF;
  END IF;

  -- Check for time block conflicts with target professional
  IF EXISTS (
    SELECT 1
    FROM public.time_blocks tb
    WHERE tb.establishment_id = v_appointment.establishment_id
      AND (tb.professional_id IS NULL OR tb.professional_id = v_target_professional_id)
      AND tb.start_at < p_new_end_at
      AND tb.end_at > p_new_start_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Este horário está bloqueado. Escolha outro horário.';
  END IF;

  -- Check for appointment conflicts with target professional (excluding current appointment)
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.establishment_id = v_appointment.establishment_id
      AND a.professional_id = v_target_professional_id
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
  v_old_professional_id := v_appointment.professional_id;

  -- Update appointment atomically
  UPDATE public.appointments
  SET 
    start_at = p_new_start_at,
    end_at = p_new_end_at,
    professional_id = v_target_professional_id,
    status = CASE 
      WHEN status = 'booked' THEN 'booked'::appointment_status
      ELSE 'confirmed'::appointment_status
    END
  WHERE id = p_appointment_id;

  -- Record rescheduled event in audit log
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
      'end_at', v_old_end_at,
      'professional_id', v_old_professional_id
    ),
    jsonb_build_object(
      'start_at', p_new_start_at,
      'end_at', p_new_end_at,
      'professional_id', v_target_professional_id
    )
  );

  -- If professional changed, also record professional_changed event
  IF p_new_professional_id IS NOT NULL AND p_new_professional_id != v_old_professional_id THEN
    INSERT INTO public.appointment_events (
      appointment_id,
      actor_type,
      event_type,
      from_payload,
      to_payload
    ) VALUES (
      p_appointment_id,
      'customer'::event_actor_type,
      'professional_changed'::appointment_event_type,
      jsonb_build_object('professional_id', v_old_professional_id),
      jsonb_build_object('professional_id', v_target_professional_id)
    );
  END IF;

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