
-- 1. Tabela de idempotência de webhooks
CREATE TABLE public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'kiwify',
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  kiwify_product_id text,
  processed_at timestamptz,
  processing_error text,
  ignored boolean DEFAULT false,
  ignore_reason text,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Índice único para idempotência (provider + event_id)
CREATE UNIQUE INDEX idx_billing_webhook_events_event_id ON public.billing_webhook_events (event_id);

-- 2. Tabela de mapeamento de produtos Kiwify → planos Agendali
CREATE TABLE public.kiwify_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kiwify_product_id text UNIQUE,
  product_name text NOT NULL,
  plan_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Inserir produtos padrão
INSERT INTO public.kiwify_products (product_name, plan_code) VALUES
  ('Agendali Básico', 'basico'),
  ('Agendali Essencial', 'essencial'),
  ('Agendali Studio', 'studio');

-- 3. Tabela de signups autorizados (comprou na Kiwify mas ainda não criou conta)
CREATE TABLE public.allowed_establishment_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  plan_id text NOT NULL,
  kiwify_order_id text,
  paid_at timestamptz,
  used boolean NOT NULL DEFAULT false,
  activation_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: desabilitado para essas tabelas operacionais (acessadas via service role)
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kiwify_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_establishment_signups ENABLE ROW LEVEL SECURITY;

-- Políticas para admin apenas
CREATE POLICY "Admins can view webhook events"
  ON public.billing_webhook_events FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view kiwify products"
  ON public.kiwify_products FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage kiwify products"
  ON public.kiwify_products FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can view allowed signups"
  ON public.allowed_establishment_signups FOR SELECT
  USING (public.is_admin(auth.uid()));
