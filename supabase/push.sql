create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tutor text not null check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test')),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_tutor_idx on public.push_subscriptions (tutor);

alter table public.push_subscriptions enable row level security;

grant select, insert, update, delete on public.push_subscriptions to anon, authenticated;

drop policy if exists "push subscriptions select" on public.push_subscriptions;
drop policy if exists "push subscriptions insert" on public.push_subscriptions;
drop policy if exists "push subscriptions update" on public.push_subscriptions;
drop policy if exists "push subscriptions delete" on public.push_subscriptions;

create policy "push subscriptions select"
  on public.push_subscriptions for select
  to anon, authenticated
  using (true);

create policy "push subscriptions insert"
  on public.push_subscriptions for insert
  to anon, authenticated
  with check (true);

create policy "push subscriptions update"
  on public.push_subscriptions for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "push subscriptions delete"
  on public.push_subscriptions for delete
  to anon, authenticated
  using (true);
