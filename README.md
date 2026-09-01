# IS-302 Internship Logbook

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `supabase-setup.sql` for a new database.
4. If the database already exists, run `supabase-migration-entry-date.sql`.
5. Run `supabase-auth-setup.sql` to require login for new entries.
6. Copy the Project URL.
7. Copy the anon/publishable key.
8. Put them in `js/config.js`.
9. Deploy through GitHub Pages.

The anon/publishable key is designed to be public in a static site. Never put a Supabase `service_role` key in frontend code. Supabase Row Level Security protects the database.
