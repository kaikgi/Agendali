-- Migration: Correção Definitiva de RLS, Remoção de Recursão e Higienização de Políticas
-- 20260613130000_fix_rls_recursion_and_cleanup.sql

-- ==========================================
-- 1. DROP POLICY (POLÍTICAS ANTIGAS/DUPLICADAS)
-- ==========================================

-- admin_users
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_all_admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_select" ON public.admin_users;
DROP POLICY IF EXISTS "admin_users_manage" ON public.admin_users;

-- profiles
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "user_manage_own_profile" ON public.profiles;

-- establishments
DROP POLICY IF EXISTS "Members can view establishments" ON public.establishments;
DROP POLICY IF EXISTS "Owners can manage their establishments" ON public.establishments;
DROP POLICY IF EXISTS "Public can view establishments by slug" ON public.establishments;
DROP POLICY IF EXISTS "establishments_auth_select" ON public.establishments;
DROP POLICY IF EXISTS "establishments_owner_manage" ON public.establishments;
DROP POLICY IF EXISTS "manage_own_establishments" ON public.establishments;
DROP POLICY IF EXISTS "select_own_or_member_establishments" ON public.establishments;
DROP POLICY IF EXISTS "select_public_establishments" ON public.establishments;
DROP POLICY IF EXISTS "establishments_public_select" ON public.establishments;
DROP POLICY IF EXISTS "establishments_owner_admin_manage" ON public.establishments;

-- establishment_members
DROP POLICY IF EXISTS "Members can view other members" ON public.establishment_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.establishment_members;
DROP POLICY IF EXISTS "members_auth_select" ON public.establishment_members;
DROP POLICY IF EXISTS "members_owner_manage" ON public.establishment_members;
DROP POLICY IF EXISTS "members_select_own" ON public.establishment_members;
DROP POLICY IF EXISTS "owners_manage_members" ON public.establishment_members;
DROP POLICY IF EXISTS "members_select_auth" ON public.establishment_members;
DROP POLICY IF EXISTS "members_owner_admin_manage" ON public.establishment_members;

-- subscriptions
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "admin_all_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "owner_select_subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_auth" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_admin_manage" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_select" ON public.subscriptions;

-- ==========================================
-- 2. DROP FUNCTION (FUNÇÕES LEGADAS/AMBÍGUAS APENAS)
-- ==========================================
-- NÃO removemos is_admin() sem parâmetros: dezenas de policies em produção (signup_tokens,
-- appointments, customers, professionals, services, payments, etc.) dependem diretamente
-- dela e DROP (mesmo com CASCADE) apagaria essas policies de acesso do admin.
-- A nova assinatura is_admin(uuid) é criada abaixo como um overload adicional,
-- coexistindo com a versão sem parâmetros — não há chamada ambígua a is_admin() neste script.


-- ==========================================
-- 3. CREATE FUNCTION (OFICIAIS E WRAPPERS SEGUROS)
-- ==========================================

-- A. check_is_admin (Oficial)
CREATE OR REPLACE FUNCTION public.check_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT COALESCE(exists (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND status IN ('active', 'ativo')
  ), false);
$$;

-- B. check_is_owner (Oficial)
CREATE OR REPLACE FUNCTION public.check_is_owner(establishment_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT COALESCE(exists (
    SELECT 1 FROM public.establishments
    WHERE id = establishment_id_param 
      AND owner_user_id = auth.uid()
  ), false);
$$;

-- C. check_is_member (Oficial)
CREATE OR REPLACE FUNCTION public.check_is_member(establishment_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT COALESCE(exists (
    SELECT 1 FROM public.establishment_members
    WHERE establishment_id = establishment_id_param 
      AND user_id = auth.uid()
  ), false);
$$;

-- D. Wrapper is_admin (Compatibilidade)
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT COALESCE(exists (
    SELECT 1 FROM public.admin_users
    WHERE user_id = p_user_id
      AND status IN ('active', 'ativo')
  ), false);
$$;

-- E. Wrapper is_establishment_member (Compatibilidade)
CREATE OR REPLACE FUNCTION public.is_establishment_member(est_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
SET row_security = off
AS $$
  SELECT public.check_is_member(est_id) OR public.check_is_owner(est_id);
$$;

-- ==========================================
-- 4. REVOKE/GRANT (FUNÇÕES)
-- ==========================================
REVOKE EXECUTE ON FUNCTION public.check_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_admin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_is_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_owner(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_is_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_is_member(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_establishment_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_establishment_member(uuid) TO authenticated, service_role;

-- ==========================================
-- 5. REVOKE/GRANT (TABELAS/VIEWS)
-- ==========================================

-- Anon sem privilégio na tabela base
REVOKE ALL ON public.establishments FROM anon;

-- Permissões para authenticated
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.establishment_members TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.admin_users TO authenticated;

-- Permissões da View Pública
GRANT SELECT ON public.public_establishments TO anon, authenticated;

-- ==========================================
-- 6. CREATE POLICY (POLÍTICAS FINAIS HIGIENIZADAS)
-- ==========================================

-- A. admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_users_select" ON public.admin_users
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.check_is_admin());

CREATE POLICY "admin_users_manage" ON public.admin_users
  FOR ALL TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

-- B. profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.check_is_admin());

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_manage" ON public.profiles
  FOR ALL TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());

-- C. establishments
ALTER TABLE public.establishments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "establishments_select_auth" ON public.establishments
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.check_is_admin() OR public.check_is_member(id));

CREATE POLICY "establishments_owner_admin_manage" ON public.establishments
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() OR public.check_is_admin())
  WITH CHECK (owner_user_id = auth.uid() OR public.check_is_admin());

-- D. establishment_members
ALTER TABLE public.establishment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_auth" ON public.establishment_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.check_is_admin() OR public.check_is_owner(establishment_id));

CREATE POLICY "members_owner_admin_manage" ON public.establishment_members
  FOR ALL TO authenticated
  USING (public.check_is_admin() OR public.check_is_owner(establishment_id))
  WITH CHECK (public.check_is_admin() OR public.check_is_owner(establishment_id));

-- E. subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.check_is_admin());

CREATE POLICY "subscriptions_admin_manage" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.check_is_admin())
  WITH CHECK (public.check_is_admin());
