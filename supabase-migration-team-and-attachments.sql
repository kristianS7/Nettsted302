-- IS-302 Migration: Team Author & Attachments Support
-- Run this in Supabase SQL Editor to enable 'Teamet' as author and add attachments column.

-- 1. Add attachments column (stores JSON array of files: name, size, type, dataUrl/url)
alter table public.internship_entries
  add column if not exists attachments jsonb default '[]'::jsonb;

-- 2. Update check constraint to allow 'Teamet' alongside student names
alter table public.internship_entries
  drop constraint if exists internship_entries_student_check;

alter table public.internship_entries
  add constraint internship_entries_student_check
  check (student in ('Teamet', 'Kristian', 'Hans Kristian', 'Kasper', 'Mats'));

-- 3. Set default author to 'Teamet'
alter table public.internship_entries
  alter column student set default 'Teamet';

-- 4. Update privileges for authenticated users
grant select, insert, update on table public.internship_entries to authenticated;
grant select on table public.internship_entries to anon;

-- 5. Update RLS policies
drop policy if exists "Authenticated users can add internship entries" on public.internship_entries;
create policy "Authenticated users can add internship entries"
  on public.internship_entries
  for insert
  to authenticated
  with check (
    auth.role() = 'authenticated'
  );

drop policy if exists "Authenticated users can update internship entries" on public.internship_entries;
create policy "Authenticated users can update internship entries"
  on public.internship_entries
  for update
  to authenticated
  using (
    auth.role() = 'authenticated'
  )
  with check (
    auth.role() = 'authenticated'
  );

