
-- =============================================================
-- ONLINE PAYMENT SYSTEM (Mercado Pago)
-- =============================================================

-- 1. Payment Accounts: MP OAuth credentials per establishment
CREATE TABLE public.payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  access_token text NOT NULL,
  refresh_token text,
  mp_user_id text,
  mp_public_key text,
  expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, provider)
);

CREATE INDEX idx_payment_accounts_est ON public.payment_accounts(establishment_id);

-- 2. Payment Settings: configuration per establishment
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE UNIQUE,
  online_payment_enabled boolean NOT NULL DEFAULT false,
  -- Deposit/signal config
  deposit_required boolean NOT NULL DEFAULT false,
  deposit_type text NOT NULL DEFAULT 'fixed' CHECK (deposit_type IN ('fixed', 'percentage')),
  deposit_value numeric(10,2) NOT NULL DEFAULT 0,
  -- Full payment online
  full_payment_online boolean NOT NULL DEFAULT false,
  -- Per-service overrides (if false, global rules apply)
  per_service_config boolean NOT NULL DEFAULT false,
  -- Confirmation
  require_manual_confirmation boolean NOT NULL DEFAULT false,
  -- Refund policy
  refund_on_cancellation boolean NOT NULL DEFAULT false,
  refund_deadline_hours integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Per-service payment overrides
CREATE TABLE public.service_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  deposit_required boolean NOT NULL DEFAULT false,
  deposit_type text NOT NULL DEFAULT 'fixed' CHECK (deposit_type IN ('fixed', 'percentage')),
  deposit_value numeric(10,2) NOT NULL DEFAULT 0,
  full_payment_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(establishment_id, service_id)
);

CREATE INDEX idx_service_payment_settings_est ON public.service_payment_settings(establishment_id);

-- 4. Appointment Payments: tracks each payment
CREATE TABLE public.appointment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_payment_id text,
  provider_preference_id text,
  payment_type text NOT NULL DEFAULT 'deposit' CHECK (payment_type IN ('deposit', 'full')),
  amount_cents integer NOT NULL,
  fee_cents integer NOT NULL DEFAULT 0,
  net_amount_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'refunded', 'in_process')),
  payment_url text,
  payer_email text,
  paid_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointment_payments_est ON public.appointment_payments(establishment_id);
CREATE INDEX idx_appointment_payments_apt ON public.appointment_payments(appointment_id);
CREATE INDEX idx_appointment_payments_provider ON public.appointment_payments(provider_payment_id);
CREATE INDEX idx_appointment_payments_status ON public.appointment_payments(status);

-- 5. Payment Webhook Events: idempotent event log
CREATE TABLE public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'mercadopago',
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

-- =============================================================
-- RLS POLICIES
-- =============================================================

ALTER TABLE public.payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- payment_accounts: owner only
CREATE POLICY "Owner can manage payment_accounts" ON public.payment_accounts
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()));

-- payment_settings: owner can manage
CREATE POLICY "Owner can manage payment_settings" ON public.payment_settings
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()));

-- payment_settings: public can read for booking flow
CREATE POLICY "Public can read payment_settings" ON public.payment_settings
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM establishments WHERE booking_enabled = true));

-- service_payment_settings: owner manage + public read
CREATE POLICY "Owner can manage service_payment_settings" ON public.service_payment_settings
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()));

CREATE POLICY "Public can read service_payment_settings" ON public.service_payment_settings
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM establishments WHERE booking_enabled = true));

-- appointment_payments: owner can read
CREATE POLICY "Owner can read appointment_payments" ON public.appointment_payments
  FOR SELECT TO authenticated
  USING (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()));

-- appointment_payments: admin can read all
CREATE POLICY "Admin can read appointment_payments" ON public.appointment_payments
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- payment_webhook_events: admin only
CREATE POLICY "Admin can read payment_webhook_events" ON public.payment_webhook_events
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER set_payment_accounts_updated_at BEFORE UPDATE ON public.payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_payment_settings_updated_at BEFORE UPDATE ON public.payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_appointment_payments_updated_at BEFORE UPDATE ON public.appointment_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================
-- RPC: Get payment config for booking (public, secure)
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_payment_config_for_booking(p_slug text, p_service_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_est record;
  v_settings record;
  v_service_settings record;
  v_has_account boolean;
  v_result jsonb;
BEGIN
  SELECT id INTO v_est FROM establishments WHERE slug = p_slug AND booking_enabled = true;
  IF v_est IS NULL THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT * INTO v_settings FROM payment_settings WHERE establishment_id = v_est.id;
  IF v_settings IS NULL OR NOT v_settings.online_payment_enabled THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  SELECT EXISTS(SELECT 1 FROM payment_accounts WHERE establishment_id = v_est.id AND status = 'active') INTO v_has_account;
  IF NOT v_has_account THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;

  -- Check per-service override
  IF v_settings.per_service_config AND p_service_id IS NOT NULL THEN
    SELECT * INTO v_service_settings FROM service_payment_settings
    WHERE establishment_id = v_est.id AND service_id = p_service_id;

    IF v_service_settings IS NOT NULL THEN
      RETURN jsonb_build_object(
        'enabled', true,
        'deposit_required', v_service_settings.deposit_required,
        'deposit_type', v_service_settings.deposit_type,
        'deposit_value', v_service_settings.deposit_value,
        'full_payment_online', v_service_settings.full_payment_online,
        'require_manual_confirmation', v_settings.require_manual_confirmation
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'deposit_required', v_settings.deposit_required,
    'deposit_type', v_settings.deposit_type,
    'deposit_value', v_settings.deposit_value,
    'full_payment_online', v_settings.full_payment_online,
    'require_manual_confirmation', v_settings.require_manual_confirmation
  );
END;
$$;
