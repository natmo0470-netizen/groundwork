-- Movla cloud schema (Phase 5) for Supabase / Postgres.
-- Draft: run in the Supabase SQL editor once the project exists, then test with two accounts.
--
-- Principles
--   * Every row belongs to one user (user_id = auth.uid()); owners can always read and write their own rows.
--   * A coach can READ a client's rows only for categories the client shares, while the link is active
--     and sharing isn't paused. The client changes coach_links.share at any time; access follows instantly.
--   * A coach can always SEND assignments (plans, nutrition goals) to an active client; the client accepts or declines.
--   * Individual food entries and progress photos are never readable by a coach (photos are never uploaded at all).
--   * Seat limits: a coach's active + invited clients can't exceed their plan's seats.

create extension if not exists pgcrypto with schema extensions;

-- ---------- people ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  is_coach boolean not null default false,
  synced_at timestamptz,                                                 -- last time the app synced (shown to a linked coach)
  created_at timestamptz not null default now()
);

create table public.coach_plans (
  coach_id uuid primary key references public.profiles (id) on delete cascade,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'studio')),
  seats int not null default 10,
  updated_at timestamptz not null default now()
);

create table public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles (id) on delete cascade,
  client_id uuid references public.profiles (id) on delete cascade,     -- null until the invite is accepted
  client_label text not null default '',                                 -- the name the coach typed
  invite_code text unique not null default upper(encode(extensions.gen_random_bytes(4), 'hex')),  -- 8 characters, easy to type
  status text not null default 'invited' check (status in ('invited', 'active', 'ended')),
  share jsonb not null default '{"workouts": true, "nutrition": true, "body": true, "activity": false, "wellbeing": true, "paused": false}',
  client_note text not null default '',                                  -- a short message from the client to the coach
  client_note_at timestamptz,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
-- one ACTIVE link per coach + client; ended links stay as history so a client can rejoin later
create unique index coach_links_one_active on public.coach_links (coach_id, client_id) where status = 'active';

-- ---------- the client's data, by sharing category ----------
-- workouts
create table public.workouts (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  id text not null,                                  -- created on the phone
  day date not null, name text not null, duration_min int, sets jsonb not null default '[]', prs int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table public.training_summary (                -- shared with 'workouts'
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  plan_name text, days_per_week int, planned_14 int, done_14 int, goal text, experience text,
  updated_at timestamptz not null default now()
);
-- nutrition: coaches see daily totals only; individual entries stay private
create table public.food_day_totals (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null, kcal int not null default 0, protein int not null default 0, carbs int not null default 0, fat int not null default 0,
  target_kcal int, target_protein int,
  primary key (user_id, day)
);
create table public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null, meal text, item jsonb not null
);
-- body
create table public.weights (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null, kg numeric(5, 2) not null, source text,
  primary key (user_id, day)
);
create table public.body_profile (                    -- shared with 'body'
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  age int, sex text, height_cm numeric(5, 1)
);
create table public.measurements (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null, values jsonb not null,
  primary key (user_id, day)
);
-- activity (Apple Health / Health Connect daily summaries)
create table public.activity_days (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day date not null, steps int, active_kcal int, sleep_min int, resting_hr numeric(5, 1),
  primary key (user_id, day)
);
-- wellbeing
create table public.pain_reports (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  id text not null,
  day date not null, exercise_id text, area text, kind text check (kind in ('sharp', 'ache')),
  primary key (user_id, id)
);
create table public.health_flags (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  needs_clearance boolean not null default false, cleared_on date
);
-- everything else in the app (settings, plan, custom workouts, meal plans): owner only
create table public.app_state (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  state jsonb not null, version int not null default 1, updated_at timestamptz not null default now()
);

-- ---------- coach -> client ----------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links (id) on delete cascade,
  coach_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  client_id uuid not null references public.profiles (id) on delete cascade,
  payload jsonb not null,            -- { program?, workouts?, days, targets?, note }
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  created_at timestamptz not null default now(), answered_at timestamptz
);
create table public.coach_notes (    -- private notes a coach keeps about a client
  link_id uuid primary key references public.coach_links (id) on delete cascade,
  coach_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  notes text not null default ''
);

-- ---------- permission check ----------
create or replace function public.coach_can_see(client uuid, category text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_links l
    where l.coach_id = auth.uid() and l.client_id = client and l.status = 'active'
      and coalesce((l.share ->> 'paused')::boolean, false) = false
      and coalesce((l.share ->> category)::boolean, false) = true
  );
$$;

create or replace function public.is_active_coach_of(client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_links l where l.coach_id = auth.uid() and l.client_id = client and l.status = 'active');
$$;

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.coach_plans enable row level security;
alter table public.coach_links enable row level security;
alter table public.workouts enable row level security;
alter table public.food_day_totals enable row level security;
alter table public.food_entries enable row level security;
alter table public.weights enable row level security;
alter table public.measurements enable row level security;
alter table public.training_summary enable row level security;
alter table public.body_profile enable row level security;
alter table public.activity_days enable row level security;
alter table public.pain_reports enable row level security;
alter table public.health_flags enable row level security;
alter table public.app_state enable row level security;
alter table public.assignments enable row level security;
alter table public.coach_notes enable row level security;

-- profiles: yourself, plus the other side of an active link (names only via this table)
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_linked on public.profiles for select using (
  exists (select 1 from public.coach_links l where l.status = 'active'
          and ((l.coach_id = auth.uid() and l.client_id = profiles.id) or (l.client_id = auth.uid() and l.coach_id = profiles.id))));

create policy coach_plans_self on public.coach_plans for select using (coach_id = auth.uid());
-- plan/seat changes are written by the billing webhook (service role), not by the app

-- links: the coach creates invites and can end them; the client accepts, edits sharing, or leaves
create policy links_coach_read on public.coach_links for select using (coach_id = auth.uid());
create policy links_client_read on public.coach_links for select using (client_id = auth.uid());
create policy links_coach_invite on public.coach_links for insert with check (coach_id = auth.uid() and client_id is null and status = 'invited');
create policy links_coach_end on public.coach_links for update using (coach_id = auth.uid()) with check (coach_id = auth.uid() and status in ('invited', 'ended'));
create policy links_client_update on public.coach_links for update using (client_id = auth.uid()) with check (client_id = auth.uid() and status in ('active', 'ended'));
-- accepting an invite (setting client_id) goes through accept_invite() below, since the client isn't on the row yet

