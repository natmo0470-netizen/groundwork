-- Groundwork admin snippets. Run in the Supabase SQL Editor. Replace the email addresses.

-- Give a friend free Plus forever:
insert into public.grants (email, kind, plan, note) values ('friend@example.com', 'plus', 'plus', 'friends and family');

-- Give a trainer a free coach plan (100 clients) for 6 months:
insert into public.grants (email, kind, plan, seats, months, note) values ('trainer@example.com', 'coach', 'studio', 100, 6, 'early coach');

-- Give yourself (or the app reviewers' coach account) a coach plan forever:
insert into public.grants (email, kind, plan, seats, note) values ('you@example.com', 'coach', 'studio', 100, 'owner');
-- Grants apply the next time that person opens the app signed in (or right away when they sign up).

-- See all grants and whether they've been used:
select email, kind, plan, seats, months, claimed_at, revoked, note from public.grants order by created_at desc;

-- Cancel a grant that hasn't been used yet:
update public.grants set revoked = true where email = 'friend@example.com' and claimed_by is null;

-- End someone's free plan now (it disappears from their app on the next sync):
update public.entitlements set ends_at = now()
 where source = 'grant' and user_id = (select id from auth.users where email = 'friend@example.com');

-- Everyone with an active plan:
select u.email, e.kind, e.plan, e.seats, e.source, e.ends_at
  from public.entitlements e join auth.users u on u.id = e.user_id
 where e.starts_at <= now() and (e.ends_at is null or e.ends_at > now()) order by u.email;

-- Open reports, newest first:
select r.created_at, r.reason, r.reported_body, r.details, u.email as reporter
  from public.reports r left join auth.users u on u.id = r.reporter_id
 where r.status = 'open' order by r.created_at desc;
