-- Movla 012: activity for notifications in families and challenges.
-- my_group_activity(since) lists what happened to the signed-in person since a time: cheers they received
-- (who, which group, which workout) and people who joined their groups. Leaderboard moves, team goals and
-- challenge dates are worked out in the app from group_detail(). Same privacy rules as 010: names and
-- workout names only, and only for groups the person is in.
-- Run once in the Supabase SQL Editor after 011.

create or replace function public.my_group_activity(p_since timestamptz default now() - interval '2 days')
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(e order by e->>'at' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'kind', 'cheer', 'at', c.created_at, 'group_id', g.id, 'group', g.name, 'group_kind', g.kind,
      'who', coalesce(fm.display_name, 'Someone'), 'emoji', c.emoji, 'ref', c.ref,
      'workout', case when c.ref like 'w:%' then (select w.name from workouts w where w.user_id = c.to_user and w.id = substr(c.ref, 3)) end) e
    from group_cheers c
    join groups g on g.id = c.group_id
    join group_members me on me.group_id = c.group_id and me.user_id = auth.uid()
    left join group_members fm on fm.group_id = c.group_id and fm.user_id = c.from_user
    where c.to_user = auth.uid() and c.created_at > greatest(p_since, now() - interval '14 days')
    union all
    select jsonb_build_object('kind', 'joined', 'at', m.joined_at, 'group_id', g.id, 'group', g.name, 'group_kind', g.kind, 'who', m.display_name)
    from group_members m
    join groups g on g.id = m.group_id
    join group_members me on me.group_id = m.group_id and me.user_id = auth.uid()
    where m.user_id <> auth.uid() and m.joined_at > greatest(p_since, me.joined_at, now() - interval '14 days')
    order by 1 desc
    limit 60
  ) x;
$$;
revoke all on function public.my_group_activity(timestamptz) from public, anon;
grant execute on function public.my_group_activity(timestamptz) to authenticated;
