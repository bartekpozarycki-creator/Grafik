create table if not exists public.personal_events (
  id uuid primary key default gen_random_uuid(),
  tutor text not null check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test')),
  date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index if not exists personal_events_tutor_date_idx on public.personal_events (tutor, date);

alter table public.personal_events enable row level security;

grant select, insert, update, delete on public.personal_events to anon, authenticated;

drop policy if exists "personal events select" on public.personal_events;
drop policy if exists "personal events insert" on public.personal_events;
drop policy if exists "personal events update" on public.personal_events;
drop policy if exists "personal events delete" on public.personal_events;

create policy "personal events select"
  on public.personal_events for select
  to anon, authenticated
  using (true);

create policy "personal events insert"
  on public.personal_events for insert
  to anon, authenticated
  with check (true);

create policy "personal events update"
  on public.personal_events for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "personal events delete"
  on public.personal_events for delete
  to anon, authenticated
  using (true);
