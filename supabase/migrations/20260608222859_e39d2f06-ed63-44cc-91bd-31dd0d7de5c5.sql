-- 1. Limpeza de Policies Duplicadas e Problemáticas em establishments
DROP POLICY IF EXISTS "owner_member_select_establishments" ON public.establishments;
DROP POLICY IF EXISTS "Permitir atualização do próprio estabelecimento" ON public.establishments;
DROP POLICY IF EXISTS "Users can view their own establishments" ON public.establishments;
DROP POLICY IF EXISTS "owner_update_establishments" ON public.establishments;
DROP POLICY IF EXISTS "Public can view establishments with booking enabled" ON public.establishments;
DROP POLICY IF EXISTS "public_select_active_establishments" ON public.establishments;
DROP POLICY IF EXISTS "admin_all_establishments" ON public.establishments;
DROP POLICY IF EXISTS "Users can create their own establishment" ON public.establishments;
DROP POLICY IF EXISTS "authenticated_insert_establishments" ON public.establishments;

-- 2. Limpeza de Policies Duplicadas e Problemáticas em establishment_members
DROP POLICY IF EXISTS "Owner can manage members" ON public.establishment_members;
DROP POLICY IF EXISTS "owner_manage_members" ON public.establishment_members;
DROP POLICY IF EXISTS "Members can read own membership" ON public.establishment_members;
DROP POLICY IF EXISTS "member_read_own" ON public.establishment_members;
DROP POLICY IF EXISTS "admin_all_members" ON public.establishment_members;

-- 3. Função auxiliar para verificar propriedade sem recursão (Security Definer)
CREATE OR REPLACE FUNCTION public.is_establishment_owner(p_establishment_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishments 
    WHERE id = p_establishment_id AND owner_user_id = auth.uid()
  );
$$;

-- 4. Novas Policies para establishments
CREATE POLICY "select_public_establishments" ON public.establishments
FOR SELECT USING (booking_enabled = true);

CREATE POLICY "select_own_or_member_establishments" ON public.establishments
FOR SELECT USING (
  owner_user_id = auth.uid() 
  OR id IN (
    SELECT establishment_id FROM public.establishment_members WHERE user_id = auth.uid()
  )
  OR is_admin()
);

CREATE POLICY "manage_own_establishments" ON public.establishments
FOR ALL USING (owner_user_id = auth.uid() OR is_admin())
WITH CHECK (owner_user_id = auth.uid() OR is_admin());

-- 5. Novas Policies para establishment_members
CREATE POLICY "members_select_own" ON public.establishment_members
FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "owners_manage_members" ON public.establishment_members
FOR ALL USING (is_establishment_owner(establishment_id) OR is_admin())
WITH CHECK (is_establishment_owner(establishment_id) OR is_admin());

-- 6. Garantir permissões básicas (GRANTS)
GRANT SELECT ON public.establishments TO authenticated, anon;
GRANT ALL ON public.establishments TO service_role;
GRANT SELECT ON public.establishment_members TO authenticated;
GRANT ALL ON public.establishment_members TO service_role;
