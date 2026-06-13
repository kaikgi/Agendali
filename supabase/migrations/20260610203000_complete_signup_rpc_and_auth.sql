-- Migration consolidada: RPC atômica complete_establishment_signup + autorização de e-mail de teste
-- Substitui as migrations que falharam:
--   20260610173000_complete_establishment_signup_rpc.sql (erro: coluna updated_at inexistente em establishments)
--   20260610182000_authorize_test_email.sql (nunca executou por depender da anterior)

-- ============================================================
-- ETAPA 1: Verificar duplicados antes de criar Unique Constraints
-- ============================================================
DO $$
DECLARE
  v_dup_members integer;
  v_dup_subs integer;
BEGIN
  -- Verificar duplicados em public.establishment_members
  SELECT COUNT(*) INTO v_dup_members
  FROM (
    SELECT establishment_id, user_id
    FROM public.establishment_members
    GROUP BY establishment_id, user_id
    HAVING COUNT(*) > 1
  ) t;

  -- Verificar duplicados em public.subscriptions
  SELECT COUNT(*) INTO v_dup_subs
  FROM (
    SELECT owner_user_id
    FROM public.subscriptions
    GROUP BY owner_user_id
    HAVING COUNT(*) > 1
  ) t;

  IF v_dup_members > 0 THEN
    RAISE EXCEPTION 'Migration abortada: existem registros duplicados em public.establishment_members (% grupos duplicados). Corrija antes de aplicar a Unique Constraint.', v_dup_members;
  END IF;

  IF v_dup_subs > 0 THEN
    RAISE EXCEPTION 'Migration abortada: existem registros duplicados em public.subscriptions (% grupos duplicados). Corrija antes de aplicar a Unique Constraint.', v_dup_subs;
  END IF;

  -- Criar Unique Constraint em establishment_members (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_establishment_members_est_user'
  ) THEN
    ALTER TABLE public.establishment_members
      ADD CONSTRAINT uniq_establishment_members_est_user UNIQUE (establishment_id, user_id);
  END IF;

  -- Criar Unique Constraint em subscriptions (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uniq_subscriptions_owner_user'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT uniq_subscriptions_owner_user UNIQUE (owner_user_id);
  END IF;
END;
$$;

-- ============================================================
-- ETAPA 2: Garantir coluna updated_at em allowed_establishment_signups
-- ============================================================
ALTER TABLE public.allowed_establishment_signups ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- ============================================================
-- ETAPA 3: RPC atômica complete_establishment_signup
-- CORRIGIDA: sem referências a updated_at na tabela establishments
-- ============================================================
CREATE OR REPLACE FUNCTION public.complete_establishment_signup(
  p_user_id uuid,
  p_full_name text,
  p_company_name text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_email text;
  v_plan_id text;
  v_order_id text;
  v_allowed_id uuid;
  v_token_id uuid;
  v_establishment_id uuid;
  v_profile_exists boolean;
BEGIN
  -- SEGURANÇA: Validar que o chamador é o próprio usuário
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autorizado.');
  END IF;

  -- VALIDAÇÃO de dados obrigatórios
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome completo é obrigatório.');
  END IF;

  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome da empresa é obrigatório.');
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório.');
  END IF;

  -- Obter email do auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado no Supabase Auth.');
  END IF;

  v_email := lower(trim(v_email));

  -- Verificar autorização em allowed_establishment_signups (registro mais recente não consumido)
  SELECT id, plan_id, kiwify_order_id INTO v_allowed_id, v_plan_id, v_order_id
  FROM public.allowed_establishment_signups
  WHERE email = v_email AND used = false
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se não encontrar autorização direta, verifica signup_tokens ativo
  IF v_plan_id IS NULL THEN
    SELECT id, plan_id, order_id INTO v_token_id, v_plan_id, v_order_id
    FROM public.signup_tokens
    WHERE email = v_email AND status = 'pending' AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Se ainda não há autorização, verifica idempotência (cadastro já concluído)
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_establishment_id
    FROM public.establishments
    WHERE owner_user_id = p_user_id;

    IF v_establishment_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'establishment_id', v_establishment_id,
        'message', 'Cadastro já estava completo.'
      );
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'E-mail não autorizado para cadastro de estabelecimento.');
  END IF;

  -- Garantir o Profile (upsert seguro)
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) INTO v_profile_exists;

  IF v_profile_exists THEN
    UPDATE public.profiles
    SET full_name = trim(p_full_name),
        phone = trim(p_phone),
        account_type = 'establishment_owner',
        updated_at = now()
    WHERE id = p_user_id;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, phone, account_type, created_at, updated_at)
    VALUES (p_user_id, v_email, trim(p_full_name), trim(p_phone), 'establishment_owner', now(), now());
  END IF;

  -- Garantir o Estabelecimento (CORRIGIDO: sem updated_at na tabela establishments)
  SELECT id INTO v_establishment_id
  FROM public.establishments
  WHERE owner_user_id = p_user_id;

  IF v_establishment_id IS NULL THEN
    INSERT INTO public.establishments (owner_user_id, name, status, plano, created_at)
    VALUES (p_user_id, trim(p_company_name), 'active', v_plan_id, now())
    RETURNING id INTO v_establishment_id;
  ELSE
    UPDATE public.establishments
    SET name = trim(p_company_name),
        plano = v_plan_id
    WHERE id = v_establishment_id;
  END IF;

  -- Garantir o vínculo de Membro Proprietário (ON CONFLICT para idempotência)
  INSERT INTO public.establishment_members (establishment_id, user_id, role, created_at)
  VALUES (v_establishment_id, p_user_id, 'owner', now())
  ON CONFLICT (establishment_id, user_id) DO UPDATE
  SET role = 'owner';

  -- Garantir Assinatura do Plano (ON CONFLICT para idempotência)
  INSERT INTO public.subscriptions (
    owner_user_id,
    plan_code,
    status,
    provider,
    provider_subscription_id,
    provider_order_id,
    buyer_email,
    current_period_start,
    current_period_end,
    created_at,
    updated_at
  )
  VALUES (
    p_user_id,
    v_plan_id,
    'active',
    'manual',
    NULL,
    v_order_id,
    v_email,
    now(),
    now() + interval '1 month',
    now(),
    now()
  )
  ON CONFLICT (owner_user_id) DO UPDATE
  SET plan_code = v_plan_id,
      status = 'active',
      provider_order_id = COALESCE(v_order_id, public.subscriptions.provider_order_id),
      updated_at = now();

  -- Consumir APENAS o registro de autorização usado (cirúrgico por ID)
  IF v_allowed_id IS NOT NULL THEN
    UPDATE public.allowed_establishment_signups
    SET used = true,
        updated_at = now()
    WHERE id = v_allowed_id;
  END IF;

  IF v_token_id IS NOT NULL THEN
    UPDATE public.signup_tokens
    SET used_at = now(),
        status = 'used',
        updated_at = now()
    WHERE id = v_token_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'establishment_id', v_establishment_id,
    'message', 'Cadastro concluído com sucesso.'
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro em complete_establishment_signup para user_id=%: %', p_user_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'error', 'Não foi possível concluir o cadastro. Tente novamente.');
END;
$$;

-- ============================================================
-- ETAPA 4: Permissões — apenas usuários autenticados
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.complete_establishment_signup(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_establishment_signup(uuid, text, text, text) TO authenticated;

-- ============================================================
-- ETAPA 5: Autorizar e-mail de teste com plano 'solo'
-- ============================================================
INSERT INTO public.allowed_establishment_signups (email, plan_id, kiwify_order_id, paid_at, used)
VALUES (
  'kaikfarias051@gmail.com',
  'solo',
  'order_teste_kaik_farias_051',
  now(),
  false
)
ON CONFLICT (email) DO UPDATE
SET used = false,
    plan_id = 'solo',
    kiwify_order_id = 'order_teste_kaik_farias_051';

INSERT INTO public.signup_tokens (email, token, plan_id, order_id, status, expires_at)
VALUES (
  'kaikfarias051@gmail.com',
  'token_teste_kaik_farias_051',
  'solo',
  'order_teste_kaik_farias_051',
  'pending',
  now() + interval '7 days'
)
ON CONFLICT (token) DO UPDATE
SET expires_at = now() + interval '7 days',
    status = 'pending';
