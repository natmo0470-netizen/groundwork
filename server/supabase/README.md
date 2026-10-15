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

## Updates for an existing project

New database pieces ship as numbered files in `migrations/`. Run each one once, in order, in the SQL Editor
(each is safe to run twice). `schema.sql` always contains everything, for brand-new projects.

| File | Adds |
|---|---|
| `migrations/002_messages.sql` | Coach ↔ client messages (`messages` table, read receipts) |
| `migrations/003_invite_preview.sql` | Invite links show who invited you before you sign up (`invite_preview`) |

## Setting up your project (free plan is fine for testing)

1. **Run the schema.** Dashboard → SQL Editor → New query → paste all of `schema.sql` → Run. It should finish
   with "Success. No rows returned". Run it once on a fresh project (it creates tables, so a second run errors).
2. **Copy two values** from the project's **Connect** dialog (or Settings → API Keys):
   - the **Project URL** (`https://<ref>.supabase.co`)
   - the **Publishable key** (`sb_publishable_...`). The legacy `anon` key also works.
   Never use the **secret** / `service_role` key in the app.
   Put them in `js/cloud-config.js` (or send them to Claude to do it). Account features appear in the app as soon as both are set.
3. **Email sign-in settings** (Authentication → Sign In / Providers → Email):
   - While testing, turn **Confirm email** off. Supabase's built-in email sender only delivers to your project's
     team members and is limited to a few emails an hour, so other testers wouldn't receive confirmation links.
   - Set the minimum password length to **8** to match the app.
   - Turn it back on after step 5.
4. **Redirect links** (Authentication → URL Configuration): set **Site URL** to the address where the web app is
   hosted (today `https://natmo0470-netizen.github.io/groundwork/`, later your domain) and add it under
   **Redirect URLs**. Password-reset and confirmation emails send people there, and the app finishes signing them in.
5. **When the domain is ready:** Authentication → Emails → SMTP Settings → connect a sender on your domain
   (for example Resend), then switch **Confirm email** back on and update the Site URL.
6. **Before launch:** upgrade to Pro (free projects pause after a week without activity and have no backups),
   then add Sign in with Apple and Google if wanted.

### How the app uses it

- `js/cloud.js` calls `/auth/v1` and `/rest/v1` directly with `fetch` (no SDK): the publishable key goes in the
  `apikey` header and the signed-in user's token in `Authorization`.
- `app_state` holds each person's full app data as one private row with a version number; a phone only overwrites
  it if it has seen the latest version, otherwise the person chooses which copy to keep.
- The coach-facing tables (`workouts`, `food_day_totals`, `weights`, `measurements`, `activity_days`,
  `pain_reports`, `training_summary`, `body_profile`, `health_flags`) are kept up to date from the phone, sending
  only rows that changed. `food_entries` stays unused: individual foods never leave the phone.
- Coaching: `coach_links` (invite code, status, the client's `share` choices and a short message to the coach),
  `assignments` (plans the client accepts or declines) and `coach_notes` (the coach's private notes).
- Seats: until billing is connected, every coach gets the default 10 seats (`coach_plans` is written only by the
  billing webhook with the secret key).

### Tested against a local stand-in

Postgres 16 + PostgREST 12 + a small auth stand-in, driving the real app in two to four browsers: sign up, restore on
a second phone, incremental sync, conflict choice, invite code (works once), join with sharing choices, coach view
with a category hidden (checked against the database directly), sharing changes, client message, coach notes,
assign → accept, pause all, coach removes client, password-reset link, sign out, delete account (cascades).
