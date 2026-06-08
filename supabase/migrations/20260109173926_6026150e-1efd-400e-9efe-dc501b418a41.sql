-- Public booking hardening: move public appointment creation to a SECURITY DEFINER RPC
-- This allows anonymous customers to book without opening direct INSERT policies on sensitive tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) RPC: public_create_appointment
-- Returns a plaintext manage token (stored hashed) + appointment_id.
CREATE OR REPLACE FUNCTION public.public_create_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL
)
RETURNS TABLE (
  appointment_id uuid,
  manage_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Create management token (store hash, return plaintext)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash, expires_at)
  VALUES (appointment_id, v_token_hash, now() + interval '30 days');

  manage_token := v_token;
  RETURN NEXT;
END;
$$;

-- 2) Lock down: remove direct public INSERT policies (RPC handles it)
DROP POLICY IF EXISTS "Public can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Public can insert appointments" ON public.appointments;
DROP POLICY IF EXISTS "Public can insert tokens" ON public.appointment_manage_tokens;

-- Keep existing public SELECT policies only where intended (e.g. establishments/services/professionals).
