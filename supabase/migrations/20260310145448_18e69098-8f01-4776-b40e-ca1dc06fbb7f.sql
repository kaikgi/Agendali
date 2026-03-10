-- Update default expiry from 7 days to 24 hours
ALTER TABLE public.signup_invitations 
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- Update the validate function to match
CREATE OR REPLACE FUNCTION public.validate_signup_invitation(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
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
$function$;