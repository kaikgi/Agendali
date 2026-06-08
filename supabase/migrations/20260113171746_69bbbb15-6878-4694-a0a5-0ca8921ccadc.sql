-- =====================================================
-- KIWIFY INTEGRATION: Full Database Setup
-- =====================================================

-- 1) Update plans table with new columns
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS max_establishments integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_professionals_per_establishment integer DEFAULT 1;

-- Update existing plans with correct values
UPDATE public.plans SET 
  max_establishments = 1,
  max_professionals_per_establishment = 1
WHERE code = 'basic';

UPDATE public.plans SET 
  max_establishments = 1,
  max_professionals_per_establishment = 3
WHERE code = 'essential';

UPDATE public.plans SET 
  max_establishments = NULL, -- unlimited
  max_professionals_per_establishment = 10
WHERE code = 'studio';

-- 2) Update subscriptions table with Kiwify fields
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS provider text DEFAULT 'kiwify',
ADD COLUMN IF NOT EXISTS provider_customer_id text,
ADD COLUMN IF NOT EXISTS provider_subscription_id text,
ADD COLUMN IF NOT EXISTS provider_order_id text,
ADD COLUMN IF NOT EXISTS buyer_email text,
ADD COLUMN IF NOT EXISTS raw_last_event jsonb;

-- Rename external_id to provider_subscription_id if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subscriptions' 
    AND column_name = 'external_id'
    AND table_schema = 'public'
  ) THEN
    UPDATE public.subscriptions 
    SET provider_subscription_id = external_id 
    WHERE provider_subscription_id IS NULL AND external_id IS NOT NULL;
  END IF;
END $$;

-- 3) Create billing_webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'kiwify',
  event_id text NOT NULL,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  UNIQUE(provider, event_id)
);

-- Enable RLS
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

-- Only system/service role can access webhook events
CREATE POLICY "Service role only" ON public.billing_webhook_events
FOR ALL USING (false);

-- 4) Create establishment_monthly_usage table
CREATE TABLE IF NOT EXISTS public.establishment_monthly_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL,
  appointments_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, year, month)
);

-- Enable RLS
ALTER TABLE public.establishment_monthly_usage ENABLE ROW LEVEL SECURITY;

-- Members can view usage
CREATE POLICY "Members can view usage" ON public.establishment_monthly_usage
FOR SELECT USING (is_establishment_member(establishment_id));

-- System can manage usage (for triggers)
CREATE POLICY "System can manage usage" ON public.establishment_monthly_usage
FOR ALL USING (true);

-- 5) Create function to get active plan for an establishment
CREATE OR REPLACE FUNCTION public.get_active_plan_for_establishment(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_subscription record;
  v_plan record;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = p_establishment_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'establishment_not_found');
  END IF;

  -- Get active subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE owner_user_id = v_owner_id
    AND status = 'active'
  LIMIT 1;

  -- Get plan details (default to basic if no subscription)
  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = COALESCE(v_subscription.plan_code, 'basic');

  RETURN jsonb_build_object(
    'plan_code', v_plan.code,
    'plan_name', v_plan.name,
    'max_establishments', v_plan.max_establishments,
    'max_professionals_per_establishment', COALESCE(v_plan.max_professionals_per_establishment, v_plan.max_professionals),
    'max_appointments_per_month', v_plan.max_appointments_month,
    'subscription_status', COALESCE(v_subscription.status, 'none'),
    'current_period_end', v_subscription.current_period_end
  );
END;
$$;

-- 6) Create function to check subscription status for owner
CREATE OR REPLACE FUNCTION public.get_owner_subscription_status(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription record;
  v_plan record;
BEGIN
  -- Get active subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE owner_user_id = p_owner_id
    AND status = 'active'
  LIMIT 1;

  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'has_subscription', false,
      'status', 'none',
      'plan_code', 'basic'
    );
  END IF;

  -- Get plan details
  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = v_subscription.plan_code;

  RETURN jsonb_build_object(
    'has_subscription', true,
    'status', v_subscription.status,
    'plan_code', v_subscription.plan_code,
    'plan_name', v_plan.name,
    'current_period_end', v_subscription.current_period_end,
    'max_establishments', v_plan.max_establishments,
    'max_professionals_per_establishment', COALESCE(v_plan.max_professionals_per_establishment, v_plan.max_professionals),
    'max_appointments_per_month', v_plan.max_appointments_month
  );
END;
$$;

