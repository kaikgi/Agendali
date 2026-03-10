-- Create a secure RPC to check email authorization without exposing the table
CREATE OR REPLACE FUNCTION public.check_signup_authorization(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_email text;
  v_record record;
  v_has_pending boolean := false;
BEGIN
  v_email := lower(trim(p_email));
  
  IF v_email IS NULL OR v_email = '' THEN
    RETURN jsonb_build_object('authorized', false, 'pending_payment', false);
  END IF;

  -- Check if email is authorized (exists in allowed_establishment_signups, not used)
  SELECT plan_id INTO v_record
  FROM public.allowed_establishment_signups
  WHERE email = v_email AND used = false
  LIMIT 1;

  IF v_record IS NOT NULL THEN
    RETURN jsonb_build_object('authorized', true, 'plan_id', v_record.plan_id, 'pending_payment', false);
  END IF;

  -- Check for pending payment events (pix_created, boleto_created)
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

-- Remove the overly permissive anon policy that exposes all rows
DROP POLICY IF EXISTS "Anon can check allowed signups" ON public.allowed_establishment_signups;