O erro de **recursão infinita** foi identificado na relação entre as policies das tabelas `establishments` e `establishment_members`.

### Diagnóstico da Causa Raiz
1.  A policy `owner_member_select_establishments` da tabela `establishments` tenta consultar a tabela `establishment_members`.
2.  Por sua vez, as policies `Owner can manage members` ou `owner_manage_members` da tabela `establishment_members` tentam consultar a tabela `establishments`.
3.  Isso cria um loop: para saber se você pode ver um estabelecimento, o sistema olha se você é membro; para saber se você pode ver a sua própria associação de membro, o sistema olha se você é o dono do estabelecimento.

### Ações Propostas (SQL para Aprovação)

Vou remover as policies redundantes e reescrevê-las para quebrar esse ciclo de dependência.

#### Passo 1: Limpeza de Policies Duplicadas e Problemáticas
```sql
-- Remover policies problemáticas em establishments
DROP POLICY IF EXISTS "owner_member_select_establishments" ON public.establishments;
DROP POLICY IF EXISTS "Permitir atualização do próprio estabelecimento" ON public.establishments;
DROP POLICY IF EXISTS "Users can view their own establishments" ON public.establishments;
DROP POLICY IF EXISTS "owner_update_establishments" ON public.establishments;
DROP POLICY IF EXISTS "Public can view establishments with booking enabled" ON public.establishments;
DROP POLICY IF EXISTS "public_select_active_establishments" ON public.establishments;
DROP POLICY IF EXISTS "admin_all_establishments" ON public.establishments;
DROP POLICY IF EXISTS "Users can create their own establishment" ON public.establishments;
DROP POLICY IF EXISTS "authenticated_insert_establishments" ON public.establishments;

-- Remover policies problemáticas em establishment_members
DROP POLICY IF EXISTS "Owner can manage members" ON public.establishment_members;
DROP POLICY IF EXISTS "owner_manage_members" ON public.establishment_members;
DROP POLICY IF EXISTS "Members can read own membership" ON public.establishment_members;
DROP POLICY IF EXISTS "member_read_own" ON public.establishment_members;
DROP POLICY IF EXISTS "admin_all_members" ON public.establishment_members;
```

#### Passo 2: Implementação de Novas Policies Seguras

**Tabela `establishments` (Quebra de recursão):**
```sql
-- 1. Visualização Pública (Sem recursão)
CREATE POLICY "select_public_establishments" ON public.establishments
FOR SELECT USING (booking_enabled = true);

-- 2. Visualização para Donos e Membros (Quebra de recursão usando subquery simples)
-- Nota: consultamos establishment_members que agora terá uma policy baseada apenas em auth.uid()
CREATE POLICY "select_own_or_member_establishments" ON public.establishments
FOR SELECT USING (
  owner_user_id = auth.uid() 
  OR id IN (
    SELECT establishment_id FROM public.establishment_members WHERE user_id = auth.uid()
  )
  OR is_admin()
);

-- 3. Gestão (Apenas Donos ou Admins)
CREATE POLICY "manage_own_establishments" ON public.establishments
FOR ALL USING (owner_user_id = auth.uid() OR is_admin())
WITH CHECK (owner_user_id = auth.uid() OR is_admin());
```

**Tabela `establishment_members` (Base do isolamento):**
```sql
-- 1. Membros podem ver suas próprias associações (Sem consultar establishments)
CREATE POLICY "members_select_own" ON public.establishment_members
FOR SELECT USING (user_id = auth.uid() OR is_admin());

-- 2. Donos podem gerenciar membros (Usando a coluna owner_user_id da própria tabela se existir, ou via função security definer)
-- Para evitar recursão, criaremos uma função auxiliar simples
CREATE OR REPLACE FUNCTION public.is_establishment_owner(p_establishment_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.establishments 
    WHERE id = p_establishment_id AND owner_user_id = auth.uid()
  );
$$;

CREATE POLICY "owners_manage_members" ON public.establishment_members
FOR ALL USING (is_establishment_owner(establishment_id) OR is_admin())
WITH CHECK (is_establishment_owner(establishment_id) OR is_admin());
```

Este plano resolve o erro de recursão garantindo que a verificação de "quem é membro" não precise perguntar "quem é o dono" de forma circular.

Posso prosseguir com a aplicação deste SQL?