-- 7) Create trigger function to enforce professional limits
CREATE OR REPLACE FUNCTION public.enforce_professional_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_plan record;
  v_current_count integer;
  v_max_allowed integer;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = NEW.establishment_id;

  -- Get active subscription plan
  SELECT p.* INTO v_plan
  FROM public.plans p
  LEFT JOIN public.subscriptions s ON s.plan_code = p.code AND s.owner_user_id = v_owner_id AND s.status = 'active'
  WHERE p.code = COALESCE(s.plan_code, 'basic')
  LIMIT 1;

  -- Get max allowed (use max_professionals_per_establishment if exists, otherwise max_professionals)
  v_max_allowed := COALESCE(v_plan.max_professionals_per_establishment, v_plan.max_professionals);

  -- Count current active professionals in this establishment
  SELECT COUNT(*) INTO v_current_count
  FROM public.professionals
  WHERE establishment_id = NEW.establishment_id
    AND active = true;

  -- Check limit (NULL means unlimited - Studio plan)
  IF v_max_allowed IS NOT NULL AND v_current_count >= v_max_allowed THEN
    RAISE EXCEPTION 'PLAN_LIMIT_PROFESSIONALS: Limite de % profissionais atingido para o plano %', 
      v_max_allowed, v_plan.name;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on professionals table
DROP TRIGGER IF EXISTS check_professional_limit ON public.professionals;
CREATE TRIGGER check_professional_limit
  BEFORE INSERT ON public.professionals
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_professional_limit();

-- 8) Create trigger function to enforce establishment limits
CREATE OR REPLACE FUNCTION public.enforce_establishment_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan record;
  v_current_count integer;
BEGIN
  -- Get active subscription plan for this owner
  SELECT p.* INTO v_plan
  FROM public.plans p
  LEFT JOIN public.subscriptions s ON s.plan_code = p.code AND s.owner_user_id = NEW.owner_user_id AND s.status = 'active'
  WHERE p.code = COALESCE(s.plan_code, 'basic')
  LIMIT 1;

  -- Count current establishments for this owner
  SELECT COUNT(*) INTO v_current_count
  FROM public.establishments
  WHERE owner_user_id = NEW.owner_user_id;

  -- Check limit (NULL means unlimited - Studio plan)
  IF v_plan.max_establishments IS NOT NULL AND v_current_count >= v_plan.max_establishments THEN
    RAISE EXCEPTION 'PLAN_LIMIT_ESTABLISHMENTS: Limite de % estabelecimento(s) atingido para o plano %', 
      v_plan.max_establishments, v_plan.name;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on establishments table
DROP TRIGGER IF EXISTS check_establishment_limit ON public.establishments;
CREATE TRIGGER check_establishment_limit
  BEFORE INSERT ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_establishment_limit();

-- 9) Create function to increment appointment usage
CREATE OR REPLACE FUNCTION public.increment_appointment_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_month integer;
BEGIN
  v_year := EXTRACT(YEAR FROM NEW.created_at);
  v_month := EXTRACT(MONTH FROM NEW.created_at);

  INSERT INTO public.establishment_monthly_usage (establishment_id, year, month, appointments_count)
  VALUES (NEW.establishment_id, v_year, v_month, 1)
  ON CONFLICT (establishment_id, year, month)
  DO UPDATE SET 
    appointments_count = establishment_monthly_usage.appointments_count + 1,
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Create trigger to track appointment counts
DROP TRIGGER IF EXISTS track_appointment_usage ON public.appointments;
CREATE TRIGGER track_appointment_usage
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_appointment_usage();

-- 10) Create trigger function to enforce appointment limits
CREATE OR REPLACE FUNCTION public.enforce_appointment_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_plan record;
  v_current_count integer;
  v_year integer;
  v_month integer;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = NEW.establishment_id;

  -- Get active subscription plan
  SELECT p.* INTO v_plan
  FROM public.plans p
  LEFT JOIN public.subscriptions s ON s.plan_code = p.code AND s.owner_user_id = v_owner_id AND s.status = 'active'
  WHERE p.code = COALESCE(s.plan_code, 'basic')
  LIMIT 1;

  -- Get current month usage
  v_year := EXTRACT(YEAR FROM now());
  v_month := EXTRACT(MONTH FROM now());

  SELECT COALESCE(appointments_count, 0) INTO v_current_count
  FROM public.establishment_monthly_usage
  WHERE establishment_id = NEW.establishment_id
    AND year = v_year
    AND month = v_month;

  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  -- Check limit (NULL means unlimited - Studio plan)
  IF v_plan.max_appointments_month IS NOT NULL AND v_current_count >= v_plan.max_appointments_month THEN
    RAISE EXCEPTION 'PLAN_LIMIT_APPOINTMENTS: Limite de % agendamentos/mês atingido para o plano %', 
      v_plan.max_appointments_month, v_plan.name;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS check_appointment_limit ON public.appointments;
