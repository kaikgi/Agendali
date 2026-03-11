
-- =============================================================
-- COMMISSION MANAGEMENT SYSTEM
-- Tables: commission_rules, commission_entries, commission_settlements
-- =============================================================

-- 1. Commission Rules: configurable per professional + service
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE CASCADE,
  commission_type text NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage', 'fixed')),
  commission_value numeric(10, 2) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique: one rule per professional+service (or one default per professional)
CREATE UNIQUE INDEX commission_rules_prof_service_unique
  ON public.commission_rules (professional_id, COALESCE(service_id, '00000000-0000-0000-0000-000000000000'))
  WHERE active = true;

CREATE INDEX idx_commission_rules_establishment ON public.commission_rules(establishment_id);
CREATE INDEX idx_commission_rules_professional ON public.commission_rules(professional_id);

-- 2. Commission Entries: snapshot at completion time (immutable audit trail)
CREATE TABLE public.commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE SET NULL,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- Snapshot fields (frozen at completion time)
  service_name text NOT NULL,
  service_price_cents integer NOT NULL DEFAULT 0,
  professional_name text NOT NULL,
  customer_name text,
  commission_type text NOT NULL,
  commission_value numeric(10, 2) NOT NULL,
  commission_amount_cents integer NOT NULL,
  appointment_date timestamptz NOT NULL,
  -- Settlement tracking
  settlement_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'settled', 'voided')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX commission_entries_appointment_unique ON public.commission_entries(appointment_id);
CREATE INDEX idx_commission_entries_establishment ON public.commission_entries(establishment_id);
CREATE INDEX idx_commission_entries_professional ON public.commission_entries(professional_id);
CREATE INDEX idx_commission_entries_date ON public.commission_entries(appointment_date);
CREATE INDEX idx_commission_entries_settlement ON public.commission_entries(settlement_id);
CREATE INDEX idx_commission_entries_status ON public.commission_entries(status);

-- 3. Commission Settlements: payment batches
CREATE TABLE public.commission_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_amount_cents integer NOT NULL DEFAULT 0,
  entries_count integer NOT NULL DEFAULT 0,
  notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_settlements_establishment ON public.commission_settlements(establishment_id);
CREATE INDEX idx_commission_settlements_professional ON public.commission_settlements(professional_id);

-- Add FK from entries to settlements
ALTER TABLE public.commission_entries
  ADD CONSTRAINT commission_entries_settlement_fkey
  FOREIGN KEY (settlement_id) REFERENCES public.commission_settlements(id) ON DELETE SET NULL;

-- =============================================================
-- RLS POLICIES
-- =============================================================

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;

-- commission_rules: owner can manage
CREATE POLICY "Owner can manage commission_rules" ON public.commission_rules
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

-- commission_entries: owner can read (no direct insert/update from client)
CREATE POLICY "Owner can read commission_entries" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

-- commission_entries: admin can read all
CREATE POLICY "Admin can read commission_entries" ON public.commission_entries
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- commission_settlements: owner can manage
CREATE POLICY "Owner can manage commission_settlements" ON public.commission_settlements
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM public.establishments WHERE owner_user_id = auth.uid()));

-- =============================================================
-- FUNCTION: Snapshot commission on appointment completion
-- =============================================================
CREATE OR REPLACE FUNCTION public.snapshot_commission_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_service record;
  v_professional record;
  v_customer record;
  v_rule record;
  v_amount_cents integer;
  v_est record;
BEGIN
  -- Only fire when status changes TO 'completed'
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if establishment has commissions (Studio or Pro plan)
  SELECT e.id, e.plano INTO v_est
  FROM public.establishments e WHERE e.id = NEW.establishment_id;

  IF v_est.plano IS NULL OR lower(v_est.plano) NOT IN ('studio', 'pro') THEN
    RETURN NEW;
  END IF;

  -- Get service info
  SELECT s.name, s.price_cents, s.id INTO v_service
  FROM public.services s WHERE s.id = NEW.service_id;

  -- Get professional info
  SELECT p.name, p.id INTO v_professional
  FROM public.professionals p WHERE p.id = NEW.professional_id;

  -- Get customer info
  SELECT c.name INTO v_customer
  FROM public.customers c WHERE c.id = NEW.customer_id;

  -- Find applicable commission rule: specific service first, then default
  SELECT cr.* INTO v_rule
  FROM public.commission_rules cr
  WHERE cr.professional_id = NEW.professional_id
    AND cr.service_id = NEW.service_id
    AND cr.active = true
    AND cr.effective_from <= now()
  ORDER BY cr.effective_from DESC
  LIMIT 1;

  IF v_rule IS NULL THEN
    -- Try default rule for this professional
    SELECT cr.* INTO v_rule
    FROM public.commission_rules cr
    WHERE cr.professional_id = NEW.professional_id
      AND cr.is_default = true
      AND cr.active = true
      AND cr.effective_from <= now()
    ORDER BY cr.effective_from DESC
    LIMIT 1;
  END IF;

  -- No rule found = no commission to record
  IF v_rule IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate commission amount
  IF v_rule.commission_type = 'percentage' THEN
    v_amount_cents := ROUND((COALESCE(v_service.price_cents, 0) * v_rule.commission_value) / 100);
  ELSE
    v_amount_cents := ROUND(v_rule.commission_value * 100);
  END IF;

  -- Insert commission entry (snapshot)
  INSERT INTO public.commission_entries (
    establishment_id, professional_id, appointment_id, service_id, customer_id,
    service_name, service_price_cents, professional_name, customer_name,
    commission_type, commission_value, commission_amount_cents,
    appointment_date, status
  ) VALUES (
    NEW.establishment_id, NEW.professional_id, NEW.id, NEW.service_id, NEW.customer_id,
    COALESCE(v_service.name, 'Serviço'),
    COALESCE(v_service.price_cents, 0),
    COALESCE(v_professional.name, 'Profissional'),
    v_customer.name,
    v_rule.commission_type,
    v_rule.commission_value,
    v_amount_cents,
    NEW.start_at,
    'pending'
  ) ON CONFLICT (appointment_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create trigger on appointments
CREATE TRIGGER trg_snapshot_commission_on_complete
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.snapshot_commission_on_complete();

-- Also trigger on insert (for auto-confirmed completed)
CREATE TRIGGER trg_snapshot_commission_on_insert
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION public.snapshot_commission_on_complete();

-- Updated_at trigger for commission_rules
CREATE TRIGGER set_commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
