# Implementation Plan: IS-302 Internship Logbook

## Overview
Create a static GitHub Pages diary site backed by Supabase. Students can add entries through a form, browse entries newest-first, and filter the feed by student.

## Architecture Decisions
- Use plain HTML, CSS, and browser JavaScript so GitHub Pages can deploy the site without a build step.
- Load the official `@supabase/supabase-js` v2 browser bundle from jsDelivr and initialize it with the public publishable key in `js/config.js`.
- Treat Supabase as the only source of truth; loading, empty, and error states are explicit in the UI.
- Enforce the student allowlist and content requirements in PostgreSQL as well as in the browser.
- Enable RLS with public read and insert policies only. No anonymous update or delete policies are created.

## Task List

### Phase 1: Foundation
- [x] Build the semantic diary page and responsive visual system.
- [x] Add Supabase configuration and database client behavior.

### Checkpoint: Foundation
- [x] Static page parses and scripts load without syntax errors.
- [x] Form and feed state transitions are covered by static review and browser-ready state handling.

### Phase 2: Persistence And Deployment
- [x] Add complete Supabase schema, constraints, grants, and RLS policies.
- [x] Add short setup documentation and ignore private local configuration files.

### Checkpoint: Complete
- [x] Entries submit, clear the form, show feedback, and refresh the feed.
- [x] Feed filters and sorts correctly.
- [x] No service-role secret is used or committed.

## Risks And Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Public insert access permits unwanted submissions | Medium | Restrict student values and content lengths in SQL; keep the scope appropriate for this small unauthenticated university site. |
| Supabase is unavailable or not configured | Medium | Show actionable loading and error states instead of silently using local storage. |
| User-entered text contains markup | Medium | Render entry content with DOM text nodes, never injected HTML. |

## Open Questions
- None. The requested deployment model and access policy are explicit.

## Entry Date Extension
- Add `entry_date` as a separate calendar date from `created_at`.
- Default the date picker to the local current date, while allowing past dates only.
- Read and sort entries by `entry_date desc, created_at desc` without changing the Supabase client connection.
