-- 0) Extensões úteis
create extension if not exists pgcrypto;

-- 1) ENUMS
do $$ begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum ('owner','manager','staff');
  end if;

  if not exists (select 1 from pg_type where typname = 'appointment_status') then
    create type appointment_status as enum ('booked','confirmed','completed','canceled','no_show');
  end if;

  if not exists (select 1 from pg_type where typname = 'event_actor_type') then
    create type event_actor_type as enum ('customer','admin','staff','system');
  end if;

  if not exists (select 1 from pg_type where typname = 'appointment_event_type') then
    create type appointment_event_type as enum (
      'created','confirmed','rescheduled','professional_changed','canceled','completed','no_show_marked'
    );
  end if;
end $$;

-- 2) TABELAS PRINCIPAIS
create table if not exists establishments (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  name text not null,
  slug text not null unique,
  description text,
  phone text,
  address text,
  timezone text not null default 'America/Sao_Paulo',
  logo_url text,

  -- políticas/config
  booking_enabled boolean not null default true,
  reschedule_min_hours int not null default 2,
  max_future_days int not null default 30,
  slot_interval_minutes int not null default 15,
  buffer_minutes int not null default 0,
  auto_confirm_bookings boolean not null default true,
  cancellation_policy_text text,

  -- form customizável
  ask_email boolean not null default false,
  ask_notes boolean not null default true,
  require_policy_acceptance boolean not null default true,

  created_at timestamptz not null default now()
);

create table if not exists establishment_members (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  user_id uuid not null,
  role member_role not null,
  created_at timestamptz not null default now(),
  unique(establishment_id, user_id)
);

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  user_id uuid,
  name text not null,
  photo_url text,
  active boolean not null default true,
  capacity int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  duration_minutes int not null,
  price_cents int,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists professional_services (
  professional_id uuid not null references professionals(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  primary key (professional_id, service_id)
);

create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  open_time text,
  close_time text,
  closed boolean not null default false,
  unique(establishment_id, weekday)
);

create table if not exists professional_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time text,
  end_time text,
  closed boolean not null default false,
  unique(professional_id, weekday)
);

-- bloqueio pontual
create table if not exists time_blocks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  professional_id uuid references professionals(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);

-- bloqueio recorrente semanal
create table if not exists recurring_time_blocks (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  professional_id uuid references professionals(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time text not null,
  end_time text not null,
  reason text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  created_at timestamptz not null default now(),
  unique(establishment_id, phone)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references establishments(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete restrict,
  service_id uuid not null references services(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,

  start_at timestamptz not null,
  end_at timestamptz not null,
  status appointment_status not null default 'booked',

  customer_notes text,
  internal_notes text,

  created_at timestamptz not null default now()
);

-- token de gerenciar (cliente)
create table if not exists appointment_manage_tokens (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique(appointment_id)
);

-- eventos/auditoria
create table if not exists appointment_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments(id) on delete cascade,
  actor_type event_actor_type not null,
  actor_user_id uuid,
  event_type appointment_event_type not null,
  from_payload jsonb,
  to_payload jsonb,
  created_at timestamptz not null default now()
);

-- rate limit público (hash IP)
create table if not exists public_rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  ip_hash text not null,
  window_start timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  unique(action, ip_hash, window_start)
);

-- Índices importantes
create index if not exists idx_appointments_professional_start on appointments(professional_id, start_at);
create index if not exists idx_appointments_establishment_start on appointments(establishment_id, start_at);
create index if not exists idx_appointments_status on appointments(status);
create index if not exists idx_events_appointment on appointment_events(appointment_id, created_at);
create index if not exists idx_public_rate_limits on public_rate_limits(action, ip_hash, window_start);

-- 3) VIEWS DASHBOARD (MÉTRICAS)
-- Hoje (ativos)
create or replace view v_dash_today as
select
  establishment_id,
  count(*) filter (where status in ('booked','confirmed')) as active_today
from appointments
where start_at >= date_trunc('day', now())
  and start_at < date_trunc('day', now()) + interval '1 day'
group by establishment_id;

-- Semana (ativos)
create or replace view v_dash_week as
select
  establishment_id,
  count(*) filter (where status in ('booked','confirmed')) as active_week
from appointments
where start_at >= date_trunc('week', now())
  and start_at < date_trunc('week', now()) + interval '7 days'
group by establishment_id;

-- Cancelados últimos 7 dias (por created_at)
create or replace view v_dash_canceled_7d as
select
  establishment_id,
  count(*) as canceled_7d
from appointments
where status = 'canceled'
  and created_at >= now() - interval '7 days'
group by establishment_id;

-- Top serviços (últimos 30 dias) por quantidade (ativos + concluídos)
create or replace view v_dash_top_services_30d as
select
  a.establishment_id,
  a.service_id,
  s.name as service_name,
  count(*) as total_30d
