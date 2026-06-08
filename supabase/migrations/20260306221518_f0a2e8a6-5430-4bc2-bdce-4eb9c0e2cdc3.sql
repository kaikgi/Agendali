-- Drop the view and use a secure RPC function instead
DROP VIEW IF EXISTS public.v_admin_users;

-- Create a secure function that only admins can use
CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  user_id uuid,
  email varchar,
  level text,
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
    au.level,
    u.created_at AS user_created_at
  FROM public.admin_users au
  LEFT JOIN auth.users u ON u.id = au.user_id
  WHERE public.is_admin(auth.uid())
  ORDER BY au.level DESC;
$$;