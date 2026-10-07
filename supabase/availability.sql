create table if not exists public.tutor_status (
  tutor text primary key check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test')),
  taking boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.free_hours (
  id uuid primary key default gen_random_uuid(),
  tutor text not null check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test')),
  date date not null,
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists free_hours_tutor_date_idx on public.free_hours (tutor, date);

alter table public.tutor_status enable row level security;
alter table public.free_hours enable row level security;

grant select, insert, update, delete on public.tutor_status to anon, authenticated;
grant select, insert, update, delete on public.free_hours to anon, authenticated;

drop policy if exists "tutor_status all" on public.tutor_status;
drop policy if exists "free_hours select" on public.free_hours;
drop policy if exists "free_hours insert" on public.free_hours;
drop policy if exists "free_hours delete" on public.free_hours;
drop policy if exists "free_hours update" on public.free_hours;

create policy "tutor_status all"
  on public.tutor_status for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "free_hours select"
  on public.free_hours for select
  to anon, authenticated
  using (true);

create policy "free_hours insert"
  on public.free_hours for insert
  to anon, authenticated
  with check (true);

create policy "free_hours delete"
  on public.free_hours for delete
  to anon, authenticated
  using (true);

create policy "free_hours update"
  on public.free_hours for update
  to anon, authenticated
  using (true)
  with check (true);
