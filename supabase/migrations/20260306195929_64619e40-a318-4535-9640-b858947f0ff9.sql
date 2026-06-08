
-- 1. Create appointment_manage_tokens table for self-service links
CREATE TABLE IF NOT EXISTS public.appointment_manage_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: public read by token_hash (no auth required), no write from client
ALTER TABLE public.appointment_manage_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tokens by hash"
  ON public.appointment_manage_tokens
  FOR SELECT
  USING (true);

-- 2. Create public_create_appointment RPC
-- This function creates an appointment + customer + manage token in one transaction
CREATE OR REPLACE FUNCTION public.public_create_appointment(
  p_slug text,
  p_service_id uuid,
  p_professional_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text DEFAULT NULL,
  p_customer_notes text DEFAULT NULL,
  p_customer_user_id uuid DEFAULT NULL
)
RETURNS TABLE(appointment_id uuid, manage_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
SET row_security = 'off'
AS $$
DECLARE
  v_establishment_id uuid;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_token text;
  v_token_hash text;
BEGIN
  -- 1. Find establishment by slug
  SELECT id INTO v_establishment_id
  FROM public.establishments
  WHERE slug = p_slug AND booking_enabled = true;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado ou agendamento desativado';
  END IF;

  -- 2. Find or create customer (match by phone + establishment)
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
    -- Update name/email if provided
    UPDATE public.customers
    SET name = COALESCE(NULLIF(p_customer_name, ''), name),
        email = COALESCE(NULLIF(p_customer_email, ''), email)
    WHERE id = v_customer_id;
  END IF;

  -- 3. Create appointment
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

  -- 4. Generate manage token (random hex string)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(convert_to(v_token, 'UTF8')), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash)
  VALUES (v_appointment_id, v_token_hash);

  -- 5. Return result
  RETURN QUERY SELECT v_appointment_id, v_token;
END;
$$;

-- 3. Create public_reschedule_appointment RPC
CREATE OR REPLACE FUNCTION public.public_reschedule_appointment(
  p_token text,
  p_appointment_id uuid,
  p_new_start_at timestamptz,
  p_new_end_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
SET row_security = 'off'
AS $$
DECLARE
  v_token_hash text;
  v_token_record record;
  v_appointment record;
BEGIN
  -- Hash the token
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  -- Verify token
  SELECT amt.appointment_id, amt.expires_at, amt.used_at
  INTO v_token_record
  FROM public.appointment_manage_tokens amt
  WHERE amt.token_hash = v_token_hash
    AND amt.appointment_id = p_appointment_id;

  IF v_token_record IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  IF v_token_record.expires_at < now() THEN
    RAISE EXCEPTION 'Este link expirou';
  END IF;

  -- Verify appointment exists and is modifiable
  SELECT a.id, a.status, a.start_at, a.establishment_id, a.professional_id, a.customer_id
  INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_appointment IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_appointment.status NOT IN ('booked', 'confirmed') THEN
    RAISE EXCEPTION 'Agendamento não pode ser alterado (status: %)', v_appointment.status;
  END IF;

  -- Update appointment
  UPDATE public.appointments
  SET start_at = p_new_start_at,
      end_at = p_new_end_at
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Agendamento reagendado com sucesso',
    'appointment', jsonb_build_object(
      'id', v_appointment.id,
      'start_at', p_new_start_at,
      'end_at', p_new_end_at,
      'status', v_appointment.status,
      'establishment_id', v_appointment.establishment_id,
      'professional_id', v_appointment.professional_id,
      'customer_id', v_appointment.customer_id
    )
  );
END;
$$;
