alter table public.lessons
  add column if not exists held boolean;

do $$
begin
  if not exists (select 1 from public.lessons where held is not null) then
    update public.lessons set held = true;
  end if;
end $$;
