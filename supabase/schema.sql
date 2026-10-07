create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  tutor text not null check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test')),
  date date not null,
  student_name text not null,
  discord text not null,
  duration integer not null check (duration in (45, 60, 90)),
  kind text not null check (kind in ('zwykla', 'probna')),
  level text not null check (level in ('podstawa', 'podstawowka', 'rozszerzenie')),
  starts_at time,
  held boolean,
  student_paid boolean not null default false,
  tutor_paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lessons_tutor_date_idx on public.lessons (tutor, date);

alter table public.lessons enable row level security;

grant select, insert, update, delete on public.lessons to anon, authenticated;

drop policy if exists "lessons select" on public.lessons;
drop policy if exists "lessons insert" on public.lessons;
drop policy if exists "lessons update" on public.lessons;
drop policy if exists "lessons delete" on public.lessons;

create policy "lessons select"
  on public.lessons for select
  to anon, authenticated
  using (true);

create policy "lessons insert"
  on public.lessons for insert
  to anon, authenticated
  with check (true);

create policy "lessons update"
  on public.lessons for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "lessons delete"
  on public.lessons for delete
  to anon, authenticated
  using (true);

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

alter table public.lessons
  add column if not exists student_paid boolean not null default false;

alter table public.lessons
  add column if not exists tutor_paid boolean not null default false;

alter table public.lessons
  add column if not exists starts_at time;

alter table public.lessons
  add column if not exists held boolean;

do $$
declare
  rule record;
begin
  for rule in
    select rel.relname as table_name, con.conname as constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('lessons', 'tutor_status', 'free_hours')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%Tomek%'
  loop
    execute format('alter table public.%I drop constraint %I', rule.table_name, rule.constraint_name);
  end loop;
end $$;

alter table public.lessons
  drop constraint if exists lessons_tutor_check;
alter table public.lessons
  add constraint lessons_tutor_check check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test'));

alter table public.tutor_status
  drop constraint if exists tutor_status_tutor_check;
alter table public.tutor_status
  add constraint tutor_status_tutor_check check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test'));

alter table public.free_hours
  drop constraint if exists free_hours_tutor_check;
alter table public.free_hours
  add constraint free_hours_tutor_check check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test'));

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  student_name text not null,
  discord text not null,
  email text not null,
  phone text not null,
  tutor text not null check (tutor in ('Tomek', 'Wojtek', 'Szymon')),
  date date not null,
  starts_at time not null,
  duration integer not null default 60 check (duration = 60),
  created_at timestamptz not null default now(),
  unique (tutor, date, starts_at)
);

create index if not exists bookings_date_idx on public.bookings (date, starts_at);

alter table public.bookings enable row level security;

grant select, insert, delete on public.bookings to anon, authenticated;

drop policy if exists "bookings select" on public.bookings;
drop policy if exists "bookings insert" on public.bookings;
drop policy if exists "bookings delete" on public.bookings;

create policy "bookings select"
  on public.bookings for select
  to anon, authenticated
  using (true);

create policy "bookings insert"
  on public.bookings for insert
  to anon, authenticated
  with check (true);

create policy "bookings delete"
  on public.bookings for delete
  to anon, authenticated
  using (true);
