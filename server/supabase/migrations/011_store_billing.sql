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
