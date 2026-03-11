
-- RPC: Get settlement detail for professional portal (SECURITY DEFINER)
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
  v_professional_id uuid;
  v_session record;
  v_settlement record;
BEGIN
  -- Validate session
  SELECT ps.professional_id INTO v_professional_id
  FROM professional_portal_sessions ps
  WHERE ps.token_hash = p_token
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
