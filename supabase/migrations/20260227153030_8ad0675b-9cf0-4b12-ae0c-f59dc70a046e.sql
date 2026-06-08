
-- Add trial columns to establishments
ALTER TABLE public.establishments 
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'trial';

-- Set existing establishments to 'active' (they already paid)
UPDATE public.establishments SET status = 'active' WHERE status = 'trial';

-- For new establishments, default trial_ends_at to now + 7 days via trigger
CREATE OR REPLACE FUNCTION public.set_trial_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := now() + interval '7 days';
  END IF;
  IF NEW.status IS NULL OR NEW.status = '' THEN
    NEW.status := 'trial';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_trial_defaults_trigger
  BEFORE INSERT ON public.establishments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trial_defaults();

-- Update can_establishment_accept_bookings to check trial status
CREATE OR REPLACE FUNCTION public.can_establishment_accept_bookings(p_establishment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id uuid;
  v_establishment record;
  v_subscription record;
  v_result jsonb;
BEGIN
  -- Get establishment details
  SELECT * INTO v_establishment
  FROM public.establishments
  WHERE id = p_establishment_id AND booking_enabled = true;

  IF v_establishment IS NULL THEN
    RETURN jsonb_build_object(
      'can_accept', false,
      'reason', 'Estabelecimento não encontrado ou agendamentos desativados'
    );
  END IF;

  v_owner_id := v_establishment.owner_user_id;

  -- Check trial status
  IF v_establishment.status = 'trial' AND v_establishment.trial_ends_at < now() THEN
    RETURN jsonb_build_object(
      'can_accept', false,
      'reason', 'Estabelecimento temporariamente indisponível para novos agendamentos online.',
      'error_code', 'TRIAL_EXPIRED'
    );
  END IF;

  -- Check subscription status (only for non-trial)
  IF v_establishment.status = 'active' THEN
    SELECT * INTO v_subscription
    FROM public.subscriptions
    WHERE owner_user_id = v_owner_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_subscription IS NOT NULL AND v_subscription.status NOT IN ('active', 'trialing') THEN
      RETURN jsonb_build_object(
        'can_accept', false,
        'reason', 'Este estabelecimento atingiu o limite do plano e não pode receber agendamentos no momento',
        'error_code', 'SUBSCRIPTION_INACTIVE'
      );
    END IF;
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
$function$;
