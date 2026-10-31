-- Run this file once in Supabase Dashboard > SQL Editor for the project.
create extension if not exists pgcrypto;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  origin_label text not null,
  origin_lat double precision not null check (origin_lat between -90 and 90),
  origin_lon double precision not null check (origin_lon between -180 and 180),
  destination_label text not null,
  destination_lat double precision not null check (destination_lat between -90 and 90),
  destination_lon double precision not null check (destination_lon between -180 and 180),
  arrive_by timestamptz not null,
  time_zone text not null default 'UTC',
  travel_mode text not null check (travel_mode in ('car', 'two-wheeler', 'walk')),
  importance text not null check (importance in ('casual', 'important', 'critical')),
  fixed_buffer_minutes integer not null check (fixed_buffer_minutes between 0 and 180),
  recommended_leave_at timestamptz not null,
  estimated_duration_minutes integer not null,
  safety_margin_minutes integer not null default 0,
  safety_margin_method text not null default 'percentage' check (safety_margin_method in ('percentage', 'learned')),
  safety_margin_sample_count integer not null default 0 check (safety_margin_sample_count >= 0),
  weather_penalty_minutes integer not null default 0,
  weather_status text not null check (weather_status in ('rain', 'clear', 'unavailable')),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_rechecks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  checkpoint_minutes integer not null check (checkpoint_minutes in (60, 30, 15)),
  scheduled_at timestamptz not null,
  baseline_leave_at timestamptz not null,
  baseline_duration_minutes integer not null,
  baseline_weather_penalty_minutes integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'skipped', 'cancelled', 'failed')),
  attempts integer not null default 0,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, checkpoint_minutes)
);

create index if not exists trip_rechecks_due_idx
  on public.trip_rechecks (scheduled_at) where status in ('pending', 'processing');
create index if not exists trips_subscription_idx on public.trips (subscription_id, status);

-- Browser traffic gets no direct table access. Only the server's Supabase secret key writes these rows.
alter table public.push_subscriptions enable row level security;
alter table public.trips enable row level security;
alter table public.trip_rechecks enable row level security;
revoke all on table public.push_subscriptions, public.trips, public.trip_rechecks from anon, authenticated;
grant all on table public.push_subscriptions, public.trips, public.trip_rechecks to service_role;

create or replace function public.claim_due_trip_rechecks(p_limit integer default 10)
returns setof public.trip_rechecks
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select job.id
    from public.trip_rechecks as job
    join public.trips as trip on trip.id = job.trip_id
    where trip.status = 'active'
      and (
        (job.status = 'pending' and job.scheduled_at <= now())
        or (job.status = 'processing' and job.locked_at < now() - interval '10 minutes')
      )
      and not exists (
        select 1
        from public.trip_rechecks as earlier
        where earlier.trip_id = job.trip_id
          and earlier.status in ('pending', 'processing')
          and earlier.scheduled_at <= now()
          and (earlier.scheduled_at, earlier.checkpoint_minutes) < (job.scheduled_at, job.checkpoint_minutes)
      )
    order by job.scheduled_at
    limit greatest(1, least(p_limit, 50))
    for update of job, trip skip locked
  )
  update public.trip_rechecks as job
  set status = 'processing', locked_at = now(), attempts = job.attempts + 1
  from due
  where job.id = due.id
  returning job.*;
end;
$$;

revoke all on function public.claim_due_trip_rechecks(integer) from public, anon, authenticated;
grant execute on function public.claim_due_trip_rechecks(integer) to service_role;
