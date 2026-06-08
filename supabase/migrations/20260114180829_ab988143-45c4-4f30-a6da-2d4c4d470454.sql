-- Table to track who can sign up as establishment (paid via Kiwify)
CREATE TABLE IF NOT EXISTS public.allowed_establishment_signups (
  email text PRIMARY KEY,
  plan_id text NOT NULL REFERENCES public.plans(code),
  kiwify_order_id text UNIQUE NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.allowed_establishment_signups ENABLE ROW LEVEL SECURITY;

-- Only service role can manage this table
CREATE POLICY "Service role only" ON public.allowed_establishment_signups
  FOR ALL USING (false);

-- Create index for fast email lookup
CREATE INDEX IF NOT EXISTS idx_allowed_signups_email ON public.allowed_establishment_signups(email);
CREATE INDEX IF NOT EXISTS idx_allowed_signups_used ON public.allowed_establishment_signups(used) WHERE used = false;

-- Function to check if email is allowed to sign up as establishment
CREATE OR REPLACE FUNCTION public.check_establishment_signup_allowed(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup record;
BEGIN
  -- Check if email exists and is not used
  SELECT * INTO v_signup
  FROM public.allowed_establishment_signups
  WHERE email = lower(trim(p_email))
    AND used = false;
  
  IF v_signup IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Para criar conta de Estabelecimento, é necessário adquirir um plano primeiro.',
      'action', 'purchase_required'
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'plan_id', v_signup.plan_id,
    'kiwify_order_id', v_signup.kiwify_order_id
  );
END;
$$;

-- Function to mark signup as used and create subscription
CREATE OR REPLACE FUNCTION public.use_establishment_signup(p_email text, p_owner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup record;
BEGIN
  -- Get and lock the signup record
  SELECT * INTO v_signup
  FROM public.allowed_establishment_signups
  WHERE email = lower(trim(p_email))
    AND used = false
  FOR UPDATE;
  
  IF v_signup IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Signup não encontrado ou já utilizado');
  END IF;
  
  -- Mark as used
  UPDATE public.allowed_establishment_signups
  SET used = true
  WHERE email = v_signup.email;
  
  -- Create subscription for the user
  INSERT INTO public.subscriptions (
    owner_user_id,
    plan_code,
    status,
    provider,
    provider_order_id,
    buyer_email,
    current_period_start,
    current_period_end
  ) VALUES (
    p_owner_user_id,
    v_signup.plan_id,
    'active',
    'kiwify',
    v_signup.kiwify_order_id,
    v_signup.email,
    now(),
    now() + interval '30 days'
  )
  ON CONFLICT (owner_user_id) DO UPDATE SET
    plan_code = EXCLUDED.plan_code,
    status = 'active',
    provider_order_id = EXCLUDED.provider_order_id,
    current_period_start = now(),
    current_period_end = now() + interval '30 days',
    updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true,
    'plan_id', v_signup.plan_id
  );
END;
$$;