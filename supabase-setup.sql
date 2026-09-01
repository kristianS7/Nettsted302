-- IS-302 internship logbook schema
-- Run this whole file once in the Supabase SQL Editor.

-- The previous setup used a different schema. Recreating this small table makes
-- the script work for a new project and removes any incomplete old definition.
drop table if exists public.internship_entries cascade;

create table public.internship_entries (
  id uuid primary key default gen_random_uuid(),
  student text not null check (student in ('Kristian', 'Hans Kristian', 'Kasper', 'Mats')),
  content text not null check (char_length(btrim(content)) between 1 and 10000),
  created_at timestamptz not null default now()
);

create index internship_entries_created_at_idx
  on public.internship_entries (created_at desc);

alter table public.internship_entries enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on table public.internship_entries from anon, authenticated;
grant select on table public.internship_entries to anon, authenticated;
grant insert (student, content) on table public.internship_entries to anon, authenticated;

create policy "Anyone can read internship entries"
  on public.internship_entries
  for select
  to anon, authenticated
  using (true);

create policy "Anyone can add internship entries"
  on public.internship_entries
  for insert
  to anon, authenticated
  with check (student in ('Kristian', 'Hans Kristian', 'Kasper', 'Mats'));

-- No public update or delete policies are created.
