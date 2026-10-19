do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'lessons'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%level%';

  if constraint_name is not null then
    execute format('alter table public.lessons drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.lessons
  add constraint lessons_level_check
  check (level in ('podstawa', 'podstawowka', 'rozszerzenie', 'studia'));

create table if not exists public.level_prices (
  level text primary key check (level in ('podstawa', 'podstawowka', 'rozszerzenie', 'studia')),
  price integer not null check (price >= 0 and price <= 100000)
);

insert into public.level_prices (level, price)
values
  ('rozszerzenie', 100),
  ('podstawa', 90),
  ('podstawowka', 90),
  ('studia', 100)
on conflict (level) do nothing;

alter table public.level_prices enable row level security;

grant select, insert, update on public.level_prices to anon, authenticated;

drop policy if exists "level prices select" on public.level_prices;
drop policy if exists "level prices insert" on public.level_prices;
drop policy if exists "level prices update" on public.level_prices;

create policy "level prices select"
  on public.level_prices for select
  to anon, authenticated
  using (true);

create policy "level prices insert"
  on public.level_prices for insert
  to anon, authenticated
  with check (true);

create policy "level prices update"
  on public.level_prices for update
  to anon, authenticated
  using (true)
  with check (true);
