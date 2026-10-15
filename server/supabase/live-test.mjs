// Live check of the Supabase project: the same REST calls the app makes, with two throwaway accounts
// (a coach and a client) that are deleted at the end. Run: node server/supabase/live-test.mjs
import fs from 'node:fs';
const cfgText = fs.readFileSync(new URL('../../js/cloud-config.js', import.meta.url), 'utf8');
const URL_ = cfgText.match(/url:\s*'([^']+)'/)[1], KEY = cfgText.match(/anonKey:\s*'([^']+)'/)[1];
const results = []; let failed = 0;
const check = (name, ok, extra) => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || extra === undefined ? '' : '  → ' + JSON.stringify(extra)}`); if (!ok) failed++; };
async function call(path, { method = 'GET', token, body, prefer } = {}) {
  const h = { apikey: KEY, 'content-type': 'application/json' };
  if (token) h.authorization = 'Bearer ' + token;
  if (prefer) h.prefer = prefer;
  const r = await fetch(URL_ + path, { method, headers: h, body: body == null ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
  return { status: r.status, ok: r.ok, j };
}
const tag = Date.now().toString(36);
const coachEmail = `gw-live-${tag}-coach@example.com`;
async function signup(role) {
  for (const dom of ['example.com', 'groundworktest.dev', 'mailinator.com']) {
    const email = `gw-live-${tag}-${role}@${dom}`;
    const r = await call('/auth/v1/signup', { method: 'POST', body: { email, password: 'Live-test-' + tag } });
    if (r.ok && r.j && r.j.access_token) return { email, token: r.j.access_token, id: r.j.user.id };
    if (r.ok && !(r.j && r.j.access_token)) throw new Error('Signup returned no session: "Confirm email" is still on (Authentication → Sign In / Providers → Email).');
    if (!/invalid/i.test(JSON.stringify(r.j))) throw new Error('Signup failed: ' + JSON.stringify(r.j));
  }
  throw new Error('Signup rejected every test email domain');
}
const users = [];
// Coach tools need a coach plan (migration 006). The test grants one to its throwaway coach with the project's
// secret key, passed in from the SUPABASE_SECRET_KEY GitHub secret; it never appears in logs.
const SECRET = process.env.SUPABASE_SECRET_KEY || '';
async function admin(path, method, body) {
  const r = await fetch(URL_ + path, { method, headers: { apikey: SECRET, authorization: SECRET.startsWith('eyJ') ? 'Bearer ' + SECRET : undefined, 'content-type': 'application/json', prefer: 'return=minimal' }, body: body == null ? undefined : JSON.stringify(body) });
  return r.ok;
}
try {
  const settings = await call('/auth/v1/settings');
  check('project reachable with publishable key', settings.ok, settings.status);
  check('email sign-in enabled', settings.j && settings.j.external && settings.j.external.email === true, settings.j && settings.j.external);
  check('confirm email off (autoconfirm)', settings.j && settings.j.mailer_autoconfirm === true, settings.j && settings.j.mailer_autoconfirm);
  const anonRead = await call('/rest/v1/app_state?select=user_id');
  check('signed-out visitors see no data', anonRead.ok ? anonRead.j.length === 0 : anonRead.status === 401, anonRead);
  check('SUPABASE_SECRET_KEY secret is set (GitHub → Settings → Secrets → Actions)', !!SECRET);
  if (SECRET) check('grant a coach plan to the test coach', await admin('/rest/v1/grants', 'POST', { email: coachEmail, kind: 'coach', plan: 'studio', seats: 100, note: 'live test' }));
  const coach = await signup('coach'); users.push(coach);
  const client = await signup('client'); users.push(client);
  check('sign up returns a session', !!coach.token && !!client.token);
  const login = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: client.email, password: 'Live-test-' + tag } });
  check('sign in with password', login.ok && !!login.j.access_token, login.j);
  const bad = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: client.email, password: 'wrong-password' } });
  check('wrong password refused', !bad.ok, bad.status);
  const ref = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: login.j.refresh_token } });
  check('token refresh', ref.ok && !!ref.j.access_token, ref.j);
  const up = (tok, t, conflict, rows) => call(`/rest/v1/${t}?on_conflict=${conflict}`, { method: 'POST', token: tok, body: rows, prefer: 'resolution=merge-duplicates,return=minimal' });
  let r = await up(coach.token, 'profiles', 'id', [{ id: coach.id, display_name: 'Live Coach', is_coach: true, synced_at: new Date().toISOString() }]);
  check('coach profile upsert', r.ok, r.j);
  r = await up(client.token, 'profiles', 'id', [{ id: client.id, display_name: 'Live Client', is_coach: false, synced_at: new Date().toISOString() }]);
  check('client profile upsert', r.ok, r.j);
  // whole-app state with version check
  r = await call('/rest/v1/app_state', { method: 'POST', token: client.token, body: { user_id: client.id, state: { hello: 1 }, version: 1 }, prefer: 'return=minimal' });
  check('app_state insert', r.ok, r.j);
  r = await call(`/rest/v1/app_state?user_id=eq.${client.id}&version=eq.1`, { method: 'PATCH', token: client.token, body: { state: { hello: 2 }, version: 2 }, prefer: 'return=representation' });
  check('app_state update at current version', r.ok && r.j.length === 1, r.j);
  r = await call(`/rest/v1/app_state?user_id=eq.${client.id}&version=eq.1`, { method: 'PATCH', token: client.token, body: { state: { hello: 3 }, version: 2 }, prefer: 'return=representation' });
  check('stale version is not overwritten', r.ok && r.j.length === 0, r.j);
  const today = new Date().toISOString().slice(0, 10);
  r = await up(client.token, 'workouts', 'user_id,id', [{ user_id: client.id, id: 'w1', day: today, name: 'Upper A', duration_min: 50, sets: [['bb_bench', 80, 8, 2, null]], prs: 1 }]);
  check('workouts upsert', r.ok, r.j);
  r = await up(client.token, 'food_day_totals', 'user_id,day', [{ user_id: client.id, day: today, kcal: 2100, protein: 160, carbs: 200, fat: 70, target_kcal: 2200, target_protein: 160 }]);
  check('food totals upsert', r.ok, r.j);
  r = await up(client.token, 'weights', 'user_id,day', [{ user_id: client.id, day: today, kg: 80.5, source: null }]);
  check('weights upsert', r.ok, r.j);
  // coaching
  r = await call('/rest/v1/coach_links', { method: 'POST', token: client.token, body: { coach_id: client.id, client_label: 'Nope' }, prefer: 'return=representation' });
  check('no coach plan, no invites (run migrations/006_plans.sql if this fails)', !r.ok, r.j);
  r = await call('/rest/v1/entitlements', { method: 'POST', token: client.token, body: { user_id: client.id, kind: 'coach', plan: 'studio', seats: 100, source: 'grant' } });
  check('people can NOT give themselves a plan', !r.ok, r.status);
  r = await call('/rest/v1/rpc/claim_grants', { method: 'POST', token: coach.token, body: {} });
  r = await call('/rest/v1/rpc/my_access', { method: 'POST', token: coach.token, body: {} });
  check('granted coach plan shows up', r.ok && r.j.some(x => x.kind === 'coach' && x.seats === 100), r.j);
  r = await call('/rest/v1/coach_links', { method: 'POST', token: coach.token, body: { coach_id: coach.id, client_label: 'Live Client' }, prefer: 'return=representation' });
  const link = r.ok && r.j[0];
  check('coach creates invite code', !!link && /^[0-9A-F]{8}$/.test(link.invite_code), r.j);
  r = await call('/rest/v1/rpc/invite_preview', { method: 'POST', body: { code: link.invite_code.toLowerCase() } });
  check('invite link shows who invited you, before sign-up (run migrations/003_invite_preview.sql if this fails)', r.ok && r.j.length === 1 && r.j[0].coach_name === 'Live Coach' && r.j[0].client_label === 'Live Client', r.j);
  r = await call('/rest/v1/rpc/invite_preview', { method: 'POST', body: { code: 'FFFFFFFF' } });
  check('made-up codes show nothing', r.ok && r.j.length === 0, r.j);
  r = await call('/rest/v1/workouts?select=id', { token: coach.token });
  check('coach sees nothing before the client joins', r.ok && r.j.length === 0, r.j);
  const share = { workouts: true, nutrition: false, body: true, activity: false, wellbeing: true, paused: false };
  r = await call('/rest/v1/rpc/accept_invite', { method: 'POST', token: client.token, body: { code: link.invite_code, share } });
  check('client joins with the code', r.ok && r.j === link.id, r.j);
  r = await call('/rest/v1/rpc/accept_invite', { method: 'POST', token: client.token, body: { code: link.invite_code, share } });
  check('code works only once', !r.ok, r.j);
  r = await call('/rest/v1/rpc/invite_preview', { method: 'POST', body: { code: link.invite_code } });
  check('used invite links show nothing', r.ok && r.j.length === 0, r.j);
  r = await call(`/rest/v1/workouts?select=id&user_id=eq.${client.id}`, { token: coach.token });
  check('coach sees shared training', r.ok && r.j.length === 1, r.j);
  r = await call(`/rest/v1/weights?select=day&user_id=eq.${client.id}`, { token: coach.token });
  check('coach sees shared body data', r.ok && r.j.length === 1, r.j);
  r = await call(`/rest/v1/food_day_totals?select=day&user_id=eq.${client.id}`, { token: coach.token });
  check('coach can NOT see unshared nutrition', r.ok && r.j.length === 0, r.j);
  r = await call(`/rest/v1/app_state?select=user_id&user_id=eq.${client.id}`, { token: coach.token });
  check('coach can NOT see the client\'s full app data', r.ok && r.j.length === 0, r.j);
  r = await call('/rest/v1/rpc/my_access', { method: 'POST', token: client.token, body: {} });
  check('the client gets Plus through the coach', r.ok && r.j.some(x => x.kind === 'plus' && x.plan === 'coached'), r.j);
  r = await call(`/rest/v1/profiles?select=display_name&id=eq.${coach.id}`, { token: client.token });
  check('client sees the coach\'s name', r.ok && r.j[0] && r.j[0].display_name === 'Live Coach', r.j);
  r = await call(`/rest/v1/coach_links?id=eq.${link.id}`, { method: 'PATCH', token: coach.token, body: { share: Object.assign({}, share, { nutrition: true }) }, prefer: 'return=minimal' });
  check('coach can NOT change the client\'s sharing', !r.ok, r.status);
  r = await call(`/rest/v1/coach_links?id=eq.${link.id}`, { method: 'PATCH', token: client.token, body: { share: Object.assign({}, share, { nutrition: true }), client_note: 'Hello coach', client_note_at: new Date().toISOString() }, prefer: 'return=minimal' });
  check('client changes sharing and sends a message', r.ok, r.j);
  r = await call(`/rest/v1/food_day_totals?select=day&user_id=eq.${client.id}`, { token: coach.token });
  check('coach now sees nutrition', r.ok && r.j.length === 1, r.j);
  r = await call('/rest/v1/assignments', { method: 'POST', token: coach.token, body: { link_id: link.id, coach_id: coach.id, client_id: client.id, payload: { note: 'Live test', days: [1, 3, 5], program: 'starter3' } }, prefer: 'return=representation' });
  const asg = r.ok && r.j[0];
  check('coach sends a plan', !!asg, r.j);
  r = await call(`/rest/v1/assignments?select=id,payload&status=eq.sent&link_id=eq.${link.id}`, { token: client.token });
  check('client receives the plan', r.ok && r.j.length === 1, r.j);
  r = await call(`/rest/v1/assignments?id=eq.${asg.id}`, { method: 'PATCH', token: client.token, body: { status: 'accepted', answered_at: new Date().toISOString() }, prefer: 'return=minimal' });
  check('client accepts the plan', r.ok, r.j);
  // messages
  r = await call('/rest/v1/messages', { method: 'POST', token: coach.token, body: { link_id: link.id, sender_id: coach.id, body: 'Welcome aboard' }, prefer: 'return=representation' });
  check('messages table exists and coach can message (run migrations/002_messages.sql if this fails)', r.ok && r.j.length === 1, r.j);
  r = await call(`/rest/v1/messages?select=id,body&read_at=is.null&sender_id=neq.${client.id}`, { token: client.token });
  check('client sees the unread message', r.ok && r.j.length === 1 && r.j[0].body === 'Welcome aboard', r.j);
  r = await call('/rest/v1/rpc/mark_messages_read', { method: 'POST', token: client.token, body: { link: link.id } });
  check('client marks it read', r.ok && r.j === 1, r.j);
  r = await call('/rest/v1/messages', { method: 'POST', token: client.token, body: { link_id: link.id, sender_id: coach.id, body: 'pretending to be the coach' } });
  check('client can NOT send as the coach', !r.ok, r.status);
  r = await call('/rest/v1/messages', { method: 'POST', token: client.token, body: { link_id: link.id, sender_id: client.id, body: 'Thanks!' }, prefer: 'return=minimal' });
  check('client replies', r.ok, r.j);
  r = await call(`/rest/v1/messages?id=eq.00000000-0000-0000-0000-000000000000`, { method: 'PATCH', token: coach.token, body: { body: 'edited' } });
  r = await call(`/rest/v1/messages?select=body&link_id=eq.${link.id}&order=created_at`, { token: coach.token });
  check('coach reads the conversation', r.ok && r.j.map(x => x.body).join('|') === 'Welcome aboard|Thanks!', r.j);
  r = await call('/rest/v1/messages?select=id&order=created_at&limit=1', { token: client.token });
  const firstMsg = r.ok && r.j[0];
  r = await call('/rest/v1/reports', { method: 'POST', token: client.token, body: { reporter_id: client.id, link_id: link.id, message_id: firstMsg && firstMsg.id, reported_body: 'Welcome aboard', reason: 'other', details: 'live test' }, prefer: 'return=minimal' });
  check('client can report a message (run migrations/005_safety.sql if this fails)', r.ok, r.j);
  r = await call('/rest/v1/reports?select=id', { token: coach.token });
  check('the coach can NOT read reports', r.ok && r.j.length === 0, r.j);
  r = await call(`/rest/v1/profiles?on_conflict=id`, { method: 'POST', token: client.token, body: [{ id: client.id, display_name: 'Live Client', health_consent_at: new Date().toISOString(), terms_accepted_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
  check('consent is recorded on the profile', r.ok, r.j);
  r = await call(`/rest/v1/coach_links?id=eq.${link.id}`, { method: 'PATCH', token: client.token, body: { share: Object.assign({}, share, { nutrition: true, paused: true }) }, prefer: 'return=minimal' });
  r = await call(`/rest/v1/workouts?select=id&user_id=eq.${client.id}`, { token: coach.token });
  check('pause hides everything from the coach', r.ok && r.j.length === 0, r.j);
  r = await call(`/rest/v1/coach_links?id=eq.${link.id}`, { method: 'PATCH', token: coach.token, body: { status: 'ended' }, prefer: 'return=minimal' });
  check('coach can end the link', r.ok, r.j);
  r = await call('/rest/v1/coach_links', { method: 'POST', token: coach.token, body: { coach_id: coach.id, client_label: 'Live Client' }, prefer: 'return=representation' });
  const link2 = r.ok && r.j[0];
  r = await call('/rest/v1/rpc/accept_invite', { method: 'POST', token: client.token, body: { code: link2.invite_code, share } });
  check('client can rejoin the same coach after the link ended (run migrations/004_rejoin.sql if this fails)', r.ok && r.j === link2.id, r.j);
  r = await call('/rest/v1/coach_links', { method: 'POST', token: coach.token, body: { coach_id: coach.id, client_label: 'Live Client' }, prefer: 'return=representation' });
  const link3 = r.ok && r.j[0];
  r = await call('/rest/v1/rpc/accept_invite', { method: 'POST', token: client.token, body: { code: link3.invite_code, share } });
  check('a second active link to the same coach is refused clearly', !r.ok && /already linked/i.test(JSON.stringify(r.j)), r.j);
  r = await call('/rest/v1/rpc/accept_invite', { method: 'POST', token: coach.token, body: { code: link3.invite_code, share } });
  check('a coach can\'t accept their own invite', !r.ok && /own invite/i.test(JSON.stringify(r.j)), r.j);
  await call(`/rest/v1/coach_links?id=in.(${link2.id},${link3.id})`, { method: 'PATCH', token: coach.token, body: { status: 'ended' }, prefer: 'return=minimal' });
  r = await call('/rest/v1/messages', { method: 'POST', token: client.token, body: { link_id: link.id, sender_id: client.id, body: 'after the end' } });
  check('no messages after the link ends', !r.ok, r.status);
} catch (e) { check('run', false, e.message); }
finally {
  for (const u of users) {
    const r = await call('/rest/v1/rpc/delete_my_account', { method: 'POST', token: u.token, body: {} });
    check(`delete test account (${u.email.split('-').pop()})`, r.ok, r.j);
  }
  if (users[1]) { const r = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: users[1].email, password: 'Live-test-' + tag } }); check('deleted account can no longer sign in', !r.ok, r.status); }
  if (SECRET) await admin(`/rest/v1/grants?email=eq.${encodeURIComponent(coachEmail)}`, 'DELETE');
  console.log(results.join('\n')); if (process.env.GITHUB_ACTIONS) console.log(`::notice title=REST checks::` + results.join('%0A')); console.log(failed ? `\n${failed} check(s) failed` : '\nAll live checks passed');
  process.exit(failed ? 1 : 0);
}
