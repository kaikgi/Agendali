-- Recreate v_admin_users view WITHOUT security_invoker so it runs as the owner (postgres)
-- which has permission to read auth.users
DROP VIEW IF EXISTS public.v_admin_users;

CREATE VIEW public.v_admin_users
WITH (security_invoker = off) AS
  SELECT
    au.user_id,
    u.email,
    au.level,
    u.created_at AS user_created_at
  FROM public.admin_users au
  LEFT JOIN auth.users u ON u.id = au.user_id;

-- Grant select to authenticated users
GRANT SELECT ON public.v_admin_users TO authenticated;