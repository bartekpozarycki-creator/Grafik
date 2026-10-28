alter table public.app_logins add column if not exists pay jsonb;

create or replace function public.save_tutor_rates(rates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  tutor_name text;
  given jsonb;
  clean jsonb;
  level_pay jsonb;
  level text;
  duration text;
  cell jsonb;
  tutor_amount numeric;
  school_amount numeric;
begin
  if jsonb_typeof(rates) <> 'array' then
    raise exception 'bad rates';
  end if;

  for item in select value from jsonb_array_elements(rates)
  loop
    tutor_name := item->>'name';
    given := item->'pay';
    if tutor_name is null or jsonb_typeof(given) <> 'object' then
      raise exception 'bad rate';
    end if;

    clean := '{}'::jsonb;
    foreach level in array array['rozszerzenie', 'podstawa', 'podstawowka']
    loop
      if jsonb_typeof(given->level) <> 'object' then
        raise exception 'bad rate';
      end if;
      level_pay := '{}'::jsonb;
      foreach duration in array array['45', '60', '90']
      loop
        cell := given->level->duration;
        begin
          tutor_amount := (cell->>'tutor')::numeric;
          school_amount := (cell->>'school')::numeric;
        exception
          when others then
            raise exception 'bad rate';
        end;
        if tutor_amount is null or school_amount is null
          or tutor_amount < 0 or school_amount < 0
          or tutor_amount > 100000 or school_amount > 100000 then
          raise exception 'bad rate';
        end if;
        level_pay := level_pay || jsonb_build_object(
          duration,
          jsonb_build_object('tutor', tutor_amount, 'school', school_amount)
        );
      end loop;
      clean := clean || jsonb_build_object(level, level_pay);
    end loop;

    update public.app_logins
    set pay = clean
    where role = 'tutor' and display_name = tutor_name;
    if not found then
      raise exception 'missing tutor';
    end if;
  end loop;
end;
$$;

revoke all on function public.save_tutor_rates(jsonb) from public;
grant execute on function public.save_tutor_rates(jsonb) to anon, authenticated;

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
      'profit', profit,
      'pay', pay
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
    'profit', account.profit,
    'pay', account.pay
  );
end;
$$;

revoke all on function public.match_login(text) from public, anon, authenticated;
grant execute on function public.match_login(text) to anon, authenticated;
