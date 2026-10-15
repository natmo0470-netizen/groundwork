-- 006: plans and access. Coach tools unlock only with an active coach plan (bought, or granted by you);
-- friends-and-family plans are granted by email and applied when that person signs in.
-- Safe to run more than once.

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
