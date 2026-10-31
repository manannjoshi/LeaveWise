-- Run once for an existing Phase 3 database before using Phase 4 learned margins.
alter table public.trips
  add column if not exists safety_margin_minutes integer not null default 0,
  add column if not exists safety_margin_method text not null default 'percentage',
  add column if not exists safety_margin_sample_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trips_safety_margin_method_check'
  ) then
    alter table public.trips
      add constraint trips_safety_margin_method_check
      check (safety_margin_method in ('percentage', 'learned'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'trips_safety_margin_sample_count_check'
  ) then
    alter table public.trips
      add constraint trips_safety_margin_sample_count_check
      check (safety_margin_sample_count >= 0);
  end if;
end;
$$;
