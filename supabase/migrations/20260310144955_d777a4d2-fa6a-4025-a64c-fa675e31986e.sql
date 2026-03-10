-- Table: signup_invitations (token-based signup flow)
CREATE TABLE public.signup_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  plan_code text NOT NULL,
  kiwify_order_id text,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast token lookups
CREATE UNIQUE INDEX idx_signup_invitations_token_hash ON public.signup_invitations (token_hash);
-- Index for email lookups
CREATE INDEX idx_signup_invitations_email ON public.signup_invitations (email);

ALTER TABLE public.signup_invitations ENABLE ROW LEVEL SECURITY;

-- No direct access from client — only via RPC
CREATE POLICY "No direct access to signup_invitations"
  ON public.signup_invitations FOR SELECT
  TO public
  USING (false);

-- Admin can view
CREATE POLICY "Admins can view signup_invitations"
  ON public.signup_invitations FOR SELECT
  TO authenticated
  USING (is_admin(auth.uid()));

-- RPC: validate_signup_invitation (anon-safe)
CREATE OR REPLACE FUNCTION public.validate_signup_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
  v_invitation record;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Token não fornecido');
  END IF;

  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT id, email, plan_code, status, expires_at, used_at
  INTO v_invitation
  FROM public.signup_invitations
  WHERE token_hash = v_token_hash;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Convite não encontrado. Verifique se o link está correto.');
  END IF;

  IF v_invitation.used_at IS NOT NULL OR v_invitation.status = 'used' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este convite já foi utilizado. Faça login na sua conta.');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Este convite expirou. Entre em contato com o suporte.');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invitation_id', v_invitation.id,
    'email', v_invitation.email,
    'plan_code', v_invitation.plan_code
  );
END;
$$;

-- RPC: consume_signup_invitation (mark as used after account creation)
CREATE OR REPLACE FUNCTION public.consume_signup_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_token_hash text;
  v_invitation record;
BEGIN
  v_token_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  SELECT id, email, plan_code, status, expires_at, used_at
  INTO v_invitation
  FROM public.signup_invitations
  WHERE token_hash = v_token_hash;

  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite não encontrado');
  END IF;

  IF v_invitation.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite já utilizado');
  END IF;

  IF v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Convite expirado');
  END IF;

  UPDATE public.signup_invitations
  SET used_at = now(), status = 'used'
  WHERE id = v_invitation.id;

  RETURN jsonb_build_object(
    'success', true,
    'email', v_invitation.email,
    'plan_code', v_invitation.plan_code
  );
END;
$$;