CREATE TRIGGER check_appointment_limit
  BEFORE INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_appointment_limit();

-- 11) Update existing can_create_professional function to return consistent format
CREATE OR REPLACE FUNCTION public.can_create_professional(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_code text;
  v_max_professionals integer;
  v_current_count integer;
  v_plan_name text;
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

  -- If no active subscription, use basic limits
  IF v_plan_code IS NULL THEN
    v_plan_code := 'basic';
  END IF;

  -- Get plan limits
  SELECT 
    COALESCE(max_professionals_per_establishment, max_professionals),
    name
  INTO v_max_professionals, v_plan_name
  FROM public.plans
  WHERE code = v_plan_code;

  -- Count current active professionals
  SELECT COUNT(*) INTO v_current_count
  FROM public.professionals
  WHERE establishment_id = p_establishment_id AND active = true;

  IF v_max_professionals IS NOT NULL AND v_current_count >= v_max_professionals THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', format('Você atingiu o limite de %s profissionais do plano %s', v_max_professionals, v_plan_name),
      'current', v_current_count,
      'limit', v_max_professionals,
      'plan', v_plan_code,
      'error_code', 'PLAN_LIMIT_PROFESSIONALS'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 
    'current', v_current_count, 
    'limit', v_max_professionals, 
    'plan', v_plan_code
  );
END;
$$;

-- 12) Update can_create_appointment function
CREATE OR REPLACE FUNCTION public.can_create_appointment(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_plan_code text;
  v_max_appointments integer;
  v_current_count integer;
  v_plan_name text;
  v_year integer;
  v_month integer;
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

  -- If no active subscription, use basic limits
  IF v_plan_code IS NULL THEN
    v_plan_code := 'basic';
  END IF;

  -- Get plan limits
  SELECT max_appointments_month, name 
  INTO v_max_appointments, v_plan_name
  FROM public.plans
  WHERE code = v_plan_code;

  -- Get current month usage
  v_year := EXTRACT(YEAR FROM now());
  v_month := EXTRACT(MONTH FROM now());

  SELECT COALESCE(appointments_count, 0) INTO v_current_count
  FROM public.establishment_monthly_usage
  WHERE establishment_id = p_establishment_id
    AND year = v_year
    AND month = v_month;

  IF v_current_count IS NULL THEN
    v_current_count := 0;
  END IF;

  -- Check limit (NULL means unlimited)
  IF v_max_appointments IS NOT NULL AND v_current_count >= v_max_appointments THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'reason', format('Este estabelecimento atingiu o limite de %s agendamentos do mês', v_max_appointments),
      'current', v_current_count,
      'limit', v_max_appointments,
      'plan', v_plan_code,
      'error_code', 'PLAN_LIMIT_APPOINTMENTS'
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true, 
    'current', v_current_count, 
    'limit', v_max_appointments, 
    'plan', v_plan_code
  );
END;
$$;

-- 13) Create helper function to check if establishment can accept bookings
CREATE OR REPLACE FUNCTION public.can_establishment_accept_bookings(p_establishment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_subscription record;
  v_result jsonb;
BEGIN
  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM public.establishments
  WHERE id = p_establishment_id AND booking_enabled = true;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object(
      'can_accept', false,
      'reason', 'Estabelecimento não encontrado ou agendamentos desativados'
    );
  END IF;

  -- Check subscription status
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE owner_user_id = v_owner_id
  ORDER BY created_at DESC
  LIMIT 1;

  -- If subscription exists but not active, block
  IF v_subscription IS NOT NULL AND v_subscription.status NOT IN ('active', 'trialing') THEN
    RETURN jsonb_build_object(
      'can_accept', false,
      'reason', 'Este estabelecimento atingiu o limite do plano e não pode receber agendamentos no momento',
      'error_code', 'SUBSCRIPTION_INACTIVE'
    );
  END IF;

  -- Check appointment limits
  v_result := can_create_appointment(p_establishment_id);
  
  IF NOT (v_result->>'allowed')::boolean THEN
    RETURN jsonb_build_object(
      'can_accept', false,
      'reason', 'Este estabelecimento atingiu o limite do plano e não pode receber agendamentos no momento',
      'error_code', v_result->>'error_code'
    );
  END IF;

  RETURN jsonb_build_object('can_accept', true);
END;
$$;