
CREATE OR REPLACE FUNCTION public.admin_get_my_level()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT au.level FROM public.admin_users au WHERE au.user_id = auth.uid()),
    'none'
  );
$$;
