CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.gen_random_bytes(length integer)
RETURNS bytea
LANGUAGE sql
VOLATILE
SET search_path = extensions
AS $$
  SELECT extensions.gen_random_bytes(length);
$$;

CREATE OR REPLACE FUNCTION public.digest(data text, type text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
SET search_path = extensions
AS $$
  SELECT extensions.digest(data, type);
$$;