-- the client's own data: full access for the owner; read access for a coach per shared category
create policy own_workouts on public.workouts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_workouts on public.workouts for select using (coach_can_see(user_id, 'workouts'));
create policy own_food_totals on public.food_day_totals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_food_totals on public.food_day_totals for select using (coach_can_see(user_id, 'nutrition'));
create policy own_food_entries on public.food_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_weights on public.weights for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_weights on public.weights for select using (coach_can_see(user_id, 'body'));
create policy own_training_summary on public.training_summary for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_training_summary on public.training_summary for select using (coach_can_see(user_id, 'workouts'));
create policy own_body_profile on public.body_profile for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_body_profile on public.body_profile for select using (coach_can_see(user_id, 'body'));
create policy own_measurements on public.measurements for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_measurements on public.measurements for select using (coach_can_see(user_id, 'body'));
create policy own_activity on public.activity_days for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_activity on public.activity_days for select using (coach_can_see(user_id, 'activity'));
create policy own_pain on public.pain_reports for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_pain on public.pain_reports for select using (coach_can_see(user_id, 'wellbeing'));
create policy own_flags on public.health_flags for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_flags on public.health_flags for select using (coach_can_see(user_id, 'wellbeing'));
create policy own_state on public.app_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- assignments: a coach can always send to an active client (sharing settings don't block this)
create policy assign_coach_send on public.assignments for insert with check (coach_id = auth.uid() and is_active_coach_of(client_id));
create policy assign_coach_read on public.assignments for select using (coach_id = auth.uid());
create policy assign_client_read on public.assignments for select using (client_id = auth.uid());
create policy assign_client_answer on public.assignments for update using (client_id = auth.uid()) with check (client_id = auth.uid() and status in ('accepted', 'declined'));
create policy coach_notes_own on public.coach_notes for all using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- accepting an invite, and seat limits ----------
create or replace function public.accept_invite(code text, share jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare link_id uuid; coach uuid;
begin
  select l.coach_id into coach from coach_links l
   where l.invite_code = upper(accept_invite.code) and l.status = 'invited' and l.client_id is null;
  if coach is null then raise exception 'Invite not found or already used'; end if;
  if coach = auth.uid() then raise exception 'This is your own invite link'; end if;
  if exists (select 1 from coach_links l where l.coach_id = coach and l.client_id = auth.uid() and l.status = 'active') then
    raise exception 'You are already linked with this coach';
  end if;
  update coach_links set client_id = auth.uid(), status = 'active', accepted_at = now(), share = coalesce(accept_invite.share, coach_links.share)
   where invite_code = upper(accept_invite.code) and status = 'invited' and client_id is null
   returning id into link_id;
  if link_id is null then raise exception 'Invite not found or already used'; end if;
  return link_id;
end; $$;

create or replace function public.enforce_seats() returns trigger language plpgsql security definer set search_path = public as $$
declare used int; cap int;
begin
  select coalesce((select seats from coach_plans where coach_id = new.coach_id), 10) into cap;
  select count(*) into used from coach_links where coach_id = new.coach_id and status in ('invited', 'active');
  if used >= cap then raise exception 'All % client seats are in use', cap; end if;
  return new;
end; $$;
create trigger coach_links_seats before insert on public.coach_links for each row execute function public.enforce_seats();

-- Each side may change only its own fields: the coach can end a link; the client can change sharing or leave.
-- (accept_invite fills client_id; nobody can move a link to another coach or rewrite the invite code.)
create or replace function public.guard_link_update() returns trigger language plpgsql set search_path = public as $$
begin
  if new.coach_id <> old.coach_id or new.invite_code <> old.invite_code or new.client_label <> old.client_label and auth.uid() <> old.coach_id then
    raise exception 'This part of a coach link can''t be changed';
  end if;
  if new.client_id is distinct from old.client_id and not (old.client_id is null and old.status = 'invited' and new.client_id = auth.uid() and new.status = 'active') then
    raise exception 'This part of a coach link can''t be changed';
  end if;
  if auth.uid() = old.coach_id and (new.share <> old.share or new.client_note <> old.client_note or (new.status <> old.status and new.status <> 'ended')) then
    raise exception 'Only the client can change what they share';
  end if;
  if old.status = 'ended' and new.status <> 'ended' then
    raise exception 'An ended link needs a new invite';
  end if;
  return new;
end; $$;
create trigger coach_links_guard before update on public.coach_links for each row execute function public.guard_link_update();

-- ---------- messages between a coach and a client ----------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists messages_link_time on public.messages (link_id, created_at desc);
create index if not exists messages_unread on public.messages (link_id) where read_at is null;
alter table public.messages enable row level security;

-- Either side of a link (coach or client). Sending needs the link to be active.
create or replace function public.is_link_party(link uuid, active_only boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_links l where l.id = link
    and (l.coach_id = auth.uid() or l.client_id = auth.uid())
    and (not active_only or l.status = 'active'));
$$;
drop policy if exists messages_read on public.messages;
drop policy if exists messages_send on public.messages;
create policy messages_read on public.messages for select using (is_link_party(link_id));
create policy messages_send on public.messages for insert with check (sender_id = auth.uid() and is_link_party(link_id, true));
-- No update/delete policies: messages can't be edited. Read receipts go through this function,
-- which only marks the OTHER person's messages as read.
create or replace function public.mark_messages_read(link uuid)
returns int language sql security definer set search_path = public as $$
  with u as (update messages set read_at = now()
             where link_id = link and sender_id <> auth.uid() and read_at is null and is_link_party(link)
             returning 1)
  select count(*)::int from u;
$$;

-- ---------- invite links: who sent this invite? (readable before signing in) ----------
create or replace function public.invite_preview(code text)
returns table (coach_name text, client_label text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.display_name, ''), 'Your coach'), l.client_label
  from coach_links l join profiles p on p.id = l.coach_id
  where l.invite_code = upper(invite_preview.code) and l.status = 'invited' and l.client_id is null;
$$;
grant execute on function public.invite_preview(text) to anon, authenticated;

-- ---------- reports, consent and size limits ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,   -- kept (anonymous) if the reporter deletes their account
  link_id uuid references public.coach_links (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  reported_body text,                                   -- copy of the message as it was reported
  reason text not null check (reason in ('harassment', 'spam', 'inappropriate', 'unsafe', 'other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists reports_file on public.reports;
drop policy if exists reports_own on public.reports;
create policy reports_file on public.reports for insert with check (reporter_id = auth.uid() and (link_id is null or is_link_party(link_id)));
create policy reports_own on public.reports for select using (reporter_id = auth.uid());
-- Reports are reviewed in the Supabase dashboard (Table Editor → reports); nobody else can read them.

-- 2) Consent to store health and fitness data in the account (Washington My Health My Data Act and similar laws).
alter table public.profiles add column if not exists health_consent_at timestamptz;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;

-- 3) Size limits so one account can't fill the database.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_name_len') then
    alter table public.profiles add constraint profiles_name_len check (char_length(display_name) <= 80); end if;
  if not exists (select 1 from pg_constraint where conname = 'coach_links_label_len') then
    alter table public.coach_links add constraint coach_links_label_len check (char_length(client_label) <= 80); end if;
  if not exists (select 1 from pg_constraint where conname = 'app_state_size') then
    alter table public.app_state add constraint app_state_size check (pg_column_size(state) < 5000000); end if;
  if not exists (select 1 from pg_constraint where conname = 'coach_notes_len') then
    alter table public.coach_notes add constraint coach_notes_len check (char_length(notes) <= 5000); end if;
end $$;

-- ---------- plans and access (coach plans, Plus, friends-and-family grants) ----------

-- What each account has. Rows are written by the billing webhook (later) or by claiming a grant; people can only read their own.
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('plus', 'coach')),
  plan text not null default '',                       -- 'plus', or a coach tier: 'starter' | 'growth' | 'pro' | 'studio'
  seats int check (seats is null or seats between 0 and 10000),
  source text not null check (source in ('store', 'web', 'grant', 'trial')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,                                  -- null = no end date
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists entitlements_user on public.entitlements (user_id, kind);
alter table public.entitlements enable row level security;
drop policy if exists entitlements_own on public.entitlements;
create policy entitlements_own on public.entitlements for select using (user_id = auth.uid());

-- Free plans for friends and family, by email. Managed only in the Supabase dashboard (no policies = no app access).
create table if not exists public.grants (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  kind text not null check (kind in ('plus', 'coach')),
  plan text not null default '',
  seats int,
  months int check (months is null or months > 0),     -- null = forever
  note text not null default '',
  revoked boolean not null default false,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.grants enable row level security;

-- A coach's business profile from onboarding (shown to clients; credentials are self-reported).
create table if not exists public.coach_profiles (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  business_name text not null default '' check (char_length(business_name) <= 80),
  coaching_type text not null default 'online' check (coaching_type in ('in_person', 'online', 'hybrid')),
  specialties text[] not null default '{}',
  certification text not null default '' check (char_length(certification) <= 60),
  cert_number text not null default '' check (char_length(cert_number) <= 60),
  client_count int check (client_count is null or client_count between 0 and 10000),
  plan_wanted text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.coach_profiles enable row level security;
drop policy if exists coach_profiles_own on public.coach_profiles;
drop policy if exists coach_profiles_clients on public.coach_profiles;
create policy coach_profiles_own on public.coach_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy coach_profiles_clients on public.coach_profiles for select using (
  exists (select 1 from public.coach_links l where l.coach_id = coach_profiles.user_id and l.client_id = auth.uid() and l.status = 'active'));

-- ---------- checks ----------
create or replace function public.has_coach_access(u uuid, grace interval default interval '0')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from entitlements e where e.user_id = u and e.kind = 'coach'
                 and e.starts_at <= now() and (e.ends_at is null or e.ends_at + grace > now()));
$$;
create or replace function public.coach_seat_limit(u uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(e.seats), 0) from entitlements e where e.user_id = u and e.kind = 'coach'
    and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now());
$$;

-- What the signed-in person can use: their own plans, plus free Plus while linked to a coach with an active plan.
create or replace function public.my_access()
returns table (kind text, plan text, seats int, source text, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.kind, e.plan, e.seats, e.source, e.ends_at from entitlements e
   where e.user_id = auth.uid() and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
  union all
  select 'plus', 'coached', null, 'coach', null from coach_links l
   where l.client_id = auth.uid() and l.status = 'active' and has_coach_access(l.coach_id, interval '14 days')
   limit 20;
$$;

-- Apply any grants for the signed-in person's email. Returns how many were applied.
create or replace function public.claim_grants()
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0; mail text;
begin
  select lower(email) into mail from auth.users where id = auth.uid();
  if mail is null then return 0; end if;
  with g as (
    update grants set claimed_by = auth.uid(), claimed_at = now()
     where lower(email) = mail and claimed_by is null and not revoked
     returning kind, plan, seats, months, note)
  insert into entitlements (user_id, kind, plan, seats, source, ends_at, note)
  select auth.uid(), g.kind, coalesce(nullif(g.plan, ''), g.kind), g.seats, 'grant',
         case when g.months is null then null else now() + make_interval(months => g.months) end, g.note
    from g;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ---------- coach tools need an active coach plan ----------
drop policy if exists links_coach_invite on public.coach_links;
create policy links_coach_invite on public.coach_links for insert
  with check (coach_id = auth.uid() and client_id is null and status = 'invited' and has_coach_access(auth.uid()));

create or replace function public.enforce_seats() returns trigger language plpgsql security definer set search_path = public as $$
declare used int; cap int;
begin
  cap := coach_seat_limit(new.coach_id);
  if cap <= 0 then raise exception 'No active coach plan'; end if;
  select count(*) into used from coach_links where coach_id = new.coach_id and status in ('invited', 'active');
  if used >= cap then raise exception 'All % client seats are in use', cap; end if;
  return new;
end; $$;

-- A coach whose plan has lapsed keeps reading access for 14 days, then loses it.
create or replace function public.coach_can_see(client uuid, category text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_links l
    where l.coach_id = auth.uid() and l.client_id = client and l.status = 'active'
      and coalesce((l.share ->> 'paused')::boolean, false) = false
      and coalesce((l.share ->> category)::boolean, false) = true
  ) and has_coach_access(auth.uid(), interval '14 days');
$$;
create or replace function public.is_active_coach_of(client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from coach_links l where l.coach_id = auth.uid() and l.client_id = client and l.status = 'active')
     and has_coach_access(auth.uid());
$$;
grant execute on function public.my_access() to authenticated;
grant execute on function public.claim_grants() to authenticated;

-- ---------- account deletion (required by both app stores) ----------
-- Deletes the signed-in user's account and, through cascades, every row they own.
create or replace function public.delete_my_account() returns void language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid();
$$;

-- ---------- indexes for coach dashboards ----------
create index on public.workouts (user_id, day desc);
create index on public.coach_links (coach_id) where status in ('invited', 'active');
create index on public.pain_reports (user_id, day desc);
create index on public.food_entries (user_id, day desc);
create index on public.coach_links (client_id) where status = 'active';

-- ---------- test checkout (migration 007) ----------
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;   -- no policies: read only through the functions below
insert into public.app_settings (key, value) values ('test_checkout', 'on') on conflict (key) do nothing;

create or replace function public.test_checkout_on()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'on' from app_settings where key = 'test_checkout'), false);
$$;

