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
