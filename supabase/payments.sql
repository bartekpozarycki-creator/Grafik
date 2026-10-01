alter table public.lessons
  add column if not exists student_paid boolean not null default false;

alter table public.lessons
  add column if not exists tutor_paid boolean not null default false;
