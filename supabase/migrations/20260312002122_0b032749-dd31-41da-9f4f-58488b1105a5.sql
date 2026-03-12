
-- Client tags table (per establishment)
CREATE TABLE public.client_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  bypass_approval boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (establishment_id, name)
);

ALTER TABLE public.client_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage client_tags" ON public.client_tags
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()));

CREATE POLICY "Public can read client_tags" ON public.client_tags
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM establishments WHERE booking_enabled = true));

-- Customer ↔ Tag assignments
CREATE TABLE public.customer_tag_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.client_tags(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, tag_id)
);

ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage customer_tag_assignments" ON public.customer_tag_assignments
  FOR ALL TO authenticated
  USING (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()))
  WITH CHECK (establishment_id IN (SELECT id FROM establishments WHERE owner_user_id = auth.uid()));

CREATE POLICY "Public can read customer_tag_assignments" ON public.customer_tag_assignments
  FOR SELECT TO public
  USING (establishment_id IN (SELECT id FROM establishments WHERE booking_enabled = true));

-- Function to check if a customer has bypass approval via tags
CREATE OR REPLACE FUNCTION public.customer_has_bypass_approval(
  p_customer_id uuid,
  p_establishment_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM customer_tag_assignments cta
    JOIN client_tags ct ON ct.id = cta.tag_id
    WHERE cta.customer_id = p_customer_id
      AND cta.establishment_id = p_establishment_id
      AND ct.is_active = true
      AND ct.bypass_approval = true
  )
$$;
