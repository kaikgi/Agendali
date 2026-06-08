
-- RPC: get_professional_commissions
-- Allows a professional (via portal token) to see their own commission entries and settlements
CREATE OR REPLACE FUNCTION public.get_professional_commissions(
  p_token text,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_professional_id uuid;
  v_establishment_id uuid;
  v_result jsonb;
  v_entries jsonb;
  v_settlements jsonb;
  v_totals jsonb;
BEGIN
  -- Validate session
  SELECT ps.professional_id INTO v_professional_id
  FROM professional_portal_sessions ps
  WHERE ps.token_hash = p_token
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
    AND (p_date_from IS NULL OR e.appointment_date >= p_date_from)
    AND (p_date_to IS NULL OR e.appointment_date <= (p_date_to + interval '1 day'));

  -- Get settlements
  SELECT COALESCE(jsonb_agg(row_to_json(s)::jsonb ORDER BY s.created_at DESC), '[]'::jsonb)
  INTO v_settlements
  FROM commission_settlements s
  WHERE s.professional_id = v_professional_id;

  -- Totals
  SELECT jsonb_build_object(
    'total_earned', COALESCE(SUM(ce.commission_amount_cents), 0),
    'total_pending', COALESCE(SUM(CASE WHEN ce.status = 'pending' THEN ce.commission_amount_cents ELSE 0 END), 0),
    'total_settled', COALESCE(SUM(CASE WHEN ce.status = 'settled' THEN ce.commission_amount_cents ELSE 0 END), 0),
    'total_count', COUNT(*)
  ) INTO v_totals
  FROM commission_entries ce
  WHERE ce.professional_id = v_professional_id;

  RETURN jsonb_build_object(
    'success', true,
    'entries', v_entries,
    'settlements', v_settlements,
    'totals', v_totals
  );
END;
$$;