create or replace function public.start_test_coach_plan(p_plan text)
returns void language plpgsql security definer set search_path = public as $$
declare cap int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not test_checkout_on() then raise exception 'Test checkout is switched off'; end if;
  cap := case p_plan when 'starter' then 5 when 'growth' then 15 when 'pro' then 40 when 'studio' then 100 end;
  if cap is null then raise exception 'Unknown plan'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  update entitlements set ends_at = now()
   where user_id = auth.uid() and kind = 'coach' and note = 'test checkout' and (ends_at is null or ends_at > now());
  insert into entitlements (user_id, kind, plan, seats, source, ends_at, note)
  values (auth.uid(), 'coach', p_plan, cap, 'trial', now() + interval '14 days', 'test checkout');
end; $$;

revoke all on function public.test_checkout_on() from public;
revoke all on function public.start_test_coach_plan(text) from public;
grant execute on function public.test_checkout_on() to anon, authenticated;
grant execute on function public.start_test_coach_plan(text) to authenticated;

-- ---------- feedback (migration 008) ----------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('idea', 'problem', 'confusing', 'praise', 'other')),
  area text not null default '' check (char_length(area) <= 40),
  message text not null check (char_length(message) between 1 and 2000),
  rating int check (rating is null or rating between 1 and 5),
  contact text not null default '' check (char_length(contact) <= 200),
  app_version text not null default '' check (char_length(app_version) <= 20),
  platform text not null default '' check (char_length(platform) <= 20),
  status text not null default 'new' check (status in ('new', 'read', 'planned', 'done', 'wont'))
);
alter table public.feedback enable row level security;

-- Insert only. A signed-in sender's row carries their id (or none); nobody can read rows through the API.
drop policy if exists feedback_send on public.feedback;
create policy feedback_send on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
revoke all on public.feedback from anon, authenticated;
grant insert (kind, area, message, rating, contact, app_version, platform) on public.feedback to anon, authenticated;