from appointments a
join services s on s.id = a.service_id
where a.start_at >= now() - interval '30 days'
  and a.status in ('booked','confirmed','completed')
group by a.establishment_id, a.service_id, s.name;

-- Agendamentos por profissional (últimos 30 dias)
create or replace view v_dash_by_professional_30d as
select
  a.establishment_id,
  a.professional_id,
  p.name as professional_name,
  count(*) as total_30d
from appointments a
join professionals p on p.id = a.professional_id
where a.start_at >= now() - interval '30 days'
  and a.status in ('booked','confirmed','completed')
group by a.establishment_id, a.professional_id, p.name;

-- 4) RLS POLICIES

-- Enable RLS on all tables
alter table establishments enable row level security;
alter table establishment_members enable row level security;
alter table professionals enable row level security;
alter table services enable row level security;
alter table professional_services enable row level security;
alter table business_hours enable row level security;
alter table professional_hours enable row level security;
alter table time_blocks enable row level security;
alter table recurring_time_blocks enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;
alter table appointment_manage_tokens enable row level security;
alter table appointment_events enable row level security;
alter table public_rate_limits enable row level security;

-- Helper function to check establishment membership
create or replace function public.is_establishment_member(est_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from establishment_members
    where establishment_id = est_id
      and user_id = auth.uid()
  )
  or exists (
    select 1 from establishments
    where id = est_id
      and owner_user_id = auth.uid()
  )
$$;

-- Establishments policies
create policy "Owners can manage their establishments"
  on establishments for all
  using (owner_user_id = auth.uid());

create policy "Members can view establishments"
  on establishments for select
  using (public.is_establishment_member(id));

create policy "Public can view establishments by slug"
  on establishments for select
  using (booking_enabled = true);

-- Establishment members policies
create policy "Owners can manage members"
  on establishment_members for all
  using (
    exists (
      select 1 from establishments
      where id = establishment_members.establishment_id
        and owner_user_id = auth.uid()
    )
  );

create policy "Members can view other members"
  on establishment_members for select
  using (public.is_establishment_member(establishment_id));

-- Professionals policies
create policy "Members can manage professionals"
  on professionals for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can view active professionals"
  on professionals for select
  using (active = true);

-- Services policies
create policy "Members can manage services"
  on services for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can view active services"
  on services for select
  using (active = true);

-- Professional services policies
create policy "Members can manage professional services"
  on professional_services for all
  using (
    exists (
      select 1 from professionals p
      where p.id = professional_services.professional_id
        and public.is_establishment_member(p.establishment_id)
    )
  );

create policy "Public can view professional services"
  on professional_services for select
  using (true);

-- Business hours policies
create policy "Members can manage business hours"
  on business_hours for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can view business hours"
  on business_hours for select
  using (true);

-- Professional hours policies
create policy "Members can manage professional hours"
  on professional_hours for all
  using (
    exists (
      select 1 from professionals p
      where p.id = professional_hours.professional_id
        and public.is_establishment_member(p.establishment_id)
    )
  );

create policy "Public can view professional hours"
  on professional_hours for select
  using (true);

-- Time blocks policies
create policy "Members can manage time blocks"
  on time_blocks for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can view time blocks"
  on time_blocks for select
  using (true);

-- Recurring time blocks policies
create policy "Members can manage recurring time blocks"
  on recurring_time_blocks for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can view active recurring time blocks"
  on recurring_time_blocks for select
  using (active = true);

-- Customers policies
create policy "Members can manage customers"
  on customers for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can insert customers"
  on customers for insert
  with check (true);

-- Appointments policies
create policy "Members can manage appointments"
  on appointments for all
  using (public.is_establishment_member(establishment_id));

create policy "Public can insert appointments"
  on appointments for insert
  with check (true);

create policy "Public can view own appointments via token"
  on appointments for select
  using (true);

-- Appointment manage tokens policies
create policy "Members can manage tokens"
  on appointment_manage_tokens for all
  using (
    exists (
      select 1 from appointments a
      where a.id = appointment_manage_tokens.appointment_id
        and public.is_establishment_member(a.establishment_id)
    )
  );

create policy "System can insert tokens"
  on appointment_manage_tokens for insert
  with check (true);

create policy "Public can view tokens"
  on appointment_manage_tokens for select
  using (true);

-- Appointment events policies
create policy "Members can view events"
  on appointment_events for select
  using (
    exists (
      select 1 from appointments a
      where a.id = appointment_events.appointment_id
        and public.is_establishment_member(a.establishment_id)
    )
  );

create policy "System can insert events"
  on appointment_events for insert
  with check (true);

-- Rate limits policies (system managed)
create policy "System can manage rate limits"
  on public_rate_limits for all
  using (true);