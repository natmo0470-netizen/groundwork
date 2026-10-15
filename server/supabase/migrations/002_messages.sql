-- 002: coach <-> client messages. Safe to run more than once.
-- Run in the Supabase SQL Editor (already included in schema.sql for new projects).
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
