-- Movla migration 008: in-app feedback and feature requests.
-- Anyone using the app (signed in or not) can send feedback; nobody can read it back through the app.
-- Read it in the SQL Editor (queries at the bottom of admin.sql).

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
