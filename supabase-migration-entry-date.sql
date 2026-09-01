-- Add the date an entry applies to an existing Supabase project.
-- Run this once before deploying the frontend changes.

alter table public.internship_entries
  add column if not exists entry_date date;

update public.internship_entries
set entry_date = created_at::date
where entry_date is null;

alter table public.internship_entries
  alter column entry_date set default current_date,
  alter column entry_date set not null;

drop index if exists public.internship_entries_created_at_idx;
create index if not exists internship_entries_entry_date_created_at_idx
  on public.internship_entries (entry_date desc, created_at desc);

revoke all on table public.internship_entries from public, anon, authenticated;
grant select on table public.internship_entries to anon, authenticated;
grant insert (student, content, entry_date)
  on table public.internship_entries to authenticated;

drop policy if exists "Anyone can read internship entries" on public.internship_entries;
create policy "Anyone can read internship entries"
  on public.internship_entries
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can add internship entries" on public.internship_entries;
drop policy if exists "Authenticated users can add internship entries" on public.internship_entries;
create policy "Authenticated users can add internship entries"
  on public.internship_entries
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
    and student in ('Kristian', 'Hans Kristian', 'Kasper', 'Mats')
  );
