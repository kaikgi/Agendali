CREATE OR REPLACE FUNCTION public.get_professional_commissions(
  p_token text,
  p_date_from text DEFAULT NULL,
  p_date_to text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_professional_id uuid;
  v_establishment_id uuid;
  v_entries jsonb;
  v_settlements jsonb;
  v_totals jsonb;
BEGIN
  -- Hash the token first (matching validate_professional_session pattern)
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  -- Validate session using hashed token
  SELECT ps.professional_id INTO v_professional_id
  FROM professional_portal_sessions ps
  WHERE ps.token_hash = v_token_hash
    AND ps.expires_at > now();

  IF v_professional_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou expirada');
  END IF;

  -- Get establishment
  SELECT p.establishment_id INTO v_establishment_id
  FROM professionals p WHERE p.id = v_professional_id;

  -- Check portal enabled
  IF NOT EXISTS (
    SELECT 1 FROM professionals p
    WHERE p.id = v_professional_id AND p.portal_enabled = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portal desativado');
  END IF;

  -- Get entries
  SELECT COALESCE(jsonb_agg(row_to_json(e)::jsonb ORDER BY e.appointment_date DESC), '[]'::jsonb)
  INTO v_entries
  FROM commission_entries e
  WHERE e.professional_id = v_professional_id
    AND (p_date_from IS NULL OR e.appointment_date >= p_date_from::timestamptz)
    AND (p_date_to IS NULL OR e.appointment_date <= (p_date_to::date + interval '1 day'));

  -- Get settlements
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_settlements
  FROM commission_settlements s
  WHERE s.professional_id = v_professional_id;

  -- Totals (unfiltered - always show full totals)
  SELECT jsonb_build_object(
    'total_earned', COALESCE(SUM(ce.commission_amount_cents), 0),
    'total_pending', COALESCE(SUM(CASE WHEN ce.status = 'pending' THEN ce.commission_amount_cents ELSE 0 END), 0),
    'total_settled', COALESCE(SUM(CASE WHEN ce.status = 'settled' THEN ce.commission_amount_cents ELSE 0 END), 0),
    'total_count', COUNT(*)
  ) INTO v_totals
  FROM commission_entries ce
  WHERE ce.professional_id = v_professional_id
    AND ce.status != 'voided';

  RETURN jsonb_build_object(
    'success', true,
    'entries', v_entries,
    'settlements', v_settlements,
    'totals', v_totals
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_professional_settlement_detail(
  p_token text,
  p_settlement_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_hash text;
  v_professional_id uuid;
  v_settlement record;
BEGIN
  -- Hash the token first
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  -- Validate session using hashed token
  SELECT ps.professional_id INTO v_professional_id
  FROM professional_portal_sessions ps
  WHERE ps.token_hash = v_token_hash
    AND ps.expires_at > now();

  IF v_professional_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida ou expirada');
  END IF;

  -- Get settlement (only if it belongs to this professional)
  SELECT s.* INTO v_settlement
  FROM commission_settlements s
  WHERE s.id = p_settlement_id
    AND s.professional_id = v_professional_id;

  IF v_settlement IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Repasse não encontrado');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'settlement', jsonb_build_object(
      'id', v_settlement.id,
      'period_start', v_settlement.period_start,
      'period_end', v_settlement.period_end,
      'total_amount_cents', v_settlement.total_amount_cents,
      'entries_count', v_settlement.entries_count,
      'notes', v_settlement.notes,
      'paid_at', v_settlement.paid_at
    ),
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ce.id,
        'appointment_date', ce.appointment_date,
        'service_name', ce.service_name,
        'customer_name', ce.customer_name,
        'service_price_cents', ce.service_price_cents,
        'commission_amount_cents', ce.commission_amount_cents,
        'commission_type', ce.commission_type,
        'commission_value', ce.commission_value
      ) ORDER BY ce.appointment_date)
      FROM commission_entries ce
      WHERE ce.settlement_id = p_settlement_id
        AND ce.professional_id = v_professional_id
    ), '[]'::jsonb)
  );
END;
$$;