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
