
-- Create kiwify_products mapping table
CREATE TABLE IF NOT EXISTS public.kiwify_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name text,
  kiwify_product_id text,
  kiwify_offer_id text,
  kiwify_checkout_url text,
  plan_code text NOT NULL REFERENCES public.plans(code),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kiwify_products ENABLE ROW LEVEL SECURITY;

-- Only admin via service role
CREATE POLICY "Admin select kiwify_products"
  ON public.kiwify_products FOR SELECT
  USING (is_admin());

-- Seed with the 3 Agendali checkouts
INSERT INTO public.kiwify_products (product_name, kiwify_checkout_url, plan_code)
VALUES
  ('Agendali Básico', 'https://pay.kiwify.com.br/6pi4D4u', 'basic'),
  ('Agendali Essencial', 'https://pay.kiwify.com.br/XXG8JDp', 'essential'),
  ('Agendali Studio', 'https://pay.kiwify.com.br/gDSvrq6', 'studio');

-- Add product tracking columns to billing_webhook_events for debug
ALTER TABLE public.billing_webhook_events
  ADD COLUMN IF NOT EXISTS kiwify_product_id text,
  ADD COLUMN IF NOT EXISTS ignored boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ignore_reason text;
