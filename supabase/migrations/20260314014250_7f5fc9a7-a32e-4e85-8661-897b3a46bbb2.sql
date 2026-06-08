-- Add bypass_payment column to client_tags for future use
ALTER TABLE public.client_tags ADD COLUMN IF NOT EXISTS bypass_payment boolean NOT NULL DEFAULT false;

-- Create the missing function that public_create_appointment depends on
CREATE OR REPLACE FUNCTION public.customer_has_bypass_payment(p_customer_id uuid, p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_tag_assignments cta
    JOIN public.client_tags ct ON ct.id = cta.tag_id
    WHERE cta.customer_id = p_customer_id
      AND cta.establishment_id = p_establishment_id
      AND ct.bypass_payment = true
      AND ct.is_active = true
  );
$$;