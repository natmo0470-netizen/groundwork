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
