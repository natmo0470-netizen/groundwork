# Groundwork cloud (Phase 5): Supabase

`schema.sql` is the database for accounts, sync and coaching. It enforces the client's sharing choices
inside the database (row-level security), so a coach can never read a category the client hasn't shared,
even with a modified app.

## What's enforced

| Who | Can | Can't |
|---|---|---|
| Any user | Read and write all of their own rows | See anyone else's rows |
| Coach (active link) | Read the client's rows in categories the client shares; send assignments; keep private notes | Change client data or sharing; see individual food entries; see anything while sharing is paused or after the client leaves |
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
| `migrations/004_rejoin.sql` | A client can rejoin a coach they were linked to before; clearer join errors |
| `migrations/005_safety.sql` | Message reports, health-data consent and terms timestamps, size limits |
| `migrations/006_plans.sql` | Plans and access: coach tools need an active coach plan; free plans granted by email; coach business profiles |
| `migrations/007_test_checkout.sql` | Test checkout: while payments aren't set up, coaches can start a free 14-day test plan in the app. Turn it off before launch (see `admin.sql`) |

## Plans, coaches and free accounts

- Coach tools unlock only when `my_access()` reports an active **coach** plan for the account; seat limits come from that plan.
  Nobody can give themselves a plan: `entitlements` rows are written only by `claim_grants()` (from your grants) and,
  at launch, by the billing webhook.
- **Free plans for friends and family:** add a row to `grants` with their email (see `admin.sql`). It's applied the next
  time that person opens the app signed in. Turn **Confirm email** back on before granting plans to people outside your
  test group; while it's off, someone could sign up with another person's email and claim their grant.
- Clients of a coach with an active plan get Plus free (`my_access()` returns `plus` / `coached`); a coach whose plan lapses
  keeps reading access for 14 days.
- `admin.sql` has ready-to-run snippets: grant, list, revoke, end a plan, list open reports.

## The live test (GitHub Actions → Cloud live test)

It signs up throwaway accounts on the real project, checks every permission, then deletes them. Since coach tools need a
coach plan, it grants one to its test coach using the project's **secret key**: Supabase → Project Settings → API Keys →
Secret keys → copy, then GitHub → the repo → Settings → Secrets and variables → Actions → New repository secret, named
`SUPABASE_SECRET_KEY`. The key stays in GitHub's secret store and never appears in logs or in the app.

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


## Food search function (keeps the USDA key private)

`functions/food-search/index.ts` searches USDA FoodData Central with the project's key, which lives only in the
function's secrets. The app calls it at `<project URL>/functions/v1/food-search?q=…`; if it's missing or down, the
app falls back to USDA's shared public `DEMO_KEY`. Limits: 20 searches a minute per IP address, results cached 6 hours.

Deploy from GitHub (works from a phone): add the repository secrets `SUPABASE_ACCESS_TOKEN` and `USDA_API_KEY`, then run the **Deploy edge functions** workflow. It sets the secret, deploys with JWT verification off, and checks a test search.

Or deploy from the dashboard on a computer: Edge Functions → Deploy a new function → Via Editor, name it `food-search`, paste the
file, Deploy. Then Edge Functions → Secrets: add `USDA_API_KEY`. In the function's settings, turn off JWT
verification (food search works without an account).
