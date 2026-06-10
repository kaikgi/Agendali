-- Migration para adicionar a RPC atômica e constraints necessárias de cadastro

DO $$
DECLARE
  v_dup_members integer;
  v_dup_subs integer;
BEGIN
  -- 1. Verificar duplicados em public.establishment_members antes de aplicar a restrição
  SELECT COUNT(*) INTO v_dup_members
  FROM (
    SELECT establishment_id, user_id
    FROM public.establishment_members
    GROUP BY establishment_id, user_id
    HAVING COUNT(*) > 1
  ) t;

  -- 2. Verificar duplicados em public.subscriptions antes de aplicar a restrição
  SELECT COUNT(*) INTO v_dup_subs
  FROM (
    SELECT owner_user_id
    FROM public.subscriptions
    GROUP BY owner_user_id
    HAVING COUNT(*) > 1
  ) t;

  -- Se existirem registros duplicados, a migração local é interrompida com aviso descritivo
  IF v_dup_members > 0 THEN
    RAISE EXCEPTION 'A migração falhou: existem registros duplicados em public.establishment_members (% registros). Corrija-os antes de aplicar a Unique Constraint.', v_dup_members;
  END IF;

  IF v_dup_subs > 0 THEN
    RAISE EXCEPTION 'A migração falhou: existem registros duplicados em public.subscriptions (% registros). Corrija-os antes de aplicar a Unique Constraint.', v_dup_subs;
  END IF;

  -- 3. Criar Unique Constraint em establishment_members (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uniq_establishment_members_est_user'
  ) THEN
    ALTER TABLE public.establishment_members 
      ADD CONSTRAINT uniq_establishment_members_est_user UNIQUE (establishment_id, user_id);
  END IF;

  -- 4. Criar Unique Constraint em subscriptions (se não existir)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uniq_subscriptions_owner_user'
  ) THEN
    ALTER TABLE public.subscriptions 
      ADD CONSTRAINT uniq_subscriptions_owner_user UNIQUE (owner_user_id);
  END IF;
END;
$$;

-- 4.5 Garantir coluna updated_at na tabela allowed_establishment_signups
ALTER TABLE public.allowed_establishment_signups ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- 5. Criar ou substituir a RPC complete_establishment_signup
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
  v_allowed_id uuid; -- ID do registro em allowed_establishment_signups
  v_token_id uuid;   -- ID do token em signup_tokens
  v_establishment_id uuid;
  v_profile_exists boolean;
BEGIN
  -- SEGURANÇA: Validar que o usuário autenticado que chama a RPC é o próprio p_user_id
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não autorizado.');
  END IF;

  -- VALIDAÇÃO: Validar dados obrigatórios de entrada
  IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome completo é obrigatório.');
  END IF;

  IF p_company_name IS NULL OR trim(p_company_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome da empresa é obrigatório.');
  END IF;

  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone é obrigatório.');
  END IF;

  -- Obter email do usuário autenticado no auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuário não encontrado no Supabase Auth.');
  END IF;

  v_email := lower(trim(v_email));

  -- 6. Verificar se o e-mail está autorizado em allowed_establishment_signups
  SELECT id, plan_id, kiwify_order_id INTO v_allowed_id, v_plan_id, v_order_id
  FROM public.allowed_establishment_signups
  WHERE email = v_email AND used = false
  ORDER BY created_at DESC
  LIMIT 1;

  -- Se não encontrar autorização direta, verifica se existe um token ativo correspondente
  IF v_plan_id IS NULL THEN
    SELECT id, plan_id, order_id INTO v_token_id, v_plan_id, v_order_id
    FROM public.signup_tokens
    WHERE email = v_email AND status = 'pending' AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  -- Se não houver autorização ativa, verifica se o cadastro já estava concluído (idempotência)
  IF v_plan_id IS NULL THEN
    SELECT id INTO v_establishment_id
    FROM public.establishments
    WHERE owner_user_id = p_user_id;

    IF v_establishment_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', true, 'establishment_id', v_establishment_id, 'message', 'Cadastro já estava completo.');
    END IF;

    RETURN jsonb_build_object('success', false, 'error', 'E-mail não autorizado para cadastro de estabelecimento.');
  END IF;

  -- 7. Garantir o Profile (com suporte a upsert e trim)
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

  -- 8. Garantir o Estabelecimento (com trim)
  SELECT id INTO v_establishment_id
  FROM public.establishments
  WHERE owner_user_id = p_user_id;

  IF v_establishment_id IS NULL THEN
    INSERT INTO public.establishments (owner_user_id, name, status, plano, created_at, updated_at)
    VALUES (p_user_id, trim(p_company_name), 'active', v_plan_id, now(), now())
    RETURNING id INTO v_establishment_id;
  ELSE
    UPDATE public.establishments
    SET name = trim(p_company_name),
        plano = v_plan_id,
        updated_at = now()
    WHERE id = v_establishment_id;
  END IF;

  -- 9. Garantir o vínculo de Membro Proprietário
  INSERT INTO public.establishment_members (establishment_id, user_id, role, created_at)
  VALUES (v_establishment_id, p_user_id, 'owner', now())
  ON CONFLICT (establishment_id, user_id) DO UPDATE
  SET role = 'owner';

  -- 10. Garantir Assinatura do Plano
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

  -- 11. Consumir as autorizações correspondentes apenas no final
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
  -- Loga o erro internamente para auditoria do banco
  RAISE WARNING 'Erro em complete_establishment_signup: %', SQLERRM;
  -- Retorna mensagem genérica e segura para o usuário final
  RETURN jsonb_build_object('success', false, 'error', 'Não foi possível concluir o cadastro. Tente novamente.');
END;
$$;

-- 12. Permissões de Execução (Apenas usuários autenticados)
REVOKE EXECUTE ON FUNCTION public.complete_establishment_signup(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_establishment_signup(uuid, text, text, text) TO authenticated;
