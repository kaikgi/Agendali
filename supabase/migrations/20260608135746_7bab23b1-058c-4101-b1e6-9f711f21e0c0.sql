-- Update can_create_professional to include past_due and trialing
CREATE OR REPLACE FUNCTION public.can_create_professional(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_code text;
  v_status text;
  v_period_end timestamp with time zone;
  v_max_professionals integer;
  v_current_count integer;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Estabelecimento não encontrado');
  END IF;

  -- Get subscription plan - accepting active, trialing and past_due (with 3 days grace)
  SELECT s.plan_code, s.status, s.current_period_end INTO v_plan_code, v_status, v_period_end
  FROM public.subscriptions s
  WHERE s.owner_user_id = v_owner_id 
    AND (s.status IN ('active', 'trialing') OR (s.status = 'past_due' AND s.current_period_end > now() - interval '3 days'))
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- If no subscription, check establishment status/plano directly
  IF v_plan_code IS NULL THEN
    SELECT plano, status INTO v_plan_code, v_status
    FROM public.establishments
    WHERE id = p_establishment_id;
    
    IF v_status NOT IN ('active', 'trialing') THEN
       RETURN jsonb_build_object('allowed', false, 'reason', 'Assinatura necessária');
    END IF;
  END IF;

  -- Default to solo
  v_plan_code := COALESCE(v_plan_code, 'solo');

  -- Get plan limits
  -- Logic matches hardcodedPlans.ts
  v_max_professionals := CASE 
    WHEN v_plan_code = 'pro' THEN 999999
    WHEN v_plan_code = 'studio' THEN 4
    ELSE 1
  END;

  -- Count current active professionals
  SELECT COUNT(*) INTO v_current_count
  FROM public.professionals
  WHERE establishment_id = p_establishment_id AND active = true;

  IF v_current_count >= v_max_professionals THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', format('Você atingiu o limite de %s profissionais do seu plano.', v_max_professionals),
      'current', v_current_count,
      'limit', v_max_professionals,
      'plan', v_plan_code
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_current_count, 'limit', v_max_professionals, 'plan', v_plan_code);
END;
$$;

-- Update can_create_appointment
CREATE OR REPLACE FUNCTION public.can_create_appointment(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_status text;
  v_period_end timestamp with time zone;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Estabelecimento não encontrado');
  END IF;

  -- Get subscription status
  SELECT s.status, s.current_period_end INTO v_status, v_period_end
  FROM public.subscriptions s
  WHERE s.owner_user_id = v_owner_id 
    AND (s.status IN ('active', 'trialing') OR (s.status = 'past_due' AND s.current_period_end > now() - interval '3 days'))
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Fallback to establishment status
  IF v_status IS NULL THEN
    SELECT status INTO v_status
    FROM public.establishments
    WHERE id = p_establishment_id;
  END IF;

  IF v_status NOT IN ('active', 'trialing', 'past_due') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Este estabelecimento está com a conta suspensa por falta de pagamento ou cancelamento.');
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Update get_subscription_usage
CREATE OR REPLACE FUNCTION public.get_subscription_usage(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_code text;
  v_subscription record;
  v_professionals_count integer;
  v_appointments_count integer;
  v_month_start timestamp with time zone;
  v_max_profs integer;
  v_plan_name text;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Estabelecimento não encontrado');
  END IF;

  -- Get subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE owner_user_id = v_owner_id 
  ORDER BY created_at DESC
  LIMIT 1;

  v_plan_code := COALESCE(v_subscription.plan_code, (SELECT plano FROM establishments WHERE id = p_establishment_id), 'solo');
  
  -- Match logic from hardcodedPlans.ts
  v_max_profs := CASE 
    WHEN v_plan_code = 'pro' THEN NULL
    WHEN v_plan_code = 'studio' THEN 4
    ELSE 1
  END;

  v_plan_name := CASE 
    WHEN v_plan_code = 'pro' THEN 'Pro'
    WHEN v_plan_code = 'studio' THEN 'Studio'
    ELSE 'Solo'
  END;

  -- Count professionals
  SELECT COUNT(*) INTO v_professionals_count
  FROM public.professionals
  WHERE establishment_id = p_establishment_id AND active = true;

  -- Count appointments this month
  v_month_start := date_trunc('month', now());
  SELECT COUNT(*) INTO v_appointments_count
  FROM public.appointments
  WHERE establishment_id = p_establishment_id
    AND created_at >= v_month_start
    AND status NOT IN ('canceled');

  RETURN jsonb_build_object(
    'plan', jsonb_build_object(
      'code', v_plan_code,
      'name', v_plan_name,
      'max_professionals', v_max_profs,
      'max_appointments_month', NULL,
      'allow_multi_establishments', (v_plan_code IN ('studio', 'pro'))
    ),
    'usage', jsonb_build_object(
      'professionals', v_professionals_count,
      'appointments_this_month', v_appointments_count
    ),
    'subscription', CASE WHEN v_subscription IS NOT NULL THEN
      jsonb_build_object(
        'status', v_subscription.status,
        'current_period_end', v_subscription.current_period_end
      )
    ELSE
      jsonb_build_object('status', 'none')
    END
  );
END;
$$;