
-- =====================================================
-- 1. Enhanced get_professional_appointments: include email, payment, commission data
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_professional_appointments(p_token text, p_start_date date, p_end_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
  v_session record;
  v_prof_id uuid;
  v_result jsonb;
BEGIN
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT s.professional_id, s.expires_at
  INTO v_session
  FROM public.professional_portal_sessions s
  WHERE s.token_hash = v_token_hash;

  IF v_session IS NULL OR v_session.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_prof_id := v_session.professional_id;

  SELECT jsonb_build_object(
    'success', true,
    'appointments', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'start_at', a.start_at,
        'end_at', a.end_at,
        'status', a.status,
        'customer_name', c.name,
        'customer_phone', c.phone,
        'customer_email', COALESCE(a.customer_email, c.email),
        'service_name', s.name,
        'service_duration', s.duration_minutes,
        'service_price_cents', s.price_cents,
        'customer_notes', a.customer_notes,
        'internal_notes', a.internal_notes,
        'completed_at', a.completed_at,
        'created_at', a.created_at,
        'payment_status', (
          SELECT ap.status FROM public.appointment_payments ap
          WHERE ap.appointment_id = a.id
          ORDER BY ap.created_at DESC LIMIT 1
        ),
        'payment_amount_cents', (
          SELECT ap.amount_cents FROM public.appointment_payments ap
          WHERE ap.appointment_id = a.id
          ORDER BY ap.created_at DESC LIMIT 1
        ),
        'commission_amount_cents', (
          SELECT ce.commission_amount_cents FROM public.commission_entries ce
          WHERE ce.appointment_id = a.id AND ce.professional_id = v_prof_id
          LIMIT 1
        ),
        'commission_type', (
          SELECT ce.commission_type FROM public.commission_entries ce
          WHERE ce.appointment_id = a.id AND ce.professional_id = v_prof_id
          LIMIT 1
        ),
        'commission_value', (
          SELECT ce.commission_value FROM public.commission_entries ce
          WHERE ce.appointment_id = a.id AND ce.professional_id = v_prof_id
          LIMIT 1
        )
      ) ORDER BY a.start_at
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.appointments a
  JOIN public.customers c ON c.id = a.customer_id
  JOIN public.services s ON s.id = a.service_id
  WHERE a.professional_id = v_prof_id
    AND a.start_at >= p_start_date::timestamptz
    AND a.start_at < (p_end_date + 1)::timestamptz;

  RETURN v_result;
END;
$$;

-- =====================================================
-- 2. Enhanced professional_update_appointment_status: add 'rejected' status
-- =====================================================
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
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  -- Validate new status - now includes 'rejected'
  IF p_new_status NOT IN ('confirmed', 'completed', 'canceled', 'no_show', 'rejected') THEN
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
    WHEN p_new_status = 'completed' THEN 'Agendamento marcado como concluído'
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

GRANT EXECUTE ON FUNCTION public.professional_update_appointment_status(text, uuid, text) TO anon, authenticated;

-- =====================================================
-- 3. Professional time blocks management RPCs
-- =====================================================

-- Get professional's own time blocks
CREATE OR REPLACE FUNCTION public.get_professional_time_blocks(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_establishment_id uuid;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  v_establishment_id := (v_session ->> 'establishment_id')::uuid;

  RETURN jsonb_build_object(
    'success', true,
    'time_blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', tb.id,
        'start_at', tb.start_at,
        'end_at', tb.end_at,
        'reason', tb.reason
      ) ORDER BY tb.start_at DESC)
      FROM public.time_blocks tb
      WHERE tb.professional_id = v_professional_id
        AND tb.establishment_id = v_establishment_id
    ), '[]'::jsonb),
    'recurring_blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', rb.id,
        'weekday', rb.weekday,
        'start_time', rb.start_time,
        'end_time', rb.end_time,
        'reason', rb.reason,
        'active', rb.active
      ) ORDER BY rb.weekday, rb.start_time)
      FROM public.recurring_time_blocks rb
      WHERE rb.professional_id = v_professional_id
        AND rb.establishment_id = v_establishment_id
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_professional_time_blocks(text) TO anon, authenticated;

