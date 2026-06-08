-- Create plans table
CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  price_cents integer NOT NULL,
  max_professionals integer NOT NULL DEFAULT 1,
  max_appointments_month integer NOT NULL DEFAULT 50,
  allow_multi_establishments boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert default plans
INSERT INTO public.plans (code, name, price_cents, max_professionals, max_appointments_month, allow_multi_establishments, features)
VALUES 
  ('basic', 'Básico', 1990, 1, 50, false, '["Página de agendamento personalizada", "Lembretes por E-mail", "Self-service para clientes", "Dashboard de métricas", "Suporte por E-mail"]'::jsonb),
  ('essential', 'Essencial', 4900, 3, 120, false, '["Tudo do plano Básico", "Até 3 profissionais", "120 agendamentos/mês"]'::jsonb),
  ('studio', 'Studio', 9900, 10, 9999, true, '["Tudo do plano Essencial", "Até 10 profissionais", "Múltiplos estabelecimentos", "Relatórios avançados", "Domínio personalizado", "Suporte prioritário"]'::jsonb);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Everyone can view plans
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);

-- Create subscriptions table
CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.plans(code),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_start timestamp with time zone NOT NULL DEFAULT now(),
  current_period_end timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  external_id text,
  external_provider text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id)
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription" ON public.subscriptions 
  FOR SELECT USING (auth.uid() = owner_user_id);

-- Users can update their own subscription (for webhook updates, use service role)
CREATE POLICY "Users can update own subscription" ON public.subscriptions 
  FOR UPDATE USING (auth.uid() = owner_user_id);

-- Create indexes
CREATE INDEX idx_subscriptions_owner ON public.subscriptions(owner_user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);

-- Function to check if establishment can create a professional
CREATE OR REPLACE FUNCTION public.can_create_professional(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_code text;
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

  -- Get subscription plan
  SELECT s.plan_code INTO v_plan_code
  FROM public.subscriptions s
  WHERE s.owner_user_id = v_owner_id AND s.status = 'active';

  -- If no subscription, use basic limits
  IF v_plan_code IS NULL THEN
    v_plan_code := 'basic';
  END IF;

  -- Get plan limits
  SELECT max_professionals INTO v_max_professionals
  FROM public.plans
  WHERE code = v_plan_code;

  -- Count current professionals
  SELECT COUNT(*) INTO v_current_count
  FROM public.professionals
  WHERE establishment_id = p_establishment_id AND active = true;

  IF v_current_count >= v_max_professionals THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', format('Você atingiu o limite de %s profissionais do plano %s', v_max_professionals, 
        CASE v_plan_code 
          WHEN 'basic' THEN 'Básico'
          WHEN 'essential' THEN 'Essencial'
          WHEN 'studio' THEN 'Studio'
          ELSE v_plan_code
        END),
      'current', v_current_count,
      'limit', v_max_professionals,
      'plan', v_plan_code
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_current_count, 'limit', v_max_professionals, 'plan', v_plan_code);
END;
$$;

-- Function to check if establishment can create an appointment
CREATE OR REPLACE FUNCTION public.can_create_appointment(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_code text;
  v_max_appointments integer;
  v_current_count integer;
  v_month_start timestamp with time zone;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Estabelecimento não encontrado');
  END IF;

  -- Get subscription plan
  SELECT s.plan_code INTO v_plan_code
  FROM public.subscriptions s
  WHERE s.owner_user_id = v_owner_id AND s.status = 'active';

  -- If no subscription, use basic limits
  IF v_plan_code IS NULL THEN
    v_plan_code := 'basic';
  END IF;

  -- Get plan limits
  SELECT max_appointments_month INTO v_max_appointments
  FROM public.plans
  WHERE code = v_plan_code;

  -- Calculate month start
  v_month_start := date_trunc('month', now());

  -- Count appointments this month (excluding canceled)
  SELECT COUNT(*) INTO v_current_count
  FROM public.appointments
  WHERE establishment_id = p_establishment_id
    AND created_at >= v_month_start
    AND status NOT IN ('canceled');

  IF v_current_count >= v_max_appointments THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', format('Este estabelecimento atingiu o limite de %s agendamentos do mês', v_max_appointments),
      'current', v_current_count,
      'limit', v_max_appointments,
      'plan', v_plan_code
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_current_count, 'limit', v_max_appointments, 'plan', v_plan_code);
END;
$$;

-- Function to check if user can create establishment
CREATE OR REPLACE FUNCTION public.can_create_establishment(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_plan_code text;
  v_allow_multi boolean;
  v_current_count integer;
BEGIN
  -- Get subscription plan
  SELECT s.plan_code INTO v_plan_code
  FROM public.subscriptions s
  WHERE s.owner_user_id = p_owner_id AND s.status = 'active';

  -- If no subscription, use basic limits
  IF v_plan_code IS NULL THEN
    v_plan_code := 'basic';
  END IF;

  -- Get plan limits
  SELECT allow_multi_establishments INTO v_allow_multi
  FROM public.plans
  WHERE code = v_plan_code;

  -- Count current establishments
  SELECT COUNT(*) INTO v_current_count
  FROM public.establishments
  WHERE owner_user_id = p_owner_id;

  -- Only Studio allows multiple establishments
  IF v_current_count >= 1 AND NOT v_allow_multi THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', 'Seu plano permite apenas 1 estabelecimento. Faça upgrade para o plano Studio.',
      'current', v_current_count,
      'plan', v_plan_code
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'current', v_current_count, 'plan', v_plan_code);
END;
$$;

-- Function to get subscription usage stats
CREATE OR REPLACE FUNCTION public.get_subscription_usage(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_owner_id uuid;
  v_plan record;
  v_subscription record;
  v_professionals_count integer;
  v_appointments_count integer;
  v_month_start timestamp with time zone;
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
  WHERE owner_user_id = v_owner_id AND status = 'active';

  -- Get plan (default to basic if no subscription)
  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = COALESCE(v_subscription.plan_code, 'basic');

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
      'code', v_plan.code,
      'name', v_plan.name,
      'price_cents', v_plan.price_cents,
      'max_professionals', v_plan.max_professionals,
      'max_appointments_month', v_plan.max_appointments_month,
      'allow_multi_establishments', v_plan.allow_multi_establishments
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