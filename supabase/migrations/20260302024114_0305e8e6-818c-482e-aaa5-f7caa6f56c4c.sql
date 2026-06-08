
-- 1) Função: aplica defaults do trial no INSERT
create or replace function public.apply_establishment_trial_defaults()
returns trigger
language plpgsql
set search_path = public
as $$
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

  return new;
end;
$$;

drop trigger if exists trg_apply_establishment_trial_defaults on public.establishments;

create trigger trg_apply_establishment_trial_defaults
before insert on public.establishments
for each row
execute function public.apply_establishment_trial_defaults();

-- 2) Função: protege updates para manter consistência do trial
create or replace function public.apply_establishment_trial_defaults_on_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'trial' and new.trial_ends_at is null then
    new.trial_ends_at := now() + interval '7 days';
  end if;

  if new.status = 'trial' and (new.plano is null or new.plano = '' or new.plano = 'nenhum') then
    new.plano := 'studio';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_establishment_trial_defaults_on_update on public.establishments;

create trigger trg_apply_establishment_trial_defaults_on_update
before update of status, trial_ends_at, plano on public.establishments
for each row
execute function public.apply_establishment_trial_defaults_on_update();
