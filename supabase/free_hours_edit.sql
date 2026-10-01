drop policy if exists "free_hours update" on public.free_hours;

create policy "free_hours update"
  on public.free_hours for update
  to anon, authenticated
  using (true)
  with check (true);
