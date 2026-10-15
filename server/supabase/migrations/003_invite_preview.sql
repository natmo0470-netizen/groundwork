-- 003: invite links. Lets someone who opens an invite link see who invited them before they have an account.
-- Returns nothing unless the code is a real, unused invite. Safe to run more than once.
create or replace function public.invite_preview(code text)
returns table (coach_name text, client_label text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.display_name, ''), 'Your coach'), l.client_label
  from coach_links l join profiles p on p.id = l.coach_id
  where l.invite_code = upper(invite_preview.code) and l.status = 'invited' and l.client_id is null;
$$;
grant execute on function public.invite_preview(text) to anon, authenticated;
