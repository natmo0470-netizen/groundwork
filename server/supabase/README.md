# Groundwork cloud (Phase 5): Supabase

`schema.sql` is the database for accounts, sync and coaching. It enforces the client's sharing choices
inside the database (row-level security), so a coach can never read a category the client hasn't shared,
even with a modified app.

## What's enforced

| Who | Can | Can't |
|---|---|---|
| Any user | Read and write all of their own rows | See anyone else's rows |
| Coach (active link) | Read the client's rows in categories the client shares; send assignments; keep private notes | Change client data or sharing; see individual food entries or photos; see anything while sharing is paused or after the client leaves |
| Client | Accept an invite with chosen sharing; change sharing or leave at any time; accept or decline assignments | Change which coach a link belongs to |
| Seat limits | A coach's invited + active clients can't exceed their plan's seats (plans are set by the billing webhook) | |

Sharing categories match the app: `workouts`, `nutrition` (daily totals only), `body`, `activity`, `wellbeing`, plus `paused`.

## Tested

`permission-tests.sql` runs 14 checks with a coach, a client and a stranger (all pass on Postgres 16).
To rerun locally: create a database, run `local-shim.sql` (stands in for Supabase's `auth` schema), then
`schema.sql`, then `permission-tests.sql`. Don't run `local-shim.sql` on Supabase.

## When the Supabase project exists

1. Create the project (US East is closest to most US users). Copy the project URL and anon key.
2. SQL editor → paste `schema.sql` → Run.
3. Authentication → Providers: Email (magic link), Sign in with Apple, Google. Apple requires Sign in with Apple
   in an iOS app that offers Google sign-in.
4. Authentication → SMTP: connect a sender (e.g. Resend) on your own domain so sign-in emails aren't rate-limited.
5. Send me the project URL and anon key; the app's storage adapter switches from on-device to synced.