-- Light flood protection: at most 20 notes a minute from everyone without an account, 10 an hour per account.
create or replace function public.feedback_limits() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null then
    if (select count(*) from feedback where user_id is null and created_at > now() - interval '1 minute') >= 20 then
      raise exception 'Too much feedback right now. Try again in a minute.';
    end if;
  elsif (select count(*) from feedback where user_id = new.user_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Thanks! You''ve sent a lot of notes in the last hour. Try again later.';
  end if;
  return new;
end; $$;
drop trigger if exists feedback_limits on public.feedback;
create trigger feedback_limits before insert on public.feedback for each row execute function public.feedback_limits();

-- ========== 009: admin console (admins table and admin_* functions) ==========
-- Movla migration 009: admin console (movla.app/admin.html).
-- Admins are listed in public.admins. Everything the console reads or changes goes through the
-- admin_* functions below, which refuse anyone not in that table. Nothing here is visible to other users.
--
-- After running this, make yourself an admin (use the email you sign in with):
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;   -- no policies: read only through is_admin()

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

create or replace function public.admin_guard() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
end; $$;

-- ---------- analytics ----------
-- Aggregate counts only, from data people already sync. "Active" = the app synced that day.
create or replace function public.admin_overview(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d int := least(greatest(coalesce(p_days, 30), 7), 180); since date := current_date - (d - 1); r jsonb;
begin
  perform admin_guard();
  with
  live as (select * from entitlements where starts_at <= now() and (ends_at is null or ends_at > now())),
  logs as (
    select user_id, day from workouts where day >= since
    union select user_id, day from food_day_totals where day >= since
    union select user_id, day from weights where day >= since),
  days as (select generate_series(since, current_date, interval '1 day')::date as day)
  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from auth.users),
      'new_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'new_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'active_1d', (select count(*) from profiles where synced_at > now() - interval '1 day'),
      'active_7d', (select count(*) from profiles where synced_at > now() - interval '7 days'),
      'active_30d', (select count(*) from profiles where synced_at > now() - interval '30 days'),
      'workouts_total', (select count(*) from workouts),
      'workouts_7d', (select count(*) from workouts where day > current_date - 7),
      'food_days_7d', (select count(*) from food_day_totals where day > current_date - 7 and kcal > 0),
      'coaches', (select count(distinct user_id) from live where kind = 'coach'),
      'coach_requests', (select count(*) from coach_profiles c where not exists (select 1 from live l where l.user_id = c.user_id and l.kind = 'coach')),
      'active_links', (select count(*) from coach_links where status = 'active'),
      'invites_open', (select count(*) from coach_links where status = 'invited'),
      'messages_7d', (select count(*) from messages where created_at > now() - interval '7 days'),
      'plus_paid', (select count(distinct user_id) from live where kind = 'plus' and source in ('store', 'web')),
      'plus_free', (select count(distinct user_id) from live where kind = 'plus' and source not in ('store', 'web')),
      'coached_clients', (select count(distinct client_id) from coach_links where status = 'active'),
      'grants_pending', (select count(*) from grants where claimed_by is null and not revoked),
      'feedback_new', (select count(*) from feedback where status = 'new'),
      'reports_open', (select count(*) from reports where status = 'open')),
    'retention', (
      select jsonb_build_object('cohort', count(*), 'active_7d', count(*) filter (where p.synced_at > now() - interval '7 days'))
        from auth.users u left join profiles p on p.id = u.id
       where u.created_at <= now() - interval '7 days' and u.created_at > now() - interval '37 days'),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'day', ds.day,
        'signups', (select count(*) from auth.users u where u.created_at::date = ds.day),
        'workouts', (select count(*) from workouts w where w.day = ds.day),
        'loggers', (select count(distinct l.user_id) from logs l where l.day = ds.day),
        'messages', (select count(*) from messages m where m.created_at::date = ds.day)) order by ds.day)
        from days ds),
    'feedback_kinds', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from feedback group by kind) k)
  ) into r;
  return r;
end; $$;

-- ---------- system ----------
create or replace function public.admin_system() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform admin_guard();
  select jsonb_build_object(
    'now', now(),
    'postgres', split_part(version(), ' on ', 1),
    'db_bytes', pg_database_size(current_database()),
    'settings', (select coalesce(jsonb_object_agg(key, value), '{}') from app_settings),
    'tables', (select jsonb_object_agg(t, n) from (
       select 'profiles' t, count(*) n from profiles union all select 'workouts', count(*) from workouts
       union all select 'food_entries', count(*) from food_entries union all select 'food_day_totals', count(*) from food_day_totals
       union all select 'weights', count(*) from weights union all select 'app_state', count(*) from app_state
       union all select 'coach_links', count(*) from coach_links union all select 'messages', count(*) from messages
       union all select 'assignments', count(*) from assignments union all select 'entitlements', count(*) from entitlements
       union all select 'feedback', count(*) from feedback union all select 'reports', count(*) from reports) x)
  ) into r;
  return r;
end; $$;

