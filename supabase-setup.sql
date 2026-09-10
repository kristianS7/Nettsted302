-- IS-302 internship logbook schema
-- Run this whole file in the Supabase SQL Editor for a new project.

create table if not exists public.internship_entries (
  id uuid primary key default gen_random_uuid(),
  student text not null check (student in ('Kristian', 'Hans Kristian', 'Kasper', 'Mats')),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists internship_entries_entry_date_created_at_idx
  on public.internship_entries (entry_date desc, created_at desc);

alter table public.internship_entries enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on table public.internship_entries from public, anon, authenticated;
grant select on table public.internship_entries to anon, authenticated;
grant insert (student, content, entry_date),
      update (entry_date, content)
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

-- No public delete policy is created, and delete privilege is revoked.
