
-- Atomic RPC for creating commission settlements
-- Validates ownership, prevents duplicates, and marks entries in a single transaction
CREATE OR REPLACE FUNCTION public.create_commission_settlement(
  p_establishment_id uuid,
  p_professional_id uuid,
  p_period_start date,
  p_period_end date,
  p_entry_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_amount integer;
  v_valid_count integer;
  v_settlement_id uuid;
  v_owner_id uuid;
BEGIN
  -- 1. Validate establishment ownership
  SELECT owner_user_id INTO v_owner_id
  FROM establishments
  WHERE id = p_establishment_id;
  
  IF v_owner_id IS NULL OR v_owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acesso negado');
  END IF;

  -- 2. Validate all entries exist, are pending, belong to this establishment+professional
  SELECT COUNT(*), COALESCE(SUM(commission_amount_cents), 0)
  INTO v_valid_count, v_total_amount
  FROM commission_entries
  WHERE id = ANY(p_entry_ids)
    AND establishment_id = p_establishment_id
    AND professional_id = p_professional_id
    AND status = 'pending'
    AND settlement_id IS NULL;

  IF v_valid_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nenhuma comissão pendente encontrada');
  END IF;

  IF v_valid_count != array_length(p_entry_ids, 1) THEN
    RETURN jsonb_build_object('success', false, 'error', 
      'Algumas comissões já foram repassadas ou não pertencem a este profissional. Atualize a página e tente novamente.');
  END IF;

  -- 3. Create settlement record
  INSERT INTO commission_settlements (
    establishment_id, professional_id, period_start, period_end,
    total_amount_cents, entries_count, notes, paid_at
  ) VALUES (
    p_establishment_id, p_professional_id, p_period_start, p_period_end,
    v_total_amount, v_valid_count, p_notes, now()
  )
  RETURNING id INTO v_settlement_id;

  -- 4. Atomically mark all entries as settled
  UPDATE commission_entries
  SET status = 'settled', settlement_id = v_settlement_id
  WHERE id = ANY(p_entry_ids)
    AND establishment_id = p_establishment_id
    AND professional_id = p_professional_id
    AND status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'settlement_id', v_settlement_id,
    'total_amount_cents', v_total_amount,
    'entries_count', v_valid_count
  );
END;
$$;
