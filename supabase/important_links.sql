create table if not exists public.important_links (
  id uuid primary key default gen_random_uuid(),
  tutor text not null,
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists important_links_tutor_idx on public.important_links (tutor);

alter table public.important_links enable row level security;

grant select, insert, delete on public.important_links to anon, authenticated;

drop policy if exists "important_links select" on public.important_links;
drop policy if exists "important_links insert" on public.important_links;
drop policy if exists "important_links delete" on public.important_links;

create policy "important_links select"
  on public.important_links for select
  to anon, authenticated
  using (true);

create policy "important_links insert"
  on public.important_links for insert
  to anon, authenticated
  with check (true);

create policy "important_links delete"
  on public.important_links for delete
  to anon, authenticated
  using (true);
