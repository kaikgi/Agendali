
-- Change default max_future_days from 30 to 7
ALTER TABLE public.establishments ALTER COLUMN max_future_days SET DEFAULT 7;

-- Update existing establishments that still have the old default of 30
UPDATE public.establishments SET max_future_days = 7 WHERE max_future_days = 30;

-- Update public_create_appointment to validate max_future_days window
CREATE OR REPLACE FUNCTION public.public_create_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_start_at timestamp with time zone,
  p_end_at timestamp with time zone,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL::text,
  p_customer_notes text DEFAULT NULL::text,
  p_customer_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(appointment_id uuid, manage_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_establishment_id uuid;
  v_max_future_days int;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_token text;
  v_token_hash text;
BEGIN
  -- 1. Find establishment by slug
  SELECT id, max_future_days INTO v_establishment_id, v_max_future_days
  FROM public.establishments
  WHERE slug = p_slug AND booking_enabled = true;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado ou agendamento desativado';
  END IF;

  -- 2. Validate booking window: start_at must be within max_future_days from now
  IF p_start_at > (now() + (v_max_future_days || ' days')::interval) THEN
    RAISE EXCEPTION 'Data fora da janela de agendamento permitida (máximo % dias no futuro)', v_max_future_days;
  END IF;

  IF p_start_at <= now() THEN
    RAISE EXCEPTION 'Não é possível agendar no passado';
  END IF;

  -- 3. Find or create customer (match by phone + establishment)
  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.establishment_id = v_establishment_id
    AND c.phone = p_customer_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (establishment_id, name, phone, email)
    VALUES (v_establishment_id, p_customer_name, p_customer_phone, p_customer_email)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET name = COALESCE(NULLIF(p_customer_name, ''), name),
        email = COALESCE(NULLIF(p_customer_email, ''), email)
    WHERE id = v_customer_id;
  END IF;

  -- 4. Create appointment
  INSERT INTO public.appointments (
    establishment_id, service_id, professional_id,
    customer_id, customer_user_id,
    start_at, end_at,
    customer_notes, status
  )
  VALUES (
    v_establishment_id, p_service_id, p_professional_id,
    v_customer_id, p_customer_user_id,
    p_start_at, p_end_at,
    p_customer_notes, 'booked'
  )
  RETURNING id INTO v_appointment_id;

  -- 5. Generate manage token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash)
  VALUES (v_appointment_id, v_token_hash);

  -- 6. Return result
  RETURN QUERY SELECT v_appointment_id, v_token;
END;
$function$;
