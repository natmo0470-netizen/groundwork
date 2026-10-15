\set ON_ERROR_STOP 0
-- users: coach C, client A, other user X
insert into auth.users values ('00000000-0000-0000-0000-0000000000c0'), ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000f9');
insert into profiles (id, display_name, is_coach) values ('00000000-0000-0000-0000-0000000000c0', 'Coach Dana', true), ('00000000-0000-0000-0000-0000000000a1', 'Riley', false), ('00000000-0000-0000-0000-0000000000f9', 'Stranger', false);
insert into entitlements (user_id, kind, plan, seats, source) values ('00000000-0000-0000-0000-0000000000c0', 'coach', 'starter', 2, 'grant');
set role authenticated;
-- client writes their own data
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
insert into workouts (id, day, name, sets) values ('w1', '2026-10-12', 'Upper A', '[["bb_bench",80,8]]');
insert into food_day_totals (day, kcal, protein) values ('2026-10-12', 2100, 150);
insert into weights (day, kg) values ('2026-10-12', 82.5);
insert into activity_days (day, steps) values ('2026-10-12', 9000);
insert into pain_reports (id, day, area, kind) values ('p1', '2026-10-12', 'Knee', 'sharp');
-- coach invites (seat 1 of 2)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
insert into coach_links (coach_id, client_label, invite_code) values ('00000000-0000-0000-0000-0000000000c0', 'Riley', 'CODE1');
select 'T1 coach sees nothing before accept' as t, (select count(*) from workouts) as workouts;
-- client accepts with nutrition + body hidden
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select 'T2 accept' as t, accept_invite('CODE1', '{"workouts":true,"nutrition":false,"body":false,"activity":false,"wellbeing":true,"paused":false}') is not null as ok;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
select 'T3 coach view' as t, (select count(*) from workouts) w, (select count(*) from food_day_totals) food, (select count(*) from food_entries) entries, (select count(*) from weights) weights, (select count(*) from activity_days) act, (select count(*) from pain_reports) pain;
-- coach can always assign; cannot write client data
insert into assignments (link_id, client_id, payload) select id, client_id, '{"program":"phul"}' from coach_links where client_label = 'Riley';
select 'T4 assignment sent' as t, count(*) from assignments;
update weights set kg = 1 where true;
select 'T5 coach cannot see/change weights' as t, count(*) from weights;
-- client turns nutrition on, then pauses all
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
update coach_links set share = share || '{"nutrition": true}' where client_id = auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
select 'T6 after nutrition on' as t, (select count(*) from food_day_totals) food, (select count(*) from food_entries) entries;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
update coach_links set share = share || '{"paused": true}' where client_id = auth.uid();
select 'T7 client sees assignment' as t, count(*) from assignments;
update assignments set status = 'accepted' where client_id = auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
select 'T8 paused' as t, (select count(*) from workouts) w, (select count(*) from food_day_totals) food, (select count(*) from pain_reports) pain, (select status from assignments limit 1) assignment_status;
-- stranger sees nothing, cannot accept a used code, cannot assign
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f9';
select 'T9 stranger' as t, (select count(*) from workouts) w, (select count(*) from coach_links) links, (select count(*) from profiles) profiles;
select accept_invite('CODE1', null);
-- client cannot hijack: set themselves as coach on a link / change coach_id
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
update coach_links set coach_id = '00000000-0000-0000-0000-0000000000a1' where client_id = auth.uid();
select 'T10 coach_id unchanged' as t, coach_id = '00000000-0000-0000-0000-0000000000c0' as ok from coach_links;
-- seat limit: coach has 2 seats; one active + 1 more invite ok, third fails
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
insert into coach_links (coach_id, client_label, invite_code) values ('00000000-0000-0000-0000-0000000000c0', 'Sam', 'CODE2');
insert into coach_links (coach_id, client_label, invite_code) values ('00000000-0000-0000-0000-0000000000c0', 'Kim', 'CODE3');
select 'T11 seats used' as t, count(*) from coach_links where status in ('invited','active');
-- client leaves: coach loses access
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
update coach_links set share = share || '{"paused": false}', status = 'ended' where client_id = auth.uid();
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
select 'T12 after client left' as t, (select count(*) from workouts) w;
insert into assignments (link_id, client_id, payload) select id, '00000000-0000-0000-0000-0000000000a1', '{}' from coach_links where client_label = 'Riley';
-- coach tries to turn sharing on for an active client (new link for Sam via accept)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f9';
select 'T13 Sam accepts' as t, accept_invite('CODE2', '{"workouts":false,"nutrition":false,"body":false,"activity":false,"wellbeing":false,"paused":false}') is not null as ok;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c0';
update coach_links set share = '{"workouts":true,"nutrition":true,"body":true,"activity":true,"wellbeing":true,"paused":false}' where client_label = 'Sam';
select 'T14 share still client-set' as t, share->>'workouts' as workouts from coach_links where client_label = 'Sam';
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f9';
update coach_links set status = 'active' where client_label = 'Sam' and false;

-- ---------- plans and access (migration 006) ----------
reset role;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d2', 'friend@example.com'), ('00000000-0000-0000-0000-0000000000e3', 'nocoach@example.com');
insert into profiles (id, display_name) values ('00000000-0000-0000-0000-0000000000d2', 'Friend'), ('00000000-0000-0000-0000-0000000000e3', 'Wannabe');
insert into grants (email, kind, plan, seats, months, note) values ('FRIEND@example.com', 'coach', 'pro', 40, 6, 'test'), ('friend@example.com', 'plus', 'plus', null, null, 'test');
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
insert into coach_links (coach_id, client_label) values ('00000000-0000-0000-0000-0000000000e3', 'X');
select 'T15 no plan, no invites' as t, (select count(*) from coach_links where coach_id = '00000000-0000-0000-0000-0000000000e3') as links;
insert into entitlements (user_id, kind, plan, seats, source) values ('00000000-0000-0000-0000-0000000000e3', 'coach', 'studio', 100, 'grant');
select 'T16 users cannot give themselves plans' as t, (select count(*) from entitlements) as visible;
select 'T17 grants table is private' as t, (select count(*) from grants) as visible;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select 'T18 claim grants (case-insensitive email)' as t, claim_grants() as claimed;
select 'T18b claim again does nothing' as t, claim_grants() as again, (select string_agg(kind || ':' || plan || ':' || coalesce(seats::text, '-'), ',' order by kind) from my_access()) as access;
select 'T19 granted coach can invite' as t, (select count(*) from coach_links where coach_id = '00000000-0000-0000-0000-0000000000d2') as before_invite;
insert into coach_links (coach_id, client_label, invite_code) values ('00000000-0000-0000-0000-0000000000d2', 'Pal', 'CODEF');
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select 'T20 client joins' as t, accept_invite('CODEF', null) is not null as ok;
select 'T20b client gets free Plus' as t, (select string_agg(kind || ':' || plan, ',') from my_access()) as client_access;
reset role;
update entitlements set ends_at = now() - interval '20 days' where user_id = '00000000-0000-0000-0000-0000000000d2' and kind = 'coach';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
select 'T21 lapsed coach: client loses free Plus' as t, (select count(*) from my_access()) as access;
