-- Groundwork migration 007: test checkout.
-- While payments aren't set up, anyone signed in can start a free 14-day test coach plan from the
-- app's "Become a coach" flow (and switch plans), so the whole coach workflow can be tried.
-- Turn it OFF before launch:
--   update public.app_settings set value = 'off' where key = 'test_checkout';
-- and end every test plan:
--   update public.entitlements set ends_at = now() where note = 'test checkout' and (ends_at is null or ends_at > now());

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
