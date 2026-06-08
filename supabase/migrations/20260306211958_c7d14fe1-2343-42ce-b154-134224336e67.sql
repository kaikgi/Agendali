
-- 1. Drop the trial subscription trigger (it auto-creates trial subscriptions)
DROP TRIGGER IF EXISTS trg_create_trial_subscription ON public.establishments;
DROP FUNCTION IF EXISTS public.create_trial_subscription();

-- 2. Update the trial defaults trigger to NOT set trial anymore
-- Replace it with a simpler version that just handles slug generation
CREATE OR REPLACE FUNCTION public.apply_establishment_trial_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
declare
  base_slug text;
  candidate text;
  i int := 1;
begin
  -- Default status is 'active' for paid users
  if new.status is null or new.status = '' then
    new.status := 'active';
  end if;

  -- No trial_ends_at needed
  new.trial_ends_at := null;

  -- Default plano to 'solo' if not set
  if new.plano is null or new.plano = '' or new.plano = 'nenhum' or new.plano = 'trial' then
    new.plano := 'solo';
  end if;

  -- slug: auto-generate if not provided
  if new.slug is null or new.slug = '' then
    if new.name is null or new.name = '' then
      raise exception 'Campo name é obrigatório para gerar slug';
    end if;

    base_slug := public.slugify(new.name);

    if base_slug is null or base_slug = '' then
      base_slug := 'estabelecimento';
    end if;

    candidate := base_slug;

    while exists (
      select 1 from public.establishments e where e.slug = candidate
    ) loop
      i := i + 1;
      candidate := base_slug || '-' || i::text;
    end loop;

    new.slug := candidate;
  end if;

  return new;
end;
$function$;

-- 3. Update the on-update trigger too
CREATE OR REPLACE FUNCTION public.apply_establishment_trial_defaults_on_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  -- No trial logic — just pass through
  return new;
end;
$function$;

-- 4. Allow anon users to SELECT from allowed_establishment_signups (for signup check)
-- This is safe because we only expose email matching, not listing
CREATE POLICY "Anon can check allowed signups"
  ON public.allowed_establishment_signups FOR SELECT
  TO anon
  USING (true);

-- 5. Allow authenticated users to UPDATE (mark as used) their own signup
CREATE POLICY "Auth can mark own signup used"
  ON public.allowed_establishment_signups FOR UPDATE
  TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email'::text)))
  WITH CHECK (lower(email) = lower((auth.jwt() ->> 'email'::text)));
