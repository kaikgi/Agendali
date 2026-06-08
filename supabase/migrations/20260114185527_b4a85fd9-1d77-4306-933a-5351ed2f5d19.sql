-- Create contact_messages table for "Fale Conosco"
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
  admin_reply text,
  replied_at timestamptz,
  replied_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create admin_users table to track admin roles separately (security best practice)
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id)
);

-- Enable RLS on contact_messages
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert contact messages (public form)
CREATE POLICY "Anyone can insert contact messages"
ON public.contact_messages
FOR INSERT
WITH CHECK (true);

-- Policy: Only admins can view contact messages
CREATE POLICY "Admins can view contact messages"
ON public.contact_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  )
);

-- Policy: Only admins can update contact messages
CREATE POLICY "Admins can update contact messages"
ON public.contact_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
  )
);

-- Enable RLS on admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view admin_users
CREATE POLICY "Admins can view admin users"
ON public.admin_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  )
);

-- Policy: Only admins can insert new admins (via RPC is preferred, but fallback)
CREATE POLICY "Admins can insert admin users"
ON public.admin_users
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  )
);

-- Policy: Only admins can delete admin users
CREATE POLICY "Admins can delete admin users"
ON public.admin_users
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  )
);

-- Create security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id
  )
$$;

-- Create function to get admin dashboard stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT jsonb_build_object(
    'total_establishments', (SELECT COUNT(*) FROM establishments),
    'total_clients', (SELECT COUNT(*) FROM profiles WHERE id NOT IN (SELECT owner_user_id FROM establishments)),
    'total_subscriptions_active', (SELECT COUNT(*) FROM subscriptions WHERE status = 'active'),
    'subscriptions_by_plan', (
      SELECT jsonb_object_agg(plan_code, cnt)
      FROM (
        SELECT plan_code, COUNT(*) as cnt
        FROM subscriptions
        WHERE status = 'active'
        GROUP BY plan_code
      ) sub
    ),
    'appointments_this_month', (
      SELECT COUNT(*)
      FROM appointments
      WHERE created_at >= date_trunc('month', now())
        AND status NOT IN ('canceled')
    ),
    'new_contact_messages', (
      SELECT COUNT(*)
      FROM contact_messages
      WHERE status = 'new'
    ),
    'recent_establishments', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'slug', e.slug,
          'created_at', e.created_at,
          'owner_email', (SELECT email FROM auth.users WHERE id = e.owner_user_id)
        ) ORDER BY e.created_at DESC
      ), '[]'::jsonb)
      FROM (SELECT * FROM establishments ORDER BY created_at DESC LIMIT 5) e
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Create function to list all establishments for admin
CREATE OR REPLACE FUNCTION public.admin_list_establishments(
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT jsonb_build_object(
    'establishments', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'name', e.name,
          'slug', e.slug,
          'created_at', e.created_at,
          'booking_enabled', e.booking_enabled,
          'owner_user_id', e.owner_user_id,
          'owner_email', u.email,
          'subscription', (
            SELECT jsonb_build_object(
              'plan_code', s.plan_code,
              'status', s.status,
              'current_period_end', s.current_period_end
            )
            FROM subscriptions s
            WHERE s.owner_user_id = e.owner_user_id
              AND s.status = 'active'
            LIMIT 1
          ),
          'professionals_count', (
            SELECT COUNT(*) FROM professionals p
            WHERE p.establishment_id = e.id AND p.active = true
          ),
          'appointments_this_month', (
            SELECT COUNT(*) FROM appointments a
            WHERE a.establishment_id = e.id
              AND a.created_at >= date_trunc('month', now())
              AND a.status NOT IN ('canceled')
          )
        ) ORDER BY e.created_at DESC
      )
      FROM establishments e
      LEFT JOIN auth.users u ON u.id = e.owner_user_id
      WHERE (p_search IS NULL OR 
             e.name ILIKE '%' || p_search || '%' OR 
             e.slug ILIKE '%' || p_search || '%' OR
             u.email ILIKE '%' || p_search || '%')
      LIMIT p_limit
      OFFSET p_offset
    ), '[]'::jsonb),
    'total', (
      SELECT COUNT(*)
      FROM establishments e
      LEFT JOIN auth.users u ON u.id = e.owner_user_id
      WHERE (p_search IS NULL OR 
             e.name ILIKE '%' || p_search || '%' OR 
             e.slug ILIKE '%' || p_search || '%' OR
             u.email ILIKE '%' || p_search || '%')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Create function to list contact messages for admin
CREATE OR REPLACE FUNCTION public.admin_list_contact_messages(
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  SELECT jsonb_build_object(
    'messages', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'name', m.name,
          'email', m.email,
          'message', m.message,
          'status', m.status,
          'admin_reply', m.admin_reply,
          'replied_at', m.replied_at,
          'created_at', m.created_at
        ) ORDER BY m.created_at DESC
      )
      FROM contact_messages m
      WHERE (p_status IS NULL OR m.status = p_status)
      LIMIT p_limit
      OFFSET p_offset
    ), '[]'::jsonb),
    'total', (
      SELECT COUNT(*)
      FROM contact_messages m
      WHERE (p_status IS NULL OR m.status = p_status)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Create function to update establishment plan (admin only)
CREATE OR REPLACE FUNCTION public.admin_update_establishment_plan(
  p_establishment_id uuid,
  p_new_plan_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  -- Get establishment owner
  SELECT owner_user_id INTO v_owner_id
  FROM establishments
  WHERE id = p_establishment_id;

  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estabelecimento não encontrado');
  END IF;

  -- Update subscription
  UPDATE subscriptions
  SET plan_code = p_new_plan_code,
      updated_at = now()
  WHERE owner_user_id = v_owner_id
    AND status = 'active';

  RETURN jsonb_build_object('success', true, 'message', 'Plano atualizado com sucesso');
END;
$$;

-- Create function to toggle establishment active status
CREATE OR REPLACE FUNCTION public.admin_toggle_establishment(
  p_establishment_id uuid,
  p_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso não autorizado';
  END IF;

  UPDATE establishments
  SET booking_enabled = p_active
  WHERE id = p_establishment_id;

  RETURN jsonb_build_object('success', true, 'booking_enabled', p_active);
END;
$$;

-- Create index for faster contact message lookups
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON public.contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON public.contact_messages(created_at DESC);