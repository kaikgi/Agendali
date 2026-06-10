-- Migration para autorizar o e-mail de teste kaikfarias051@gmail.com
-- Motivo: Permitir testes ponta a ponta do cadastro autorizado e login no SaaS Agendali
-- Risco: Nenhum. Inserção isolada de e-mail de teste.
-- Plano de Rollback:
-- DELETE FROM public.signup_tokens WHERE token = 'token_teste_kaik_farias_051';
-- DELETE FROM public.allowed_establishment_signups WHERE email = 'kaikfarias051@gmail.com';

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
