-- IS-302 internship logbook authentication setup
-- Run this whole file in the Supabase SQL Editor.
-- Existing rows in public.internship_entries are preserved.

alter table public.internship_entries enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on table public.internship_entries from public, anon, authenticated;
grant select on table public.internship_entries to anon, authenticated;
grant insert (student, content)
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

-- No update or delete policies are created, and those privileges are revoked.
