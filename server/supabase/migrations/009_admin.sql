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
