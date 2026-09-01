# IS-302 Internship Logbook

1. Create a Supabase project.
2. Open the SQL Editor.
3. Run `supabase-setup.sql`.
4. Copy the Project URL.
5. Copy the anon/publishable key.
6. Put them in `js/config.js`.
7. Deploy through GitHub Pages.

The anon/publishable key is designed to be public in a static site. Never put a Supabase `service_role` key in frontend code. Supabase Row Level Security protects the database.
