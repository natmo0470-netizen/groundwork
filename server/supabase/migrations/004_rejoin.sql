-- 004: let a client rejoin a coach they were linked to before.
-- The old rule allowed one coach_links row per coach + client forever, so after a coach removed a client
-- (or the client left), a new invite failed with "duplicate key ... coach_links_coach_id_client_id_key".
-- Now only one ACTIVE link per coach + client is allowed; ended links stay as history. Safe to run more than once.
do $$ declare c text; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.coach_links'::regclass and contype = 'u' and conname <> 'coach_links_invite_code_key'
  loop execute format('alter table public.coach_links drop constraint %I', c); end loop;
end $$;
create unique index if not exists coach_links_one_active on public.coach_links (coach_id, client_id) where status = 'active';

-- Clearer errors when joining.
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
