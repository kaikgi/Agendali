-- Fix: check_signup_authorization agora também verifica signup_tokens ativos
-- Problema: a função anterior só verificava allowed_establishment_signups,
-- mas ignorava signup_tokens, bloqueando usuários que chegavam pelo fluxo de token.

CREATE OR REPLACE FUNCTION public.check_signup_authorization(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_email text;
  v_plan_id text;
  v_has_pending boolean := false;
BEGIN
  v_email := lower(trim(p_email));
  
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('authorized', false, 'pending_payment', false);
  END IF;

  -- 1. Verificar se email está em allowed_establishment_signups (não consumido)
  SELECT plan_id INTO v_plan_id
  FROM public.allowed_establishment_signups
  WHERE email = v_email AND used = false
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    RETURN jsonb_build_object('authorized', true, 'plan_id', v_plan_id, 'pending_payment', false);
  END IF;

  -- 2. Verificar se existe signup_token ativo e não expirado
  SELECT plan_id INTO v_plan_id
  FROM public.signup_tokens
  WHERE email = v_email
    AND status = 'pending'
    AND expires_at > now()
    AND used_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_plan_id IS NOT NULL THEN
    RETURN jsonb_build_object('authorized', true, 'plan_id', v_plan_id, 'pending_payment', false);
  END IF;

  -- 3. Verificar pagamento pendente (pix_created, boleto_created)
  SELECT EXISTS (
    SELECT 1 FROM public.billing_webhook_events
    WHERE event_type IN ('pix_created', 'boleto_created', 'waiting_payment')
      AND ignored = true
      AND (
        payload->'Customer'->>'email' ILIKE v_email
        OR payload->>'customer_email' ILIKE v_email
      )
  ) INTO v_has_pending;

  RETURN jsonb_build_object('authorized', false, 'pending_payment', v_has_pending);
END;
$$;
