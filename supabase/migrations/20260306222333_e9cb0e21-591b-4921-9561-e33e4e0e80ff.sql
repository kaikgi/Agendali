
-- Add ip and user_agent columns to admin_audit_logs
ALTER TABLE public.admin_audit_logs 
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- Create RPC to fetch audit logs with admin email (avoids direct auth.users access)
CREATE OR REPLACE FUNCTION public.get_admin_audit_logs(
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0,
  p_action text DEFAULT NULL,
  p_admin_user_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  admin_user_id uuid,
  admin_email varchar,
  admin_name text,
  action text,
  target_establishment_id uuid,
  target_owner_user_id uuid,
  metadata jsonb,
  ip text,
  user_agent text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.admin_user_id,
    u.email AS admin_email,
    au.name AS admin_name,
    l.action,
    l.target_establishment_id,
    l.target_owner_user_id,
    l.metadata,
    l.ip,
    l.user_agent,
    l.created_at
  FROM public.admin_audit_logs l
  LEFT JOIN auth.users u ON u.id = l.admin_user_id
  LEFT JOIN public.admin_users au ON au.user_id = l.admin_user_id
  WHERE public.is_admin(auth.uid())
    AND (p_action IS NULL OR l.action = p_action)
    AND (p_admin_user_id IS NULL OR l.admin_user_id = p_admin_user_id)
    AND (p_date_from IS NULL OR l.created_at >= p_date_from)
    AND (p_date_to IS NULL OR l.created_at <= p_date_to)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
