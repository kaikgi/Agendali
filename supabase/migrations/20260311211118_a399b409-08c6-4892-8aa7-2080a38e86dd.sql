
-- RPC: get_professional_dashboard_stats
-- Returns comprehensive KPIs for the professional portal dashboard
CREATE OR REPLACE FUNCTION public.get_professional_dashboard_stats(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $$
DECLARE
  v_session jsonb;
  v_prof_id uuid;
  v_est_id uuid;
  v_today_count int;
  v_next7_count int;
  v_completed_month int;
  v_canceled_month int;
  v_noshow_month int;
  v_revenue_month bigint;
  v_commission_month bigint;
  v_commission_pending bigint;
  v_commission_settled bigint;
  v_total_appointments_month int;
  v_ticket_medio bigint;
  v_month_start timestamptz;
  v_month_end timestamptz;
BEGIN
  -- Validate session
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_prof_id := (v_session ->> 'professional_id')::uuid;
  v_est_id := (v_session ->> 'establishment_id')::uuid;
  v_month_start := date_trunc('month', now());
  v_month_end := date_trunc('month', now()) + interval '1 month';

  -- Today's active appointments
  SELECT count(*) INTO v_today_count
  FROM appointments
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND start_at::date = current_date
    AND status IN ('booked', 'confirmed');

  -- Next 7 days active
  SELECT count(*) INTO v_next7_count
  FROM appointments
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND start_at > now()
    AND start_at < now() + interval '7 days'
    AND status IN ('booked', 'confirmed');

  -- Monthly completed
  SELECT count(*) INTO v_completed_month
  FROM appointments
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND start_at >= v_month_start AND start_at < v_month_end
    AND status = 'completed';

  -- Monthly canceled
  SELECT count(*) INTO v_canceled_month
  FROM appointments
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND start_at >= v_month_start AND start_at < v_month_end
    AND status = 'canceled';

  -- Monthly no-show
  SELECT count(*) INTO v_noshow_month
  FROM appointments
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND start_at >= v_month_start AND start_at < v_month_end
    AND status = 'no_show';

  -- Monthly revenue (from completed appointments with service prices)
  SELECT coalesce(sum(s.price_cents), 0) INTO v_revenue_month
  FROM appointments a
  JOIN services s ON s.id = a.service_id
  WHERE a.professional_id = v_prof_id
    AND a.establishment_id = v_est_id
    AND a.start_at >= v_month_start AND a.start_at < v_month_end
    AND a.status = 'completed';

  -- Total appointments this month (for ticket médio)
  v_total_appointments_month := v_completed_month;
  IF v_total_appointments_month > 0 THEN
    v_ticket_medio := v_revenue_month / v_total_appointments_month;
  ELSE
    v_ticket_medio := 0;
  END IF;

  -- Commission accumulated this month
  SELECT coalesce(sum(commission_amount_cents), 0) INTO v_commission_month
  FROM commission_entries
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND appointment_date >= v_month_start AND appointment_date < v_month_end;

  -- Commission pending (all time)
  SELECT coalesce(sum(commission_amount_cents), 0) INTO v_commission_pending
  FROM commission_entries
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND status = 'pending';

  -- Commission settled (all time)
  SELECT coalesce(sum(commission_amount_cents), 0) INTO v_commission_settled
  FROM commission_entries
  WHERE professional_id = v_prof_id
    AND establishment_id = v_est_id
    AND status = 'settled';

  RETURN jsonb_build_object(
    'success', true,
    'today_count', v_today_count,
    'next7_count', v_next7_count,
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

GRANT EXECUTE ON FUNCTION public.get_professional_dashboard_stats TO anon, authenticated;

-- RPC: professional_change_password
-- Allows a professional to change their own portal password
CREATE OR REPLACE FUNCTION public.professional_change_password(
  p_token text,
  p_current_password text,
  p_new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
SET row_security = off
AS $$
DECLARE
  v_session jsonb;
  v_prof_id uuid;
  v_current_hash text;
BEGIN
  -- Validate session
  v_session := public.validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_prof_id := (v_session ->> 'professional_id')::uuid;

  -- Get current password hash
  SELECT portal_password_hash INTO v_current_hash
  FROM professionals
  WHERE id = v_prof_id;

  IF v_current_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha atual não configurada');
  END IF;

  -- Verify current password
  IF v_current_hash != crypt(p_current_password, v_current_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha atual incorreta');
  END IF;

  -- Validate new password strength
  IF length(p_new_password) < 8 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nova senha deve ter pelo menos 8 caracteres');
  END IF;
  IF p_new_password !~ '[a-z]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nova senha deve conter letra minúscula');
  END IF;
  IF p_new_password !~ '[A-Z]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nova senha deve conter letra maiúscula');
  END IF;
  IF p_new_password !~ '[0-9]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nova senha deve conter número');
  END IF;
  IF p_new_password !~ '[^a-zA-Z0-9]' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nova senha deve conter caractere especial');
  END IF;

  -- Update password
  UPDATE professionals
  SET portal_password_hash = crypt(p_new_password, gen_salt('bf'))
  WHERE id = v_prof_id;

  RETURN jsonb_build_object('success', true, 'message', 'Senha alterada com sucesso');
END;
$$;

GRANT EXECUTE ON FUNCTION public.professional_change_password TO anon, authenticated;
