# IS-302 Internship Logbook

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `supabase-setup.sql` for a new database.
4. Run `supabase-auth-setup.sql` to require login for new entries.
5. Copy the Project URL.
6. Copy the anon/publishable key.
7. Put them in `js/config.js`.
8. Deploy through GitHub Pages.

The anon/publishable key is designed to be public in a static site. Never put a Supabase `service_role` key in frontend code. Supabase Row Level Security protects the database.
