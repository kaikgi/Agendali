
-- Fix: trigger references new.nome but column is actually "name"
create or replace function public.apply_establishment_trial_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  base_slug text;
  candidate text;
  i int := 1;
begin
  if new.status is null then
    new.status := 'trial';
  end if;

  if new.status = 'trial' and new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '7 days';
  end if;

  if new.status = 'trial' and (new.plano is null or new.plano = '' or new.plano = 'nenhum') then
    new.plano := 'studio';
  end if;

  -- slug: gera automaticamente se não fornecido
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
$$;
