do $$
declare
  rule record;
begin
  for rule in
    select rel.relname as table_name, con.conname as constraint_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('lessons', 'tutor_status', 'free_hours')
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%Tomek%'
  loop
    execute format('alter table public.%I drop constraint %I', rule.table_name, rule.constraint_name);
  end loop;
end $$;

alter table public.lessons
  drop constraint if exists lessons_tutor_check;
alter table public.lessons
  add constraint lessons_tutor_check check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test'));

alter table public.tutor_status
  drop constraint if exists tutor_status_tutor_check;
alter table public.tutor_status
  add constraint tutor_status_tutor_check check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test'));

alter table public.free_hours
  drop constraint if exists free_hours_tutor_check;
alter table public.free_hours
  add constraint free_hours_tutor_check check (tutor in ('Tomek', 'Wojtek', 'Szymon', 'Test'));
