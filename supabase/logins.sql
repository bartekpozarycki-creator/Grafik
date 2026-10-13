create table if not exists public.app_logins (
  login text primary key,
  role text not null check (role in ('admin', 'tutor', 'reserve')),
  display_name text not null,
  counts_money boolean not null default true,
  profit integer not null default 0,
  sort integer not null default 0,
  code text
);

alter table public.app_logins enable row level security;

revoke all on table public.app_logins from public, anon, authenticated;

alter table public.app_logins add column if not exists code text;

insert into public.app_logins (login, role, display_name, counts_money, profit, sort, code)
values
  ('tomek', 'tutor', 'Tomek', true, 30, 1, null),
  ('wojtek', 'tutor', 'Wojtek', true, 20, 2, null),
  ('szymon', 'tutor', 'Szymon', true, 30, 3, null),
  ('test', 'tutor', 'Test', false, 0, 4, null),
  ('adminlogin', 'admin', 'AdminLogin', false, 0, 0, null),
  ('rezerwacjaterminu', 'reserve', 'RezerwacjaTerminu', false, 0, 0, '85424')
on conflict (login) do update
set
  role = excluded.role,
  display_name = excluded.display_name,
  counts_money = excluded.counts_money,
  profit = excluded.profit,
  sort = excluded.sort,
  code = excluded.code;

create or replace function public.match_login(raw text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  account public.app_logins%rowtype;
  tutors jsonb;
begin
  select * into account
  from public.app_logins
  where login = lower(trim(coalesce(raw, '')));

  if not found then
    return null;
  end if;

  if account.role = 'admin' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', display_name,
      'countsMoney', counts_money,
      'profit', profit
    ) order by sort), '[]'::jsonb)
    into tutors
    from public.app_logins
    where role = 'tutor';

    return jsonb_build_object(
      'role', 'admin',
      'name', account.display_name,
      'tutors', tutors
    );
  end if;

  if account.role = 'reserve' then
    return jsonb_build_object('role', 'reserve');
  end if;

  return jsonb_build_object(
    'role', 'tutor',
    'name', account.display_name,
    'countsMoney', account.counts_money,
    'profit', account.profit
  );
end;
$$;

revoke all on function public.match_login(text) from public, anon, authenticated;
grant execute on function public.match_login(text) to anon, authenticated;

drop function if exists public.reserve_allowed(text, text);

create or replace function public.reserve_allowed(raw text, given text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_logins
    where login = lower(trim(coalesce(raw, '')))
      and role = 'reserve'
      and app_logins.code is not null
      and app_logins.code = trim(coalesce(given, ''))
  );
$$;

revoke all on function public.reserve_allowed(text, text) from public, anon, authenticated;
grant execute on function public.reserve_allowed(text, text) to anon, authenticated;

alter table public.tutor_status add column if not exists bookable boolean not null default true;

