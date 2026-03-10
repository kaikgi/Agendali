-- Register the real Agendali product from Kiwify with its actual product_id
INSERT INTO public.kiwify_products (kiwify_product_id, product_name, plan_code, active)
VALUES ('8b362f00-efd2-11f0-bd88-6ba832508a8b', 'Agendali', 'solo', true)
ON CONFLICT DO NOTHING;

-- Fix existing products to use correct plan_codes
UPDATE public.kiwify_products SET plan_code = 'solo' WHERE plan_code = 'basico';
UPDATE public.kiwify_products SET plan_code = 'pro' WHERE plan_code = 'essencial';