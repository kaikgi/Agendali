-- Migration para alinhar banco local com as tabelas de tokens reais

-- 1. Criar a tabela signup_tokens (caso não exista localmente)
CREATE TABLE IF NOT EXISTS public.signup_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL,
  plan_id text,
  order_id text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexadores para agilizar a pesquisa de tokens e emails
CREATE UNIQUE INDEX IF NOT EXISTS idx_signup_tokens_token ON public.signup_tokens (token);
CREATE INDEX IF NOT EXISTS idx_signup_tokens_email ON public.signup_tokens (email);

-- Habilitar RLS para signup_tokens
ALTER TABLE public.signup_tokens ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "No direct access to signup_tokens" ON public.signup_tokens;
CREATE POLICY "No direct access to signup_tokens"
  ON public.signup_tokens FOR SELECT
  TO public
  USING (false);

DROP POLICY IF EXISTS "Admins can view signup_tokens" ON public.signup_tokens;
CREATE POLICY "Admins can view signup_tokens"
  ON public.signup_tokens FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- 2. Criar ou substituir a função RPC check_signup_token
-- DROP necessário para permitir mudança na assinatura de retorno
DROP FUNCTION IF EXISTS public.check_signup_token(text);
CREATE OR REPLACE FUNCTION public.check_signup_token(p_token text)
RETURNS TABLE (
  email text,
  expires_at timestamptz,
  order_id text,
  plan_id text,
  reason text,
  valid boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token record;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN QUERY SELECT 
      NULL::text, 
      NULL::timestamptz, 
      NULL::text, 
      NULL::text, 
      'token_invalid'::text, 
      false;
    RETURN;
  END IF;

  SELECT * INTO v_token
  FROM public.signup_tokens
  WHERE token = p_token;

  IF v_token IS NULL THEN
    RETURN QUERY SELECT 
      NULL::text, 
      NULL::timestamptz, 
      NULL::text, 
      NULL::text, 
      'not_found'::text, 
      false;
    RETURN;
  END IF;

  IF v_token.status = 'used' OR v_token.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_token.email, 
      v_token.expires_at, 
      v_token.order_id, 
      v_token.plan_id, 
      'already_used'::text, 
      false;
    RETURN;
  END IF;

  IF v_token.status = 'cancelled' THEN
    RETURN QUERY SELECT 
      v_token.email, 
      v_token.expires_at, 
      v_token.order_id, 
      v_token.plan_id, 
      'cancelled'::text, 
      false;
    RETURN;
  END IF;

  IF v_token.expires_at < now() THEN
    RETURN QUERY SELECT 
      v_token.email, 
      v_token.expires_at, 
      v_token.order_id, 
      v_token.plan_id, 
      'expired'::text, 
      false;
    RETURN;
  END IF;

  RETURN QUERY SELECT 
    v_token.email, 
    v_token.expires_at, 
    v_token.order_id, 
    v_token.plan_id, 
    'valid'::text, 
    true;
END;
$$;

-- 3. Criar ou substituir a função RPC consume_signup_token
-- DROP necessário para permitir mudança na assinatura de retorno
DROP FUNCTION IF EXISTS public.consume_signup_token(text);
CREATE OR REPLACE FUNCTION public.consume_signup_token(p_token text)
RETURNS TABLE (
  email text,
  reason text,
  success boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token record;
BEGIN
  SELECT * INTO v_token
  FROM public.signup_tokens
  WHERE token = p_token;

  IF v_token IS NULL THEN
    RETURN QUERY SELECT 
      NULL::text, 
      'not_found'::text, 
      false;
    RETURN;
  END IF;

  IF v_token.status = 'used' OR v_token.used_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      v_token.email, 
      'already_used'::text, 
      false;
    RETURN;
  END IF;

  IF v_token.status = 'cancelled' THEN
    RETURN QUERY SELECT 
      v_token.email, 
      'cancelled'::text, 
      false;
    RETURN;
  END IF;

  IF v_token.expires_at < now() THEN
    RETURN QUERY SELECT 
      v_token.email, 
      'expired'::text, 
      false;
    RETURN;
  END IF;

  UPDATE public.signup_tokens
  SET used_at = now(), status = 'used', updated_at = now()
  WHERE id = v_token.id;

  RETURN QUERY SELECT 
    v_token.email, 
    'success'::text, 
    true;
END;
$$;

-- 4. Remover estrutura obsoleta de convites
DROP FUNCTION IF EXISTS public.validate_signup_invitation(text);
DROP FUNCTION IF EXISTS public.consume_signup_invitation(text);
DROP TABLE IF EXISTS public.signup_invitations CASCADE;
