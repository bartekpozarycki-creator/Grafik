create table if not exists public.student_parents (
  student_key text primary key,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null default '',
  updated_at timestamptz not null default now(),
  check (char_length(first_name) <= 80),
  check (char_length(last_name) <= 80),
  check (char_length(phone) <= 40),
  info text not null default '',
  check (char_length(info) <= 2000)
);

alter table public.student_parents enable row level security;

grant select, insert, update, delete on public.student_parents to anon, authenticated;

drop policy if exists "student parents all" on public.student_parents;

create policy "student parents all"
  on public.student_parents for all
  to anon, authenticated
  using (true)
  with check (true);

alter table public.student_parents add column if not exists info text not null default '';
