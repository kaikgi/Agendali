-- =====================================================
-- 1) CREATE PROFILES TABLE FOR CLIENTS (customers as logged-in users)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only view/update their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name'),
    NEW.raw_user_meta_data ->> 'phone'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 2) ADD customer_user_id TO APPOINTMENTS (link to logged-in user)
-- =====================================================
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS customer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_appointments_customer_user_id ON public.appointments(customer_user_id);

-- RLS: Allow logged-in customers to view their own appointments
DROP POLICY IF EXISTS "Customers can view own appointments" ON public.appointments;
CREATE POLICY "Customers can view own appointments"
ON public.appointments FOR SELECT
USING (auth.uid() = customer_user_id);

-- =====================================================
-- 3) PROFESSIONAL PORTAL: Add portal fields to professionals table
-- =====================================================
ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS slug text,
ADD COLUMN IF NOT EXISTS portal_password_hash text,
ADD COLUMN IF NOT EXISTS portal_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS portal_last_login_at timestamptz;

-- Create unique constraint for slug per establishment
CREATE UNIQUE INDEX IF NOT EXISTS idx_professionals_establishment_slug 
ON public.professionals(establishment_id, slug) WHERE slug IS NOT NULL;

-- =====================================================
-- 4) PROFESSIONAL PORTAL SESSIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.professional_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_portal_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Only allow via RPC (security definer)
CREATE POLICY "Sessions managed via RPC only"
ON public.professional_portal_sessions FOR ALL
USING (false);

-- =====================================================
-- 5) RPC: Professional Portal Login
-- =====================================================
CREATE OR REPLACE FUNCTION public.professional_portal_login(
  p_establishment_slug text,
  p_professional_slug text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_professional record;
  v_establishment record;
  v_token text;
  v_token_hash text;
  v_session_id uuid;
BEGIN
  -- Find establishment
  SELECT id, name INTO v_establishment
  FROM public.establishments
  WHERE slug = p_establishment_slug
    AND booking_enabled = true
  LIMIT 1;

  IF v_establishment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  -- Find professional
  SELECT p.id, p.name, p.portal_password_hash, p.portal_enabled
  INTO v_professional
  FROM public.professionals p
  WHERE p.establishment_id = v_establishment.id
    AND p.slug = p_professional_slug
    AND p.active = true
  LIMIT 1;

  IF v_professional IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado');
  END IF;

  IF NOT v_professional.portal_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Portal do profissional está desativado');
  END IF;

  IF v_professional.portal_password_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha do portal não configurada');
  END IF;

  -- Verify password using pgcrypto crypt function
  IF v_professional.portal_password_hash != crypt(p_password, v_professional.portal_password_hash) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Senha incorreta');
  END IF;

  -- Generate session token
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  -- Create session (expires in 7 days)
  INSERT INTO public.professional_portal_sessions (professional_id, token_hash, expires_at)
  VALUES (v_professional.id, v_token_hash, now() + interval '7 days')
  RETURNING id INTO v_session_id;

  -- Update last login
  UPDATE public.professionals
  SET portal_last_login_at = now()
  WHERE id = v_professional.id;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'professional_id', v_professional.id,
    'professional_name', v_professional.name,
    'establishment_name', v_establishment.name
  );
END;
$$;

-- =====================================================
-- 6) RPC: Validate Professional Portal Session
-- =====================================================
CREATE OR REPLACE FUNCTION public.validate_professional_session(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token_hash text;
  v_session record;
  v_professional record;
BEGIN
  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT s.*, p.id as prof_id, p.name as prof_name, p.establishment_id, e.name as est_name, e.slug as est_slug
  INTO v_session
  FROM public.professional_portal_sessions s
  JOIN public.professionals p ON p.id = s.professional_id
  JOIN public.establishments e ON e.id = p.establishment_id
  WHERE s.token_hash = v_token_hash
    AND s.expires_at > now()
  LIMIT 1;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'professional_id', v_session.prof_id,
    'professional_name', v_session.prof_name,
    'establishment_id', v_session.establishment_id,
    'establishment_name', v_session.est_name,
    'establishment_slug', v_session.est_slug
  );
END;
$$;

-- =====================================================
-- 7) RPC: Set Professional Portal Password (for managers)
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_professional_portal_password(
  p_professional_id uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_professional record;
  v_password_hash text;
BEGIN
  -- Verify the caller has permission (is establishment member)
  SELECT p.id, p.establishment_id
  INTO v_professional
  FROM public.professionals p
  WHERE p.id = p_professional_id
    AND is_establishment_member(p.establishment_id)
  LIMIT 1;

  IF v_professional IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profissional não encontrado ou sem permissão');
  END IF;

  -- Hash password using pgcrypto
  v_password_hash := crypt(p_password, gen_salt('bf'));

  -- Update professional
  UPDATE public.professionals
  SET portal_password_hash = v_password_hash,
      portal_enabled = true
  WHERE id = p_professional_id;

  -- Invalidate existing sessions
  DELETE FROM public.professional_portal_sessions
  WHERE professional_id = p_professional_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =====================================================
-- 8) RPC: Get Professional Appointments (for portal)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_professional_appointments(
  p_token text,
  p_start_date date,
  p_end_date date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session jsonb;
  v_professional_id uuid;
  v_appointments jsonb;
BEGIN
  -- Validate session
  v_session := validate_professional_session(p_token);
  
  IF NOT (v_session ->> 'valid')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sessão inválida');
  END IF;

  v_professional_id := (v_session ->> 'professional_id')::uuid;

  -- Get appointments
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'start_at', a.start_at,
      'end_at', a.end_at,
      'status', a.status,
      'customer_name', c.name,
      'customer_phone', c.phone,
      'service_name', s.name,
      'service_duration', s.duration_minutes,
      'customer_notes', a.customer_notes
    ) ORDER BY a.start_at
  )
  INTO v_appointments
  FROM public.appointments a
  JOIN public.customers c ON c.id = a.customer_id
  JOIN public.services s ON s.id = a.service_id
  WHERE a.professional_id = v_professional_id
    AND a.start_at >= p_start_date
    AND a.start_at < (p_end_date + interval '1 day')
    AND a.status IN ('booked', 'confirmed');

  RETURN jsonb_build_object(
    'success', true,
    'appointments', COALESCE(v_appointments, '[]'::jsonb)
  );
END;
$$;

-- =====================================================
-- 9) UPDATE public_create_appointment to support logged-in users
-- =====================================================
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
SET search_path = public, extensions
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

  -- Create appointment with optional customer_user_id
  INSERT INTO public.appointments (
    establishment_id,
    professional_id,
    service_id,
    customer_id,
    customer_user_id,
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
    p_customer_user_id,
    p_start_at,
    p_end_at,
    CASE WHEN v_auto_confirm THEN 'confirmed'::appointment_status ELSE 'booked'::appointment_status END,
    p_customer_notes
  )
  RETURNING id INTO appointment_id;

  -- Create management token using pgcrypto functions
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  INSERT INTO public.appointment_manage_tokens (appointment_id, token_hash, expires_at)
  VALUES (appointment_id, v_token_hash, now() + interval '30 days');

  manage_token := v_token;
  RETURN NEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.professional_portal_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_professional_session TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_professional_portal_password TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_professional_appointments TO anon, authenticated;