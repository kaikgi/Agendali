-- Add new columns to admin_users
ALTER TABLE public.admin_users 
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS last_access_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Migrate existing 'level' data to 'role'
UPDATE public.admin_users SET role = 'super_admin' WHERE level = 'master';
UPDATE public.admin_users SET role = 'admin' WHERE level = 'standard';

-- Drop and recreate get_admin_users with new signature
DROP FUNCTION IF EXISTS public.get_admin_users();

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  user_id uuid,
  email varchar,
  name text,
  role text,
  level text,
  status text,
  last_access_at timestamptz,
  created_by uuid,
  created_by_email varchar,
  user_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.user_id,
    u.email,
    au.name,
    au.role,
    au.level,
    au.status,
    au.last_access_at,
    au.created_by,
    cb.email AS created_by_email,
    u.created_at AS user_created_at
  FROM public.admin_users au
  LEFT JOIN auth.users u ON u.id = au.user_id
  LEFT JOIN auth.users cb ON cb.id = au.created_by
  WHERE public.is_admin(auth.uid())
  ORDER BY 
    CASE au.role 
      WHEN 'super_admin' THEN 1 
      WHEN 'admin' THEN 2 
      WHEN 'support' THEN 3 
      WHEN 'finance' THEN 4 
      WHEN 'developer' THEN 5 
      ELSE 6 
    END;
$$;

-- Update admin_get_my_level to check role + status
CREATE OR REPLACE FUNCTION public.admin_get_my_level()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT coalesce(
    (SELECT au.role::text
     FROM public.admin_users au
     WHERE au.user_id = auth.uid()
       AND au.status = 'ativo'
     LIMIT 1),
    'none'
  );
$$;