create or replace function public.admin_set_setting(p_key text, p_value text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  if p_key not in ('test_checkout') then raise exception 'Unknown setting'; end if;
  if p_value not in ('on', 'off') then raise exception 'Use on or off'; end if;
  insert into app_settings (key, value) values (p_key, p_value)
    on conflict (key) do update set value = excluded.value, updated_at = now();
end; $$;

-- ---------- people ----------
create or replace function public.admin_users(p_search text default '', p_limit int default 50)
returns table (id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, synced_at timestamptz,
               display_name text, workouts bigint, last_workout date, access jsonb, admin boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, p.synced_at, coalesce(p.display_name, ''),
         (select count(*) from workouts w where w.user_id = u.id), (select max(day) from workouts w where w.user_id = u.id),
         coalesce((select jsonb_agg(jsonb_build_object('kind', e.kind, 'plan', e.plan, 'seats', e.seats, 'source', e.source, 'ends_at', e.ends_at, 'note', e.note))
                     from entitlements e where e.user_id = u.id and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())), '[]'),
         exists (select 1 from admins a where a.user_id = u.id)
    from auth.users u left join profiles p on p.id = u.id
   where coalesce(p_search, '') = '' or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%'
   order by u.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
end; $$;

create or replace function public.admin_grant_access(p_user uuid, p_kind text, p_plan text default null, p_months int default null, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare cap int; pl text;
begin
  perform admin_guard();
  if p_kind not in ('plus', 'coach') then raise exception 'Kind must be plus or coach'; end if;
  pl := case when p_kind = 'plus' then 'plus' else coalesce(nullif(p_plan, ''), 'starter') end;
  cap := case pl when 'starter' then 5 when 'growth' then 15 when 'pro' then 40 when 'studio' then 100 else null end;
  if p_kind = 'coach' and cap is null then raise exception 'Unknown coach plan'; end if;
  insert into profiles (id) values (p_user) on conflict (id) do nothing;
  update entitlements set ends_at = now()
   where user_id = p_user and kind = p_kind and source = 'grant' and (ends_at is null or ends_at > now());
  insert into entitlements (user_id, kind, plan, seats, source, ends_at, note)
  values (p_user, p_kind, pl, cap, 'grant',
          case when p_months is null then null else now() + make_interval(months => p_months) end,
          coalesce(nullif(p_note, ''), 'admin console'));
end; $$;

create or replace function public.admin_end_access(p_user uuid, p_kind text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform admin_guard();
  update entitlements set ends_at = now()
   where user_id = p_user and kind = p_kind and source in ('grant', 'trial') and (ends_at is null or ends_at > now());
  get diagnostics n = row_count; return n;
end; $$;

create or replace function public.admin_coach_requests()
returns table (user_id uuid, email text, display_name text, business_name text, coaching_type text, specialties text[],
               certification text, cert_number text, client_count int, plan_wanted text, updated_at timestamptz, plan text, plan_source text, plan_ends timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
  select c.user_id, u.email::text, c.display_name, c.business_name, c.coaching_type, c.specialties, c.certification, c.cert_number,
         c.client_count, c.plan_wanted, c.updated_at, e.plan, e.source, e.ends_at
    from coach_profiles c join auth.users u on u.id = c.user_id
    left join lateral (select x.plan, x.source, x.ends_at from entitlements x where x.user_id = c.user_id and x.kind = 'coach'
                         and x.starts_at <= now() and (x.ends_at is null or x.ends_at > now()) order by x.seats desc nulls last limit 1) e on true
   order by (e.plan is null) desc, c.updated_at desc;
end; $$;

-- ---------- grants by email (people who haven't signed up yet) ----------
create or replace function public.admin_grants()
returns table (id uuid, email text, kind text, plan text, months int, note text, revoked boolean, claimed_at timestamptz, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select g.id, g.email, g.kind, g.plan, g.months, g.note, g.revoked, g.claimed_at, g.created_at from grants g order by g.created_at desc limit 200;
end; $$;

create or replace function public.admin_add_grant(p_email text, p_kind text, p_plan text default null, p_months int default null, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
declare pl text; cap int;
begin
  perform admin_guard();
  if p_email !~ '^\S+@\S+\.\S+$' then raise exception 'Enter a valid email'; end if;
  if p_kind not in ('plus', 'coach') then raise exception 'Kind must be plus or coach'; end if;
  pl := case when p_kind = 'plus' then 'plus' else coalesce(nullif(p_plan, ''), 'starter') end;
  cap := case pl when 'starter' then 5 when 'growth' then 15 when 'pro' then 40 when 'studio' then 100 else null end;
  insert into grants (email, kind, plan, seats, months, note) values (lower(trim(p_email)), p_kind, pl, cap, p_months, coalesce(p_note, ''));
end; $$;

create or replace function public.admin_revoke_grant(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update grants set revoked = true where id = p_id and claimed_by is null;
end; $$;

-- ---------- feedback and reports ----------
create or replace function public.admin_feedback(p_status text default '', p_kind text default '', p_limit int default 100)
returns table (id uuid, created_at timestamptz, kind text, area text, message text, rating int, contact text, app_version text, platform text, status text, email text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
  select f.id, f.created_at, f.kind, f.area, f.message, f.rating, f.contact, f.app_version, f.platform, f.status, u.email::text
    from feedback f left join auth.users u on u.id = f.user_id
   where (coalesce(p_status, '') = '' or f.status = p_status) and (coalesce(p_kind, '') = '' or f.kind = p_kind)
   order by f.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end; $$;

create or replace function public.admin_set_feedback(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update feedback set status = p_status where id = p_id;
end; $$;

create or replace function public.admin_reports(p_status text default 'open')
returns table (id uuid, created_at timestamptz, reason text, details text, reported_body text, status text, reporter text, reported_user text, link_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
  select r.id, r.created_at, r.reason, r.details, r.reported_body, r.status, ru.email::text,
         (select su.email::text from messages m join auth.users su on su.id = m.sender_id where m.id = r.message_id), r.link_id
    from reports r left join auth.users ru on ru.id = r.reporter_id
   where coalesce(p_status, '') = '' or r.status = p_status
   order by r.created_at desc limit 200;
end; $$;

create or replace function public.admin_set_report(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update reports set status = p_status where id = p_id;
end; $$;

-- End a coach link (for example after a report).
create or replace function public.admin_end_link(p_link uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update coach_links set status = 'ended' where id = p_link;
end; $$;

do $$ declare f text; begin
  foreach f in array array['is_admin()', 'admin_guard()', 'admin_overview(int)', 'admin_system()', 'admin_set_setting(text, text)',
    'admin_users(text, int)', 'admin_grant_access(uuid, text, text, int, text)', 'admin_end_access(uuid, text)', 'admin_coach_requests()',
    'admin_grants()', 'admin_add_grant(text, text, text, int, text)', 'admin_revoke_grant(uuid)', 'admin_feedback(text, text, int)',
    'admin_set_feedback(uuid, text)', 'admin_reports(text)', 'admin_set_report(uuid, text)', 'admin_end_link(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ========== 010: families and challenges ==========
-- Movla 010: families and challenges.
--
-- A group is either a family (track progress together, a shared weekly workout goal, cheers) or a challenge
-- (a competition with a start and end date, one metric chosen by the creator, and a leaderboard).
-- People join with an 8-character code. Each person uses their own account on their own phone.
--
-- Privacy: the group tables have row-level security on and NO policies, so nobody can read them directly.
-- Everything goes through the functions below, which check membership and return only derived numbers:
-- percent change in weight (pounds only if that person turns it on), body fat points, strength percent,
-- workout and logging counts, and workout names/lengths for the feed. Never body weight, food or anything else.
--
-- Run once in the Supabase SQL Editor after 009.

-- Body fat from smart scales (or typed in) syncs as a daily value, for the body-fat challenge.
alter table public.activity_days add column if not exists body_fat numeric(4, 1) check (body_fat is null or body_fat between 2 and 75);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('family', 'challenge')),
  name text not null check (char_length(name) between 1 and 40),
  code text not null unique,
  owner_id uuid references public.profiles (id) on delete set null,
  metric text check (metric in ('weight_loss', 'body_fat', 'strength', 'consistency')),
  starts_on date,
  ends_on date,
  weekly_goal int check (weekly_goal between 1 and 200),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind = 'family' or (metric is not null and starts_on is not null and ends_on is not null
         and ends_on > starts_on and ends_on - starts_on <= 366))
);
create table if not exists public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  show_lbs boolean not null default false,       -- show pounds changed instead of only percent
  share_weight boolean not null default true,    -- families: show my weight trend (as a percent)
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);
create table if not exists public.group_cheers (
  group_id uuid not null references public.groups (id) on delete cascade,
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  ref text not null check (char_length(ref) between 1 and 80),   -- 'w:<workout id>' or 'board'
  emoji text not null check (emoji in ('clap', 'strong', 'fire', 'party')),
  created_at timestamptz not null default now(),
  primary key (group_id, from_user, to_user, ref)
);
create index if not exists group_cheers_to on public.group_cheers (to_user, created_at);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_cheers enable row level security;

-- When someone leaves (or deletes their account), the oldest remaining member takes over; an empty group is removed.
create or replace function public.group_member_gone() returns trigger language plpgsql security definer set search_path = public as $$
declare nxt uuid;
begin
  if exists (select 1 from groups where id = old.group_id and (owner_id = old.user_id or owner_id is null)) then
    select user_id into nxt from group_members where group_id = old.group_id order by joined_at limit 1;
    if nxt is null then delete from groups where id = old.group_id;
    else update groups set owner_id = nxt where id = old.group_id; end if;
  end if;
  delete from group_cheers where group_id = old.group_id and (from_user = old.user_id or to_user = old.user_id);
  return null;
end; $$;
drop trigger if exists group_member_gone on public.group_members;
create trigger group_member_gone after delete on public.group_members for each row execute function public.group_member_gone();

create or replace function public.group_code() returns text language plpgsql as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := '';
    for i in 1..8 loop c := c || substr(a, 1 + floor(random() * length(a))::int, 1); end loop;
    exit when not exists (select 1 from groups where code = c);
  end loop;
  return c;
end; $$;

create or replace function public.is_group_member(p_group uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;
create or replace function public.group_owner_guard(p_group uuid) returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from groups where id = p_group and owner_id = auth.uid()) then
    raise exception 'Only the group''s creator can do that' using errcode = '42501';
  end if;
end; $$;
create or replace function public.group_my_name(p_name text) returns text language sql stable security definer set search_path = public as $$
  select left(coalesce(nullif(trim(p_name), ''), nullif(trim((select display_name from profiles where id = auth.uid())), ''), 'Me'), 30);
$$;

-- ---------- create, join, leave ----------
create or replace function public.group_create(p_kind text, p_name text, p_metric text default null, p_starts date default null,
  p_ends date default null, p_goal int default null, p_display text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 10 then raise exception 'You can be in up to 10 families and challenges'; end if;
  if p_kind = 'challenge' and (p_starts is null or p_starts < current_date - 7) then raise exception 'Pick a start date from this week onward'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  insert into groups (kind, name, code, owner_id, metric, starts_on, ends_on, weekly_goal)
  values (p_kind, trim(p_name), group_code(), auth.uid(),
          case when p_kind = 'challenge' then p_metric end, case when p_kind = 'challenge' then p_starts end,
          case when p_kind = 'challenge' then p_ends end, p_goal)
  returning * into g;
  insert into group_members (group_id, user_id, display_name) values (g.id, auth.uid(), group_my_name(p_display));
  return jsonb_build_object('id', g.id, 'code', g.code);
end; $$;

-- What someone sees before joining.
create or replace function public.group_preview(p_code text) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', g.id, 'kind', g.kind, 'name', g.name, 'metric', g.metric, 'starts_on', g.starts_on, 'ends_on', g.ends_on,
    'ended', g.ended_at is not null or (g.kind = 'challenge' and g.ends_on < current_date),
    'members', (select count(*) from group_members m where m.group_id = g.id),
    'owner', (select display_name from group_members m where m.group_id = g.id and m.user_id = g.owner_id),
    'joined', exists (select 1 from group_members m where m.group_id = g.id and m.user_id = auth.uid()))
  from groups g where g.code = upper(trim(p_code));
$$;

create or replace function public.group_join(p_code text, p_display text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into g from groups where code = upper(trim(p_code));
  if g.id is null then raise exception 'That code didn''t match a family or challenge'; end if;
  if exists (select 1 from group_members where group_id = g.id and user_id = auth.uid()) then return g.id; end if;
  if g.ended_at is not null or (g.kind = 'challenge' and g.ends_on < current_date) then raise exception 'That challenge has ended'; end if;
  if (select count(*) from group_members where group_id = g.id) >= 30 then raise exception 'That group is full (30 people)'; end if;
  if (select count(*) from group_members where user_id = auth.uid()) >= 10 then raise exception 'You can be in up to 10 families and challenges'; end if;
  insert into profiles (id) values (auth.uid()) on conflict (id) do nothing;
  insert into group_members (group_id, user_id, display_name) values (g.id, auth.uid(), group_my_name(p_display));
  return g.id;
end; $$;

create or replace function public.group_leave(p_group uuid) returns void language sql security definer set search_path = public as $$
  delete from group_members where group_id = p_group and user_id = auth.uid();
$$;

create or replace function public.group_prefs(p_group uuid, p_display text default null, p_show_lbs boolean default null, p_share_weight boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update group_members set
    display_name = case when nullif(trim(p_display), '') is null then display_name else left(trim(p_display), 30) end,
    show_lbs = coalesce(p_show_lbs, show_lbs), share_weight = coalesce(p_share_weight, share_weight)
  where group_id = p_group and user_id = auth.uid();
end; $$;

-- ---------- creator controls ----------
create or replace function public.group_update(p_group uuid, p_name text default null, p_goal int default null, p_ends date default null, p_clear_goal boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  perform group_owner_guard(p_group);
  select * into g from groups where id = p_group;
  if p_ends is not null and g.kind = 'challenge' and (p_ends <= g.starts_on or p_ends < current_date) then raise exception 'The end date has to be after the start and not in the past'; end if;
  update groups set name = coalesce(nullif(trim(p_name), ''), name),
    weekly_goal = case when p_clear_goal then null else coalesce(p_goal, weekly_goal) end,
    ends_on = case when g.kind = 'challenge' then coalesce(p_ends, ends_on) else ends_on end
  where id = p_group;
end; $$;
create or replace function public.group_end(p_group uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform group_owner_guard(p_group);
  update groups set ended_at = now(), ends_on = greatest(starts_on + 1, least(ends_on, current_date)) where id = p_group and kind = 'challenge' and ended_at is null;
end; $$;
create or replace function public.group_remove(p_group uuid, p_user uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform group_owner_guard(p_group);
  if p_user = auth.uid() then raise exception 'Use Leave to remove yourself'; end if;
  delete from group_members where group_id = p_group and user_id = p_user;
end; $$;
create or replace function public.group_new_code(p_group uuid) returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  perform group_owner_guard(p_group);
  c := group_code(); update groups set code = c where id = p_group; return c;
end; $$;
create or replace function public.group_delete(p_group uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  perform group_owner_guard(p_group);
  delete from groups where id = p_group;
end; $$;

-- ---------- cheers (fixed reactions only, no free text) ----------
create or replace function public.group_cheer(p_group uuid, p_to uuid, p_ref text, p_emoji text default 'clap') returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_member(p_group) then raise exception 'Not in this group' using errcode = '42501'; end if;
  if p_to = auth.uid() then raise exception 'Cheer someone else'; end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = p_to) then raise exception 'They''re not in this group'; end if;
  if exists (select 1 from group_cheers where group_id = p_group and from_user = auth.uid() and to_user = p_to and ref = p_ref) then
    delete from group_cheers where group_id = p_group and from_user = auth.uid() and to_user = p_to and ref = p_ref;
    return false;
  end if;
  if (select count(*) from group_cheers where from_user = auth.uid() and created_at > now() - interval '1 day') >= 300 then raise exception 'That''s a lot of cheering for one day'; end if;
  insert into group_cheers (group_id, from_user, to_user, ref, emoji) values (p_group, auth.uid(), p_to, p_ref, p_emoji);
  return true;
end; $$;

-- ---------- scoring ----------
-- One member's score for a challenge. value: higher is better (null = not enough data yet).
create or replace function public.group_score(p_user uuid, p_metric text, p_start date, p_end date, p_show_lbs boolean)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  e date := least(p_end, current_date);
  b numeric; bd date; c numeric; v numeric; n int; w int; f int;
begin
  if e < p_start then return jsonb_build_object('value', null, 'note', 'Starts ' || to_char(p_start, 'Mon FMDD')); end if;
  if p_metric = 'weight_loss' then
    select kg, day into b, bd from weights where user_id = p_user and day between p_start - 7 and p_start + 3 order by abs(day - p_start), day limit 1;
    if b is null then select kg, day into b, bd from weights where user_id = p_user and day between p_start and e order by day limit 1; end if;
    if b is null then return jsonb_build_object('value', null, 'note', 'Needs a starting weigh-in'); end if;
    select kg into c from weights where user_id = p_user and day > bd and day between p_start and e order by day desc limit 1;
    if c is null then return jsonb_build_object('value', null, 'note', 'Waiting for the next weigh-in'); end if;
    v := round((b - c) / b * 100, 1);
    return jsonb_build_object('value', v, 'pct', v, 'lbs', case when p_show_lbs then round((b - c) * 2.20462, 1) end);
  elsif p_metric = 'body_fat' then
    select body_fat, day into b, bd from activity_days where user_id = p_user and body_fat is not null and day between p_start - 7 and p_start + 3 order by abs(day - p_start), day limit 1;
    if b is null then select body_fat, day into b, bd from activity_days where user_id = p_user and body_fat is not null and day between p_start and e order by day limit 1; end if;
    if b is null then return jsonb_build_object('value', null, 'note', 'Needs a starting body fat reading'); end if;
    select body_fat into c from activity_days where user_id = p_user and body_fat is not null and day > bd and day between p_start and e order by day desc limit 1;
    if c is null then return jsonb_build_object('value', null, 'note', 'Waiting for the next reading'); end if;
    v := round(b - c, 1);
    return jsonb_build_object('value', v, 'points', v);
  elsif p_metric = 'strength' then
    -- Best estimated one-rep max per exercise: before/early in the challenge vs. from the second week on.
    if e < p_start + 7 then return jsonb_build_object('value', null, 'note', 'Scores from ' || to_char(p_start + 7, 'Mon FMDD') || ', after a week of lifting'); end if;
    with s as (
      select x->>0 ex, wk.day, (x->>1)::numeric * (1 + (x->>2)::numeric / 30) e1
      from workouts wk, jsonb_array_elements(wk.sets) x
      where wk.user_id = p_user and wk.day between p_start - 28 and e and jsonb_typeof(x) = 'array'
        and coalesce(x->>4, '') not in ('warmup', 'warm-up', 'w')
        and (x->>1) ~ '^[0-9.]+$' and (x->>2) ~ '^[0-9]+$' and (x->>1)::numeric > 0 and (x->>2)::int between 1 and 12
    ), base as (select ex, max(e1) m from s where day <= p_start + 6 group by ex),
       cur as (select ex, max(e1) m from s where day >= p_start + 7 group by ex)
    select round(avg((cur.m - base.m) / base.m * 100), 1), count(*) into v, n from base join cur using (ex);
    if coalesce(n, 0) = 0 then return jsonb_build_object('value', null, 'note', 'Log the same lifts at the start and later on'); end if;
    return jsonb_build_object('value', v, 'pct', v, 'lifts', n);
  else -- consistency: 2 points per workout day, 1 per day with food logged
    select count(distinct day) into w from workouts where user_id = p_user and day between p_start and e;
    select count(*) into f from food_day_totals where user_id = p_user and day between p_start and e;
    return jsonb_build_object('value', 2 * w + f, 'workouts', w, 'food_days', f);
  end if;
end; $$;

-- My groups, for the Together card.
create or replace function public.my_groups() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id, 'kind', g.kind, 'name', g.name, 'code', g.code, 'metric', g.metric, 'starts_on', g.starts_on, 'ends_on', g.ends_on,
    'ended', g.ended_at is not null or (g.kind = 'challenge' and g.ends_on < current_date),
    'is_owner', g.owner_id = auth.uid(),
    'members', (select count(*) from group_members m where m.group_id = g.id),
    'new_cheers', (select count(*) from group_cheers c where c.group_id = g.id and c.to_user = auth.uid() and c.created_at > now() - interval '3 days')
  ) order by g.kind = 'challenge', g.created_at), '[]'::jsonb)
  from groups g join group_members me on me.group_id = g.id and me.user_id = auth.uid();
$$;

-- Everything one group screen shows.
create or replace function public.group_detail(p_group uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g groups; r jsonb; wk date := date_trunc('week', current_date)::date;
begin
  if not is_group_member(p_group) then raise exception 'Not in this group' using errcode = '42501'; end if;
  select * into g from groups where id = p_group;
  with m as (
    select gm.*, (gm.user_id = auth.uid()) as is_me, (gm.user_id = g.owner_id) as is_owner from group_members gm where gm.group_id = p_group
  ), act as (   -- days with any logging, last 60 days
    select user_id, day from workouts where user_id in (select user_id from m) and day > current_date - 60
    union select user_id, day from food_day_totals where user_id in (select user_id from m) and day > current_date - 60
    union select user_id, day from weights where user_id in (select user_id from m) and day > current_date - 60
  ), stats as (
    select m.user_id,
      (select count(*) from workouts w where w.user_id = m.user_id and w.day >= wk) workouts_week,
      (select count(*) from act a where a.user_id = m.user_id and a.day > current_date - 7) active_7,
      (select coalesce(max(n), 0) from (
         select count(*) n from (select day, day - (row_number() over (order by day))::int grp from act a where a.user_id = m.user_id) x
         group by grp having max(day) >= current_date - 1) y) streak,
      (select max(day) from act a where a.user_id = m.user_id) last_active
    from m
  ), trend as (   -- families: weight change over the last 30 days, as a percent
    select m.user_id,
      (select kg from weights w where w.user_id = m.user_id and w.day > current_date - 31 order by day limit 1) w0,
      (select day from weights w where w.user_id = m.user_id and w.day > current_date - 31 order by day limit 1) d0,
      (select kg from weights w where w.user_id = m.user_id and w.day > current_date - 31 order by day desc limit 1) w1,
      (select day from weights w where w.user_id = m.user_id and w.day > current_date - 31 order by day desc limit 1) d1
    from m where g.kind = 'family' and m.share_weight
  ), scored as (
    select m.user_id, case when g.kind = 'challenge' then group_score(m.user_id, g.metric, g.starts_on, g.ends_on, m.show_lbs) end sc from m
  ), ranked as (
    select user_id, sc, case when (sc->>'value') is not null then rank() over (order by (sc->>'value')::numeric desc nulls last) end rnk from scored
  )
  select jsonb_build_object(
    'group', jsonb_build_object('id', g.id, 'kind', g.kind, 'name', g.name, 'code', g.code, 'metric', g.metric,
      'starts_on', g.starts_on, 'ends_on', g.ends_on, 'weekly_goal', g.weekly_goal,
      'ended', g.ended_at is not null or (g.kind = 'challenge' and g.ends_on < current_date),
      'is_owner', g.owner_id = auth.uid(), 'today', current_date, 'week_start', wk,
      'team_week', (select count(*) from workouts w where w.user_id in (select user_id from m) and w.day >= wk)),
    'members', (select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'name', m.display_name, 'is_me', m.is_me, 'is_owner', m.is_owner, 'show_lbs', m.show_lbs, 'share_weight', m.share_weight,
        'workouts_week', s.workouts_week, 'active_7', s.active_7, 'streak', s.streak, 'last_active', s.last_active,
        'trend_pct', case when t.w0 is not null and t.d1 - t.d0 >= 7 then round((t.w1 - t.w0) / t.w0 * 100, 1) end,
        'trend_lbs', case when t.w0 is not null and t.d1 - t.d0 >= 7 and m.show_lbs then round((t.w1 - t.w0) * 2.20462, 1) end,
        'score', rk.sc, 'rank', rk.rnk,
        'cheers', (select count(*) from group_cheers c where c.group_id = p_group and c.to_user = m.user_id and c.ref = 'board'),
        'cheered', exists (select 1 from group_cheers c where c.group_id = p_group and c.to_user = m.user_id and c.ref = 'board' and c.from_user = auth.uid()))
        order by rk.rnk nulls last, s.workouts_week desc, m.joined_at)
      from m join stats s using (user_id) left join trend t using (user_id) left join ranked rk using (user_id)),
    'feed', (select coalesce(jsonb_agg(f order by f->>'day' desc, f->>'name'), '[]'::jsonb) from (
        select jsonb_build_object('ref', 'w:' || w.id, 'user_id', w.user_id, 'who', m.display_name, 'is_me', m.is_me, 'day', w.day,
          'name', w.name, 'minutes', w.duration_min, 'prs', w.prs,
          'cheers', (select count(*) from group_cheers c where c.group_id = p_group and c.ref = 'w:' || w.id and c.to_user = w.user_id),
          'cheered', exists (select 1 from group_cheers c where c.group_id = p_group and c.ref = 'w:' || w.id and c.to_user = w.user_id and c.from_user = auth.uid())) f
        from workouts w join m on m.user_id = w.user_id
        where w.day > current_date - 14 and w.day >= (m.joined_at at time zone 'utc')::date - 7
        order by w.day desc limit 40) x)
  ) into r;
  return r;
end; $$;

-- Only signed-in people can call these; each one checks membership itself.
do $$
declare f text;
begin
  foreach f in array array['group_member_gone()', 'group_code()', 'group_owner_guard(uuid)', 'group_my_name(text)',
    'group_score(uuid, text, date, date, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array['is_group_member(uuid)', 'group_create(text, text, text, date, date, int, text)', 'group_preview(text)',
    'group_join(text, text)', 'group_leave(uuid)', 'group_prefs(uuid, text, boolean, boolean)', 'group_update(uuid, text, int, date, boolean)',
    'group_end(uuid)', 'group_remove(uuid, uuid)', 'group_new_code(uuid)', 'group_delete(uuid)', 'group_cheer(uuid, uuid, text, text)',
    'my_groups()', 'group_detail(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ========== 011: App Store / Google Play subscriptions (RevenueCat) ==========
-- Movla 011: App Store / Google Play subscriptions through RevenueCat.
--
-- RevenueCat tells our server (Edge Function `revenuecat`) whenever someone buys, renews, cancels or their
-- subscription ends. The function asks RevenueCat for that person's current state and calls
-- apply_store_entitlements(), which replaces their 'store' plans with exactly what's active now.
-- Plans from grants, trials and test checkout are never touched.
-- Only the server (service role) can call these; the app reads plans through my_access() as before.
--
-- Run once in the Supabase SQL Editor after 010.

create table if not exists public.billing_events (
  id text primary key,                         -- RevenueCat event id, or 'sync:<uuid>' for app-triggered syncs
  user_id uuid references public.profiles (id) on delete set null,
  type text not null,
  product text,
  store text,
  environment text,
  received_at timestamptz not null default now(),
  detail jsonb not null default '{}'
);
create index if not exists billing_events_user on public.billing_events (user_id, received_at desc);
alter table public.billing_events enable row level security;   -- no policies: server only

-- p_rows: [{ kind: 'plus'|'coach', plan, seats, ends_at, note }] — everything active for this person in the stores.
create or replace function public.apply_store_entitlements(p_user uuid, p_rows jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not exists (select 1 from auth.users where id = p_user) then return -1; end if;
  insert into profiles (id) values (p_user) on conflict (id) do nothing;
  -- End store plans that are no longer active (kept for history), then write the current ones.
  update entitlements set ends_at = now()
   where user_id = p_user and source = 'store' and (ends_at is null or ends_at > now());
  insert into entitlements (user_id, kind, plan, seats, source, starts_at, ends_at, note)
  select p_user, r->>'kind', coalesce(r->>'plan', r->>'kind'), nullif(r->>'seats', '')::int, 'store', now(),
         nullif(r->>'ends_at', '')::timestamptz, coalesce(r->>'note', '')
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   where r->>'kind' in ('plus', 'coach') and (nullif(r->>'ends_at', '') is null or (r->>'ends_at')::timestamptz > now());
  get diagnostics n = row_count;
  -- A paid coach plan replaces an early-access test plan.
  if exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r where r->>'kind' = 'coach') then
    update entitlements set ends_at = now()
     where user_id = p_user and kind = 'coach' and source = 'trial' and note = 'test checkout' and (ends_at is null or ends_at > now());
  end if;
  return n;
end; $$;

create or replace function public.log_billing_event(p_id text, p_user uuid, p_type text, p_product text, p_store text, p_env text, p_detail jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into billing_events (id, user_id, type, product, store, environment, detail)
  values (p_id, case when exists (select 1 from profiles where id = p_user) then p_user end, p_type, p_product, p_store, p_env, coalesce(p_detail, '{}'));
  return true;
exception when unique_violation then
  return false;   -- already handled (RevenueCat retries)
end; $$;

revoke all on function public.apply_store_entitlements(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.log_billing_event(text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.apply_store_entitlements(uuid, jsonb) to service_role;
grant execute on function public.log_billing_event(text, uuid, text, text, text, text, jsonb) to service_role;
grant select, insert on public.billing_events to service_role;

-- Admin console: recent billing activity.
create or replace function public.admin_billing(p_limit int default 50) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  perform admin_guard();
  select jsonb_build_object(
    'events', (select coalesce(jsonb_agg(x order by x.received_at desc), '[]') from (
        select b.received_at, b.type, b.product, b.store, b.environment, u.email
          from billing_events b left join auth.users u on u.id = b.user_id
         order by b.received_at desc limit least(greatest(p_limit, 1), 200)) x),
    'active', (select jsonb_build_object(
        'plus', count(*) filter (where kind = 'plus'),
        'coach', count(*) filter (where kind = 'coach'))
      from entitlements where source = 'store' and (ends_at is null or ends_at > now()))
  ) into r;
  return r;
end; $$;
revoke all on function public.admin_billing(int) from public, anon;
grant execute on function public.admin_billing(int) to authenticated;

-- ========== 012: activity for family and challenge notifications ==========
-- Movla 012: activity for notifications in families and challenges.
-- my_group_activity(since) lists what happened to the signed-in person since a time: cheers they received
-- (who, which group, which workout) and people who joined their groups. Leaderboard moves, team goals and
-- challenge dates are worked out in the app from group_detail(). Same privacy rules as 010: names and
-- workout names only, and only for groups the person is in.
-- Run once in the Supabase SQL Editor after 011.

create or replace function public.my_group_activity(p_since timestamptz default now() - interval '2 days')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(e order by e->>'at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'kind', 'cheer', 'at', c.created_at, 'group_id', g.id, 'group', g.name, 'group_kind', g.kind,
      'who', coalesce(fm.display_name, 'Someone'), 'emoji', c.emoji, 'ref', c.ref,
      'workout', case when c.ref like 'w:%' then (select w.name from workouts w where w.user_id = c.to_user and w.id = substr(c.ref, 3)) end) e
    from group_cheers c
    join groups g on g.id = c.group_id
    join group_members me on me.group_id = c.group_id and me.user_id = auth.uid()
    left join group_members fm on fm.group_id = c.group_id and fm.user_id = c.from_user
    where c.to_user = auth.uid() and c.created_at > greatest(p_since, now() - interval '14 days')
    union all
    select jsonb_build_object('kind', 'joined', 'at', m.joined_at, 'group_id', g.id, 'group', g.name, 'group_kind', g.kind, 'who', m.display_name)
    from group_members m
    join groups g on g.id = m.group_id
    join group_members me on me.group_id = m.group_id and me.user_id = auth.uid()
    where m.user_id <> auth.uid() and m.joined_at > greatest(p_since, me.joined_at, now() - interval '14 days')
    order by 1 desc
    limit 60
  ) x;
$$;
revoke all on function public.my_group_activity(timestamptz) from public, anon;
grant execute on function public.my_group_activity(timestamptz) to authenticated;
