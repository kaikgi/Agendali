
-- 1. Add level column to admin_users
ALTER TABLE public.admin_users
ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'standard';

-- Add check constraint for level values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_level_check'
  ) THEN
    ALTER TABLE public.admin_users ADD CONSTRAINT admin_users_level_check CHECK (level IN ('standard', 'master'));
  END IF;
END $$;

-- 2. Create is_admin_master function
CREATE OR REPLACE FUNCTION public.is_admin_master(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id AND level = 'master'
  )
$$;

-- 3. Admin audit logs (immutable)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  action text NOT NULL,
  request_hash text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin_only"
ON public.admin_audit_logs FOR SELECT
USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — only service role can write

-- 4. Admin locks (prevent concurrent execution)
CREATE TABLE IF NOT EXISTS public.admin_locks (
  key text PRIMARY KEY,
  locked_by uuid,
  locked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_locks ENABLE ROW LEVEL SECURITY;
-- No policies — only service role

-- 5. System settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_admin_only"
ON public.system_settings FOR SELECT
USING (public.is_admin());

-- No INSERT/UPDATE/DELETE policies — only service role

-- 6. Seed system settings defaults
INSERT INTO public.system_settings (key, value) VALUES
  ('ENV_ALLOW_DANGER_ZONE', 'false'),
  ('DANGER_ZONE_KEEP_SLUGS', '["ishowbarber","barbershop1"]'),
  ('DANGER_ZONE_ALLOWED_MASTER_EMAILS', '["kaikgivaldodias@gmail.com"]')
ON CONFLICT (key) DO NOTHING;
