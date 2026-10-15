-- 005: store-readiness and privacy hardening. Safe to run more than once.
-- 1) Reports: either side of a coaching link can report a message or the other person (app store rules for user content).
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
