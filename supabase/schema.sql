create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  tutor text not null check (tutor in ('Tomek', 'Wojtek', 'Szymon')),
  date date not null,
  student_name text not null,
  discord text not null,
  duration integer not null check (duration in (45, 60, 90)),
  kind text not null check (kind in ('zwykla', 'probna')),
  level text not null check (level in ('podstawa', 'podstawowka', 'rozszerzenie')),
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
