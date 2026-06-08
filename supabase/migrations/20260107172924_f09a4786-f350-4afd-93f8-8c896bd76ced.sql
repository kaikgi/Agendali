-- Fix views to use SECURITY INVOKER (default safer option)
drop view if exists v_dash_today;
drop view if exists v_dash_week;
drop view if exists v_dash_canceled_7d;
drop view if exists v_dash_top_services_30d;
drop view if exists v_dash_by_professional_30d;

-- Recreate with explicit SECURITY INVOKER
create view v_dash_today with (security_invoker = on) as
select
  establishment_id,
  count(*) filter (where status in ('booked','confirmed')) as active_today
from appointments
where start_at >= date_trunc('day', now())
  and start_at < date_trunc('day', now()) + interval '1 day'
group by establishment_id;

create view v_dash_week with (security_invoker = on) as
select
  establishment_id,
  count(*) filter (where status in ('booked','confirmed')) as active_week
from appointments
where start_at >= date_trunc('week', now())
  and start_at < date_trunc('week', now()) + interval '7 days'
group by establishment_id;

create view v_dash_canceled_7d with (security_invoker = on) as
select
  establishment_id,
  count(*) as canceled_7d
from appointments
where status = 'canceled'
  and created_at >= now() - interval '7 days'
group by establishment_id;

create view v_dash_top_services_30d with (security_invoker = on) as
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

create view v_dash_by_professional_30d with (security_invoker = on) as
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