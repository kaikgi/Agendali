-- Fix the RPC to use fully qualified pgcrypto functions
CREATE OR REPLACE FUNCTION public.public_create_appointment(
  p_slug text, 
  p_service_id uuid, 
  p_professional_id uuid, 
  p_start_at timestamp with time zone, 
  p_end_at timestamp with time zone, 
  p_customer_name text, 
  p_customer_phone text, 
  p_customer_email text DEFAULT NULL::text, 
  p_customer_notes text DEFAULT NULL::text
)
RETURNS TABLE(appointment_id uuid, manage_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_establishment_id uuid;
  v_auto_confirm boolean;
  v_customer_id uuid;
  v_token text;
  v_token_hash text;
BEGIN
  -- Validate establishment
  SELECT e.id, e.auto_confirm_bookings
    INTO v_establishment_id, v_auto_confirm
  FROM public.establishments e
  WHERE e.slug = p_slug
    AND e.booking_enabled = true
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado ou agendamento desativado';
  END IF;

  -- Validate service/professional belong to establishment and are active
  IF NOT EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = p_service_id
      AND s.establishment_id = v_establishment_id
      AND s.active = true
  ) THEN
    RAISE EXCEPTION 'Serviço inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = p_professional_id
      AND p.establishment_id = v_establishment_id
      AND p.active = true
  ) THEN
    RAISE EXCEPTION 'Profissional inválido';
  END IF;

  -- Validate times
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'Horário inválido';
  END IF;

  -- Availability re-check (appointments)
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.establishment_id = v_establishment_id
      AND a.professional_id = p_professional_id
      AND a.status IN ('booked', 'confirmed')
      AND a.start_at < p_end_at
      AND a.end_at > p_start_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro horário.';
  END IF;

  -- Availability re-check (time_blocks)
  IF EXISTS (
    SELECT 1
    FROM public.time_blocks tb
    WHERE tb.establishment_id = v_establishment_id
      AND (tb.professional_id IS NULL OR tb.professional_id = p_professional_id)
      AND tb.start_at < p_end_at
      AND tb.end_at > p_start_at
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Este horário está bloqueado. Escolha outro horário.';
  END IF;

  -- Find or create customer (by establishment + phone)
  SELECT c.id
    INTO v_customer_id
  FROM public.customers c
  WHERE c.establishment_id = v_establishment_id
    AND c.phone = p_customer_phone
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (establishment_id, name, phone, email)
    VALUES (v_establishment_id, p_customer_name, p_customer_phone, p_customer_email)
    RETURNING id INTO v_customer_id;
  ELSE
    -- best-effort update
    UPDATE public.customers
    SET name = p_customer_name,
        email = p_customer_email
    WHERE id = v_customer_id;
  END IF;

  -- Create appointment
  INSERT INTO public.appointments (
    establishment_id,
    professional_id,
    service_id,
    customer_id,
    start_at,
    end_at,
    status,
    customer_notes
  )
  VALUES (
    v_establishment_id,
    p_professional_id,
    p_service_id,
    v_customer_id,
    p_start_at,
    p_end_at,
    CASE WHEN v_auto_confirm THEN 'confirmed'::appointment_status ELSE 'booked'::appointment_status END,
    p_customer_notes
  )
  RETURNING id INTO appointment_id;

  -- Create management token using pgcrypto functions (now in search_path)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash, expires_at)
  VALUES (appointment_id, v_token_hash, now() + interval '30 days');

  manage_token := v_token;
  RETURN NEXT;
END;
$function$;