-- Create a time block for professional
CREATE OR REPLACE FUNCTION public.professional_create_time_block(
  p_token text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_reason text DEFAULT NULL
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
  v_establishment_id uuid;
  v_new_id uuid;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  v_establishment_id := (v_session ->> 'establishment_id')::uuid;

  IF p_start_at >= p_end_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário de início deve ser antes do fim');
  END IF;

  INSERT INTO public.time_blocks (establishment_id, professional_id, start_at, end_at, reason)
  VALUES (v_establishment_id, v_professional_id, p_start_at, p_end_at, p_reason)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.professional_create_time_block(text, timestamptz, timestamptz, text) TO anon, authenticated;

-- Delete a time block (only own)
CREATE OR REPLACE FUNCTION public.professional_delete_time_block(
  p_token text,
  p_block_id uuid
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
  v_deleted boolean;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  DELETE FROM public.time_blocks
  WHERE id = p_block_id AND professional_id = v_professional_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF NOT v_deleted THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bloqueio não encontrado');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.professional_delete_time_block(text, uuid) TO anon, authenticated;

-- =====================================================
-- 4. Enhanced dashboard stats: add pending_approval count
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_professional_dashboard_stats(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_today_count int;
  v_next7_count int;
  v_completed_month int;
  v_canceled_month int;
  v_noshow_month int;
  v_pending_approval int;
  v_revenue_month bigint;
  v_commission_month bigint;
  v_commission_pending bigint;
  v_commission_settled bigint;
  v_ticket_medio bigint;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  v_session := public.validate_professional_session(p_token);
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now()) + interval '1 month';

  -- Today count
  SELECT count(*) INTO v_today_count
  FROM appointments
  WHERE professional_id = v_professional_id
    AND start_at >= date_trunc('day', now())
    AND start_at < date_trunc('day', now()) + interval '1 day'
    AND status IN ('booked', 'confirmed', 'pending_approval', 'paid_pending_confirmation');

  -- Next 7 days
  SELECT count(*) INTO v_next7_count
  FROM appointments
  WHERE professional_id = v_professional_id
    AND start_at > now()
    AND start_at < now() + interval '7 days'
    AND status IN ('booked', 'confirmed', 'pending_approval', 'paid_pending_confirmation');

  -- Pending approval
  SELECT count(*) INTO v_pending_approval
  FROM appointments
  WHERE professional_id = v_professional_id
    AND status IN ('pending_approval', 'paid_pending_confirmation');

  -- Completed this month
  SELECT count(*) INTO v_completed_month
  FROM appointments
  WHERE professional_id = v_professional_id
    AND start_at >= v_month_start AND start_at < v_month_end
    AND status = 'completed';

  -- Canceled this month
  SELECT count(*) INTO v_canceled_month
  FROM appointments
  WHERE professional_id = v_professional_id
    AND start_at >= v_month_start AND start_at < v_month_end
    AND status IN ('canceled', 'rejected');

  -- No show this month
  SELECT count(*) INTO v_noshow_month
  FROM appointments
  WHERE professional_id = v_professional_id
    AND start_at >= v_month_start AND start_at < v_month_end
    AND status = 'no_show';

  -- Revenue this month (from completed appointments service prices)
  SELECT COALESCE(sum(s.price_cents), 0) INTO v_revenue_month
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  WHERE a.professional_id = v_professional_id
    AND a.start_at >= v_month_start AND a.start_at < v_month_end
    AND a.status = 'completed';

  -- Commission this month
  SELECT COALESCE(sum(commission_amount_cents), 0) INTO v_commission_month
  FROM commission_entries
  WHERE professional_id = v_professional_id
    AND appointment_date >= v_month_start AND appointment_date < v_month_end;

  -- Commission pending (all time)
  SELECT COALESCE(sum(commission_amount_cents), 0) INTO v_commission_pending
  FROM commission_entries
  WHERE professional_id = v_professional_id AND status = 'pending';

  -- Commission settled (all time)
  SELECT COALESCE(sum(commission_amount_cents), 0) INTO v_commission_settled
  FROM commission_entries
  WHERE professional_id = v_professional_id AND status = 'settled';

  -- Ticket medio
  IF v_completed_month > 0 THEN
    v_ticket_medio := v_revenue_month / v_completed_month;
  ELSE
    v_ticket_medio := 0;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'today_count', v_today_count,
    'next7_count', v_next7_count,
    'pending_approval', v_pending_approval,
    'completed_month', v_completed_month,
    'canceled_month', v_canceled_month,
    'noshow_month', v_noshow_month,
    'revenue_month', v_revenue_month,
    'commission_month', v_commission_month,
    'commission_pending', v_commission_pending,
    'commission_settled', v_commission_settled,
    'ticket_medio', v_ticket_medio
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_professional_dashboard_stats(text) TO anon, authenticated;
