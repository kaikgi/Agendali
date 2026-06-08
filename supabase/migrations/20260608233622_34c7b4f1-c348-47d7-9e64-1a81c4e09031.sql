-- 1. LIMPEZA TOTAL DE POLÍTICAS ANTIGAS (PREVENIR RECURSÃO)
DROP POLICY IF EXISTS "establishments_public_read" ON public.establishments;
DROP POLICY IF EXISTS "establishments_member_read" ON public.establishments;
DROP POLICY IF EXISTS "members_read_own" ON public.establishment_members;
DROP POLICY IF EXISTS "members_manage_by_owner" ON public.establishment_members;
DROP POLICY IF EXISTS "members_self_select" ON public.establishment_members;
DROP POLICY IF EXISTS "members_owner_admin_manage" ON public.establishment_members;
DROP POLICY IF EXISTS "establishments_owner_manage" ON public.establishments;
DROP POLICY IF EXISTS "establishments_admin_manage" ON public.establishments;
DROP POLICY IF EXISTS "establishments_auth_select" ON public.establishments;
DROP POLICY IF EXISTS "members_auth_select" ON public.establishment_members;
DROP POLICY IF EXISTS "members_owner_manage" ON public.establishment_members;

-- 2. AJUSTE DE PRIVILÉGIOS (TABELA BASE É PRIVADA)
REVOKE ALL ON public.establishments FROM anon;
REVOKE SELECT ON public.establishments FROM anon;

-- Garante acesso apenas para autenticados e service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishments TO authenticated;
GRANT ALL ON public.establishments TO service_role;

-- 3. FUNÇÕES DE SEGURANÇA (SECURITY DEFINER + STABLE + ROW_SECURITY OFF)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND status IN ('active', 'ativo')
), false);
$$;

CREATE OR REPLACE FUNCTION public.check_is_owner(establishment_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.establishments
    WHERE id = establishment_id_param 
    AND owner_user_id = auth.uid()
), false);
$$;

CREATE OR REPLACE FUNCTION public.check_is_member(establishment_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.establishment_members
    WHERE establishment_id = establishment_id_param 
    AND user_id = auth.uid()
), false);
$$;

-- Restrição de execução das funções
REVOKE EXECUTE ON FUNCTION public.check_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_is_owner(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_is_member(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_is_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_is_member(uuid) TO authenticated, service_role;

-- 4. NOVAS POLÍTICAS (SOMENTE PARA AUTENTICADOS)
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "establishments_auth_select" ON public.establishments
FOR SELECT TO authenticated
USING (
  public.check_is_admin() OR 
  owner_user_id = auth.uid() OR 
  public.check_is_member(id)
);

CREATE POLICY "establishments_owner_manage" ON public.establishments
FOR ALL TO authenticated
USING (public.check_is_admin() OR owner_user_id = auth.uid())
WITH CHECK (public.check_is_admin() OR owner_user_id = auth.uid());

ALTER TABLE public.establishment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_auth_select" ON public.establishment_members
FOR SELECT TO authenticated
USING (
  public.check_is_admin() OR 
  user_id = auth.uid() OR 
  public.check_is_owner(establishment_id)
);

CREATE POLICY "members_owner_manage" ON public.establishment_members
FOR ALL TO authenticated
USING (public.check_is_admin() OR public.check_is_owner(establishment_id))
WITH CHECK (public.check_is_admin() OR public.check_is_owner(establishment_id));

-- 5. VIEW PÚBLICA SEGURA (PARA AGENDAMENTO)
DROP VIEW IF EXISTS public.public_establishments;

CREATE VIEW public.public_establishments AS
SELECT 
    id,
    name,
    slug,
    description,
    logo_url,
    phone,
    address,
    city,
    state,
    instagram,
    timezone,
    booking_enabled,
    slot_interval_minutes,
    require_policy_acceptance,
    cancellation_policy_text
FROM public.establishments
WHERE booking_enabled = true 
  AND status = 'active';

GRANT SELECT ON public.public_establishments TO anon, authenticated;

-- 6. OTIMIZAÇÃO DE PERFORMANCE (ÍNDICES BIDIRECIONAIS)
CREATE INDEX IF NOT EXISTS idx_establishments_owner ON public.establishments(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_members_user_est ON public.establishment_members(user_id, establishment_id);
CREATE INDEX IF NOT EXISTS idx_members_est_user ON public.establishment_members(establishment_id, user_id);