/* Movla — accounts, cloud backup and sync, and live coaching (Supabase).
   Talks to Supabase's REST endpoints directly with fetch (no SDK), so it runs the same on the
   website and inside the phone apps.
   - Auth: email + password (/auth/v1). Session kept in localStorage under groundwork.session.
   - Your whole app state is stored as one private row (app_state), versioned so two phones
     can't silently overwrite each other.
   - Coach-relevant data is also written to small tables (workouts, daily food totals, weights,
     measurements, activity, pain, flags). Row-level security lets a linked coach read only the
     categories the client shares; individual foods never leave the phone.
   - Coaches invite with an 8-character code; plans arrive in the client's app to accept or decline.
   Hidden entirely until js/cloud-config.js has a project URL and key. */
const Cloud = (() => {
  const cfg = () => (typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG) || {};
  const configured = () => !!(cfg().url && cfg().anonKey);
  const base = () => String(cfg().url).replace(/\/+$/, '');
  const SKEY = 'groundwork.session', MKEY = 'groundwork.sync';
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } },
  };
  const freshMeta = () => ({ version: 0, dirty: false, syncedAt: null, userId: null, hashes: {} });
  let session = ls.get(SKEY);
  let meta = Object.assign(freshMeta(), ls.get(MKEY) || {});
  const saveMeta = () => ls.set(MKEY, meta);
  const status = { state: 'idle', error: '', conflict: null };
  const signedIn = () => configured() && !!(session && session.access_token && session.user);
  const me = () => session && session.user && session.user.id;
  const email = () => (session && session.user && session.user.email) || '';

  /* ---------- requests ---------- */
  class CloudError extends Error { constructor(msg, code, st) { super(msg); this.code = code || ''; this.status = st || 0; } }
  const errMsg = (j, st) => (j && (j.msg || j.error_description || j.message || (typeof j.error === 'string' ? j.error : ''))) || `Request failed (${st})`;
  function setSession(j) {
    if (j && !j.expires_at && j.expires_in) j.expires_at = Math.floor(Date.now() / 1000) + j.expires_in;
    session = j && j.access_token ? { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at, user: { id: j.user.id, email: j.user.email } } : null;
    ls.set(SKEY, session);
  }
  let refreshing = null;
  function refreshOnce() {
    if (!refreshing) refreshing = (async () => {
      if (!session || !session.refresh_token) throw new CloudError('You\'re signed out', 'signed_out', 401);
      let r; try { r = await fetch(base() + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: cfg().anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) }); }
      catch (e) { throw new CloudError('No connection', 'offline', 0); }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.access_token) { if (r.status >= 400 && r.status < 500) signedOutLocally(); throw new CloudError('Your session ended. Sign in again.', 'signed_out', r.status); }
      setSession(j);
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function api(path, opts = {}, retried) {
    if (!configured()) throw new CloudError('Cloud isn\'t set up', 'unconfigured', 0);
    if (!opts.anon && session && session.expires_at && session.expires_at * 1000 < Date.now() + 60000 && !retried) await refreshOnce();
    const headers = Object.assign({ apikey: cfg().anonKey, 'content-type': 'application/json' }, opts.headers || {});
    if (!opts.anon && session && session.access_token) headers.authorization = 'Bearer ' + session.access_token;
    let r;
    try { r = await fetch(base() + path, { method: opts.method || 'GET', headers, body: opts.body == null ? undefined : JSON.stringify(opts.body) }); }
    catch (e) { throw new CloudError('No connection', 'offline', 0); }
    if (r.status === 401 && !opts.anon && session && !retried) { await refreshOnce(); return api(path, opts, true); }
    const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
    if (!r.ok) throw new CloudError(errMsg(j, r.status), (j && (j.error_code || j.code)) || '', r.status);
    return j;
  }
  const rest = (path, opts) => api('/rest/v1/' + path, opts);
  const upsert = (table, conflict, rows) => rest(`${table}?on_conflict=${conflict}`, { method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: rows });
  const localDay = iso => (iso ? dateKey(new Date(iso)) : null);   // server times are UTC; the app thinks in local days
  const inList = ids => `in.(${ids.map(x => '"' + String(x).replace(/["\\]/g, '') + '"').join(',')})`;

  /* ---------- auth ---------- */
  function friendlyAuthError(e) {
    const m = (e && e.message) || '';
    if (e && e.code === 'offline') return 'No connection. Check your internet and try again.';
    if (/invalid login|invalid_credentials/i.test(m + e.code)) return 'That email and password don\'t match an account.';
    if (/already registered|already exists|user_already_exists/i.test(m + e.code)) return 'There\'s already an account with that email. Sign in instead.';
    if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you, then sign in.';
    if (/password/i.test(m) && /least|weak|short/i.test(m)) return 'Use a password of at least 8 characters.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries. Wait a minute and try again.';
    return m || 'Something went wrong. Try again.';
  }
  async function signUp(mail, password) {
    const j = await api('/auth/v1/signup', { method: 'POST', anon: true, body: { email: mail, password } });
    if (!j || !j.access_token) return { confirm: true };   // email confirmation is switched on
    setSession(j); return { confirm: false };
  }
  async function signIn(mail, password) { setSession(await api('/auth/v1/token?grant_type=password', { method: 'POST', anon: true, body: { email: mail, password } })); }
  async function recover(mail) { await api('/auth/v1/recover', { method: 'POST', anon: true, body: { email: mail } }); }
  async function setPassword(password) { await api('/auth/v1/user', { method: 'PUT', body: { password } }); }
  function signedOutLocally() { clearTimeout(timer); setSession(null); meta = freshMeta(); saveMeta(); roster = null; rosterAt = 0; status.state = 'idle'; status.error = ''; status.conflict = null; pending = []; unread = {}; access = null; ls.set(AKEY, null); Object.keys(threads).forEach(k => delete threads[k]); }
  async function signOut() { try { await api('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* signing out locally is enough */ } signedOutLocally(); }
  async function deleteAccount() { await rest('rpc/delete_my_account', { method: 'POST', body: {} }); signedOutLocally(); }

  /* ---------- what gets stored ---------- */
  const DAY_WINDOW = 120;   // daily food totals and activity: last 4 months are kept up to date
  function snapshot() { const st = JSON.parse(JSON.stringify(S)); delete st.activeWorkout; return st; }
  function adherence14(st) {
    const today = todayKey(), from14 = addDays(today, -13); let planned = 0, done = 0;
    for (let i = 0; i < 14; i++) { const k = addDays(from14, i); if (k > today) break; if (st.plan && k < st.plan.createdAt) { if (workoutDoneOn(st, k)) { planned++; done++; } continue; } if (workoutForDate(st, k)) { planned++; if (workoutDoneOn(st, k)) done++; } }
    return { planned, done };
  }
  function rowsFor(st) {
    const uidv = me(), today = todayKey(), from = addDays(today, -(DAY_WINDOW - 1)), out = {};
    const byDay = (list, fn) => { const m = {}; list.forEach(x => { if (x && x.date) m[x.date] = fn(x); }); return Object.values(m); };
    out.workouts = (st.workouts || []).map((w, i) => ({ user_id: uidv, id: String(w.id || `${w.date}_${i}`), day: w.date, name: w.name || 'Workout', duration_min: w.durationMin || null, sets: (w.sets || []).map(s => [s.exId, Math.round((s.weightKg || 0) * 10) / 10, s.reps, s.rir == null ? null : s.rir, s.type || null]), prs: Array.isArray(w.prs) ? w.prs.length : (w.prs || 0) }));
    out.food_day_totals = Object.keys(st.foodLog || {}).filter(k => k >= from && k <= today && (st.foodLog[k] || []).length).map(k => {
      const t = foodTotals(st, k); let T = null; try { T = calcTargets(st, k); } catch (e) { /* targets need a profile */ }
      return { user_id: uidv, day: k, kcal: Math.round(t.kcal), protein: Math.round(t.p), carbs: Math.round(t.c || 0), fat: Math.round(t.f || 0), target_kcal: T ? Math.round(T.calories) : null, target_protein: T ? Math.round(T.protein) : null };
    });
    out.weights = byDay(st.weights || [], w => ({ user_id: uidv, day: w.date, kg: Math.round(w.kg * 100) / 100, source: w.source || null }));
    out.measurements = byDay(st.measurements || [], m => { const v = Object.assign({}, m); delete v.date; delete v.id; return { user_id: uidv, day: m.date, values: v }; });
    const hd = st.healthData || {}, days = new Set();
    ['steps', 'active', 'sleep', 'rhr'].forEach(k => Object.keys(hd[k] || {}).forEach(d => { if (d >= from && d <= today) days.add(d); }));
    const bodyFatCol = ls.get('groundwork.bfcol') !== false;
    const bf = typeof bodyFatMap === 'function' ? bodyFatMap(st) : {};   // smart scale or typed in (migration 010)
    Object.keys(bf).forEach(d => { if (d >= from && d <= today) days.add(d); });
    const num = (o, d) => (o && o[d] != null && isFinite(o[d]) ? Number(o[d]) : null);
    out.activity_days = [...days].map(d => ({ user_id: uidv, day: d, steps: num(hd.steps, d) == null ? null : Math.round(num(hd.steps, d)), active_kcal: num(hd.active, d) == null ? null : Math.round(num(hd.active, d)), sleep_min: num(hd.sleep, d) == null ? null : Math.round(num(hd.sleep, d)), resting_hr: num(hd.rhr, d) == null ? null : Math.round(num(hd.rhr, d) * 10) / 10, ...(bodyFatCol ? { body_fat: bf[d] ? bf[d].pct : null } : {}) }));
    out.pain_reports = (st.painLog || []).map((p, i) => ({ user_id: uidv, id: `${p.date}_${p.exId || 'x'}_${i}`, day: p.date, exercise_id: p.exId || null, area: p.area || null, kind: p.kind === 'sharp' ? 'sharp' : 'ache' }));
    const ad = st.onboarded ? adherence14(st) : { planned: 0, done: 0 };
    out.training_summary = st.onboarded ? [{ user_id: uidv, plan_name: st.plan ? st.plan.split : null, days_per_week: (st.schedule && st.schedule.days || []).length, planned_14: ad.planned, done_14: ad.done, goal: st.profile.goal || null, experience: st.profile.experience || null }] : [];
    out.body_profile = st.onboarded ? [{ user_id: uidv, age: st.profile.age || null, sex: st.profile.sex || null, height_cm: st.profile.heightCm ? Math.round(st.profile.heightCm * 10) / 10 : null }] : [];
    const sf = st.safety || {};
    out.health_flags = st.onboarded ? [{ user_id: uidv, needs_clearance: typeof needsClearance === 'function' ? !!needsClearance(sf) : false, cleared_on: typeof sf.cleared === 'string' ? sf.cleared : null }] : [];
    return out;
  }
  const one = () => 'one';
  const TABLES = {   // pk: key within this user's rows; daily: rows outside the window are left alone
    workouts: { conflict: 'user_id,id', pk: r => r.id, del: 'id', stamp: true },
    food_day_totals: { conflict: 'user_id,day', pk: r => r.day, del: 'day', daily: true },
    weights: { conflict: 'user_id,day', pk: r => r.day, del: 'day' },
    measurements: { conflict: 'user_id,day', pk: r => r.day, del: 'day' },
    activity_days: { conflict: 'user_id,day', pk: r => r.day, del: 'day', daily: true },
    pain_reports: { conflict: 'user_id,id', pk: r => r.id, del: 'id' },
    training_summary: { conflict: 'user_id', pk: one, stamp: true },
    body_profile: { conflict: 'user_id', pk: one },
    health_flags: { conflict: 'user_id', pk: one },
  };
  function hash(o) { const s = JSON.stringify(o); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + s.length.toString(36); }

  /* ---------- consent to store health data in the account (asked at sign-up, or once for older accounts) ---------- */
  const CKEY = 'groundwork.consent';
  const consents = () => ls.get(CKEY) || {};
  const consentAt = () => (me() && consents()[me()]) || null;
  function recordConsent(at) { const c = consents(); c[me()] = at || new Date().toISOString(); ls.set(CKEY, c); }
  const needsConsent = () => signedIn() && !consentAt();
  async function loadConsent() {
    if (consentAt()) return true;
    const r = await rest(`profiles?select=health_consent_at&id=eq.${me()}`).catch(() => []);
    if (r && r[0] && r[0].health_consent_at) { recordConsent(r[0].health_consent_at); return true; }
    return false;
  }
  let profileExtras = true;   // false if the project hasn't added the consent columns yet (migration 005)
  async function pushProfile() {
    const row = { id: me(), display_name: ((S.coachMode && S.coachMode.on && S.coachMode.name) || (S.profile && S.profile.name) || '').slice(0, 80), is_coach: !!(S.coachMode && S.coachMode.on), synced_at: new Date().toISOString() };
    if (profileExtras && consentAt()) Object.assign(row, { health_consent_at: consentAt(), terms_accepted_at: consentAt() });
    try { await upsert('profiles', 'id', [row]); }
    catch (e) { if (profileExtras && /health_consent_at|terms_accepted_at|column/i.test(e.message)) { profileExtras = false; delete row.health_consent_at; delete row.terms_accepted_at; await upsert('profiles', 'id', [row]); } else throw e; }
  }
  async function pushTables() {
    const all = rowsFor(S), H = meta.hashes = meta.hashes || {}, from = addDays(todayKey(), -(DAY_WINDOW - 1));
    for (const [t, rows] of Object.entries(all)) {
      const def = TABLES[t], prev = H[t] || {}, cur = {}, changed = [];
      rows.forEach(r => { const k = def.pk(r), h = hash(r); cur[k] = h; if (prev[k] !== h) changed.push(def.stamp ? Object.assign({ updated_at: new Date().toISOString() }, r) : r); });
      for (let i = 0; i < changed.length; i += 200) {
        const part = changed.slice(i, i + 200);
        try { await upsert(t, def.conflict, part); }
        catch (e) {   // body_fat arrives with migration 010; until then sync without it
          if (t !== 'activity_days' || !/body_fat/i.test(e.message || '')) throw e;
          ls.set('groundwork.bfcol', false); part.forEach(r => { delete r.body_fat; }); await upsert(t, def.conflict, part);
        }
      }
      const gone = Object.keys(prev).filter(k => !(k in cur) && !(def.daily && k < from));
      if (def.daily) Object.keys(prev).forEach(k => { if (k < from && !(k in cur)) cur[k] = prev[k]; });
      if (def.del) for (let i = 0; i < gone.length; i += 100) await rest(`${t}?user_id=eq.${me()}&${def.del}=${inList(gone.slice(i, i + 100))}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      else if (gone.length && !rows.length) await rest(`${t}?user_id=eq.${me()}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
      H[t] = cur; saveMeta();
    }
  }

  /* ---------- whole-app state, with a version check ---------- */
  async function remoteInfo() { const r = await rest(`app_state?select=version,updated_at&user_id=eq.${me()}`); return (r && r[0]) || null; }
  async function pushState() {
    const body = { state: snapshot(), version: (meta.version || 0) + 1, updated_at: new Date().toISOString() };
    if (!meta.version) {
      try { await rest('app_state', { method: 'POST', headers: { prefer: 'return=minimal' }, body: Object.assign({ user_id: me() }, body) }); }
      catch (e) { if (e.status === 409) { const ri = await remoteInfo(); status.conflict = ri || { version: 1 }; return false; } throw e; }
    } else {
      const r = await rest(`app_state?user_id=eq.${me()}&version=eq.${meta.version}`, { method: 'PATCH', headers: { prefer: 'return=representation' }, body });
      if (!r || !r.length) { const ri = await remoteInfo(); if (!ri) { meta.version = 0; return pushState(); } status.conflict = ri; return false; }
    }
    meta.version = body.version; meta.dirty = false; meta.syncedAt = Date.now(); meta.userId = me(); saveMeta();
    return true;
  }
  let applying = false;
  async function applyRemote() {
    const r = await rest(`app_state?select=state,version&user_id=eq.${me()}`), row = r && r[0];
    if (!row) return false;
    const keep = S.activeWorkout;
    applying = true;
    try { S = Object.assign(defaultState(), row.state); if (keep && !S.activeWorkout) S.activeWorkout = keep; save(); }
    finally { applying = false; }
    meta.version = row.version; meta.dirty = false; meta.syncedAt = Date.now(); meta.userId = me(); status.conflict = null; saveMeta();
    return true;
  }
  /* "Keep this phone's data": overwrite the cloud copy. */
  async function keepLocal() { const ri = await remoteInfo(); meta.version = ri ? ri.version : 0; meta.dirty = true; status.conflict = null; saveMeta(); await syncNow(); }
  async function useRemote() { status.conflict = null; await applyRemote(); await syncNow(); }

  /* ---------- the sync loop ---------- */
  let running = null, again = false, timer = null;
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(syncNow, ms == null ? 2000 : ms); }
  function syncNow() {
    if (!signedIn()) return Promise.resolve();
    if (running) { again = true; return running; }
    running = (async () => {
      status.state = 'syncing';
      try {
        if (!(await loadConsent())) { status.state = 'consent'; status.error = ''; return; }
        await pushProfile();
        await refreshAccess().catch(() => null);
        if (!status.conflict) {
          const ri = await remoteInfo();
          if (ri && ri.version > (meta.version || 0)) {
            if (meta.dirty || (!meta.version && S.onboarded)) status.conflict = ri;
            else await applyRemote();
          }
        }
        if (!status.conflict && S.onboarded && (meta.dirty || !meta.version)) await pushState();
        if (!status.conflict && S.onboarded) await pushTables();
        await clientSide();
        await checkInbox().catch(() => null);
        status.state = status.conflict ? 'conflict' : 'ok'; status.error = '';
      } catch (e) {
        status.state = e.code === 'offline' ? 'offline' : e.code === 'signed_out' ? 'idle' : 'error'; status.error = e.message || '';
      } finally {
        running = null;
        if (again) { again = false; schedule(500); }
        refreshUi();
      }
    })();
    return running;
  }
  function markDirty() { if (!signedIn() || applying) return; meta.dirty = true; saveMeta(); schedule(); }
  function refreshUi() {
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;   // don't wipe what someone is typing
    try { render(); } catch (e) { /* app not ready */ }
  }

  /* After signing in on this phone: decide whose data wins. */
  async function afterSignIn() {
    if (!(await loadConsent())) { status.state = 'consent'; return 'consent'; }
    const ri = await remoteInfo();
    if (meta.userId && meta.userId !== me()) { meta = freshMeta(); saveMeta(); }
    if (!ri) { meta.version = 0; meta.dirty = true; meta.userId = me(); saveMeta(); await syncNow(); return 'pushed'; }
    if (!S.onboarded) { await applyRemote(); await syncNow(); return 'restored'; }
    if (meta.userId === me() && meta.version === ri.version && !meta.dirty) { await syncNow(); return 'same'; }
    status.conflict = ri; status.state = 'conflict'; return 'choose';
  }

  /* ================= coaching over the cloud ================= */
  let roster = null, rosterAt = 0, rosterLoading = null;
  async function loadRoster() {
    if (!signedIn()) return;
    if (rosterLoading) return rosterLoading;
    rosterLoading = (async () => {
      const links = await rest(`coach_links?select=id,client_id,client_label,invite_code,status,share,created_at,accepted_at,client_note,client_note_at&coach_id=eq.${me()}&status=in.(invited,active)&order=created_at`);
      const ids = links.filter(l => l.client_id && l.status === 'active').map(l => l.client_id);
      const [data, notes, sent] = await Promise.all([
        ids.length ? fetchClientData(ids) : {},
        rest(`coach_notes?select=link_id,notes&coach_id=eq.${me()}`),
        rest(`assignments?select=link_id,created_at,status&coach_id=eq.${me()}&order=created_at.desc&limit=200`),
      ]);
      roster = links.map(l => {
        const last = sent.find(a => a.link_id === l.id);
        return { id: l.id, cloud: true, name: l.client_label || (data[l.client_id] && data[l.client_id].name) || 'Client', code: l.invite_code, linked: l.status === 'active', userId: l.client_id, invitedAt: localDay(l.created_at),
          data: l.status === 'active' ? assemble(l, data[l.client_id] || {}) : null, notes: ((notes || []).find(n => n.link_id === l.id) || {}).notes || '', lastAssign: last ? localDay(last.created_at) : null, lastAssignStatus: last ? last.status : null };
      });
      rosterAt = Date.now();
    })().finally(() => { rosterLoading = null; });
    return rosterLoading;
  }
  async function fetchClientData(ids) {
    const today = todayKey(), f = n => addDays(today, -n), inn = inList(ids);
    const q = (t, sel, extra) => rest(`${t}?select=${sel}&user_id=${inn}${extra || ''}`).catch(() => []);
    const [profiles, summary, body, workouts, food, weights, meas, act, pain, flags] = await Promise.all([
      rest(`profiles?select=id,display_name,synced_at&id=${inn}`).catch(() => []),
      q('training_summary', '*'), q('body_profile', '*'),
      q('workouts', 'user_id,day,name,duration_min,sets,prs', `&day=gte.${f(27)}&order=day`),
      q('food_day_totals', '*', `&day=gte.${f(13)}&order=day`),
      q('weights', 'user_id,day,kg', `&day=gte.${f(59)}&order=day`),
      q('measurements', 'user_id,day,values', `&day=gte.${f(365)}&order=day`),
      q('activity_days', '*', `&day=gte.${f(6)}&order=day`),
      q('pain_reports', '*', `&day=gte.${f(27)}&order=day`),
      q('health_flags', '*'),
    ]);
    const out = {};
    ids.forEach(id => {
      const mine = l => (l || []).filter(x => (x.user_id || x.id) === id);
      const p = (profiles || []).find(x => x.id === id) || {};
      out[id] = { name: p.display_name || '', syncedAt: p.synced_at || null, summary: mine(summary)[0] || null, body: mine(body)[0] || null, workouts: mine(workouts), food: mine(food), weights: mine(weights), measurements: mine(meas), activity: mine(act), pain: mine(pain), flags: mine(flags)[0] || null };
    });
    return out;
  }
  /* Turn the rows a coach may read into the same shape as a file-based update. */
  function assemble(link, raw) {
    const today = todayKey(), sh = Object.assign(defaultShare(), link.share || {}), ts = raw.summary, bp = raw.body;
    const foodBy = {}; (raw.food || []).forEach(r => { foodBy[r.day] = r; });
    const lastT = (raw.food || []).slice().reverse().find(r => r.target_kcal);
    const food = []; for (let i = 13; i >= 0; i--) { const k = addDays(today, -i), r = foodBy[k]; food.push({ date: k, kcal: r ? r.kcal : 0, p: r ? r.protein : 0, logged: !!r }); }
    const act = raw.activity || [], avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null;
    const steps = act.map(a => a.steps).filter(x => x != null), sleep = act.map(a => a.sleep_min).filter(x => x != null);
    const kcalT = lastT ? lastT.target_kcal : 0, pT = lastT ? lastT.target_protein || 0 : 0;
    return {
      name: link.client_label || raw.name || 'Client', sentAt: localDay(raw.syncedAt || link.accepted_at) || todayKey(), cloud: true,
      note: link.client_note || '', noteAt: localDay(link.client_note_at),
      profile: { goal: ts ? ts.goal : null, experience: ts ? ts.experience : null, sex: bp ? bp.sex : null, age: bp ? bp.age : null, heightCm: bp ? Number(bp.height_cm) : null, units: S.profile.units },
      targets: lastT ? { calories: kcalT, protein: pT, carbs: Math.max(0, Math.round((kcalT - pT * 4 - kcalT * 0.28) / 4)), fat: Math.round(kcalT * 0.28 / 9) } : null,
      plan: ts && ts.plan_name ? { name: ts.plan_name, days: ts.days_per_week } : null,
      adherence: ts ? { planned: ts.planned_14, done: ts.done_14 } : null,
      weights: (raw.weights || []).map(w => ({ date: w.day, kg: Number(w.kg) })),
      workouts: (raw.workouts || []).map(w => ({ date: w.day, name: w.name, durationMin: w.duration_min, prs: w.prs, sets: w.sets || [] })),
      food: sh.paused || !sh.nutrition ? [] : food, checkins: [],
      measurements: (raw.measurements || []).map(m => Object.assign({ date: m.day }, m.values)).slice(-6),
      pain: (raw.pain || []).map(p => ({ date: p.day, exId: p.exercise_id, area: p.area, kind: p.kind })),
      safety: raw.flags ? { needsClearance: raw.flags.needs_clearance, cleared: !!raw.flags.cleared_on } : null,
      activity: steps.length || sleep.length ? { stepsAvg: avg(steps), sleepAvg: avg(sleep) } : undefined,
      shared: sh,
    };
  }
  async function invite(label) {
    const r = await rest('coach_links', { method: 'POST', headers: { prefer: 'return=representation' }, body: { coach_id: me(), client_label: label } });
    rosterAt = 0; await loadRoster().catch(() => null);
    return r[0];
  }
  async function endLink(linkId) { await rest(`coach_links?id=eq.${linkId}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: { status: 'ended' } }); }
  async function assign(c, payload) { await rest('assignments', { method: 'POST', headers: { prefer: 'return=minimal' }, body: { link_id: c.id, coach_id: me(), client_id: c.userId, payload } }); delete threads[c.id]; }
  async function saveNote(linkId, notes) { await upsert('coach_notes', 'link_id', [{ link_id: linkId, coach_id: me(), notes }]); }

  /* ---------- client side ---------- */
  let pending = [];
  async function acceptInvite(code, share) {
    const linkId = await rest('rpc/accept_invite', { method: 'POST', body: { code, share } });
    const l = (await rest(`coach_links?select=id,coach_id,share,accepted_at&id=eq.${linkId}`))[0];
    const p = (await rest(`profiles?select=display_name&id=eq.${l.coach_id}`).catch(() => []))[0];
    return { linkId, coachId: l.coach_id, coachName: (p && p.display_name) || 'Your coach', share: l.share };
  }
  async function setShare(linkId, share) { await rest(`coach_links?id=eq.${linkId}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: { share } }); }
  async function setClientNote(linkId, note) { await rest(`coach_links?id=eq.${linkId}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: { client_note: note, client_note_at: new Date().toISOString() } }); }
  async function answer(id, st) { await rest(`assignments?id=eq.${id}`, { method: 'PATCH', headers: { prefer: 'return=minimal' }, body: { status: st, answered_at: new Date().toISOString() } }); pending = pending.filter(a => a.id !== id); Object.values(threads).forEach(t => t.items.forEach(it => { if (it.id === id) it.status = st; })); }
  /* An active link on the server that this phone doesn't know about (another device joined, or a lost save). */
  async function activeLink() {
    const l = (await rest(`coach_links?select=id,coach_id,share,accepted_at&client_id=eq.${me()}&status=eq.active&order=accepted_at.desc&limit=1`))[0];
    if (!l) return null;
    const p = (await rest(`profiles?select=display_name&id=eq.${l.coach_id}`).catch(() => []))[0];
    return { linkId: l.id, coachId: l.coach_id, coachName: (p && p.display_name) || 'Your coach', share: l.share, linkedAt: l.accepted_at ? localDay(l.accepted_at) : todayKey() };
  }
  async function clientSide() {
    if (!S.coach && S.onboarded) {
      const a = await activeLink().catch(() => null);
      if (a) { S.coach = { cloud: true, linkId: a.linkId, id: a.coachId, name: a.coachName, clientId: me(), linkedAt: a.linkedAt, lastSent: null, share: Object.assign(defaultShare(), a.share || {}) }; save(); }
    }
    const c = S.coach;
    if (!c || !c.cloud) { pending = []; return; }
    const l = (await rest(`coach_links?select=status,share&id=eq.${c.linkId}`))[0];
    if (!l || l.status !== 'active') {   // the coach ended coaching
      const name = c.name; S.coach = null; pending = []; save(); toast(`${name} ended coaching. Your plan and data stay.`); return;
    }
    pending = await rest(`assignments?select=id,payload,created_at&link_id=eq.${c.linkId}&status=eq.sent&order=created_at`);
  }

  /* ---------- messages between a coach and a client ---------- */
  let unread = {};                 // linkId -> unread messages from the other person, oldest first
  const threads = {};              // linkId -> { items, at }
  const loadingThread = {};
  const SEEN = 'groundwork.msgSeen';
  let notifyHook = null;           // set by the app: (newMessages) => void
  async function checkInbox() {
    if (!signedIn()) return false;
    const rows = await rest(`messages?select=id,link_id,body,created_at&read_at=is.null&sender_id=neq.${me()}&order=created_at&limit=200`);
    const next = {}; rows.forEach(r => (next[r.link_id] = next[r.link_id] || []).push(r));
    const sig = o => Object.keys(o).sort().map(k => k + ':' + o[k].map(x => x.id).join(',')).join('|');
    const changed = sig(next) !== sig(unread);
    unread = next;
    const seen = new Set(ls.get(SEEN) || []), fresh = rows.filter(r => !seen.has(r.id) && Date.now() - Date.parse(r.created_at) < 2 * 864e5);
    if (fresh.length) { rows.forEach(r => seen.add(r.id)); ls.set(SEEN, [...seen].slice(-300)); if (notifyHook) try { notifyHook(fresh); } catch (e) { /* ignore */ } }
    return changed;
  }
  async function loadThread(linkId) {
    if (loadingThread[linkId]) return loadingThread[linkId];
    loadingThread[linkId] = (async () => {
      const [msgs, asg] = await Promise.all([
        rest(`messages?select=id,sender_id,body,created_at,read_at&link_id=eq.${linkId}&order=created_at.desc&limit=200`),
        rest(`assignments?select=id,coach_id,payload,status,created_at&link_id=eq.${linkId}&order=created_at.desc&limit=50`),
      ]);
      const items = msgs.map(m => ({ kind: 'msg', id: m.id, mine: m.sender_id === me(), body: m.body, at: m.created_at, read: !!m.read_at }))
        .concat(asg.map(a => ({ kind: 'plan', id: a.id, mine: a.coach_id === me(), payload: a.payload || {}, status: a.status, at: a.created_at })))
        .sort((x, y) => (x.at < y.at ? -1 : 1));
      threads[linkId] = { items, at: Date.now() };
      if ((unread[linkId] || []).length) await markRead(linkId);
      return threads[linkId];
    })().finally(() => { delete loadingThread[linkId]; });
    return loadingThread[linkId];
  }
  async function markRead(linkId) { delete unread[linkId]; await rest('rpc/mark_messages_read', { method: 'POST', body: { link: linkId } }).catch(() => null); }
  async function sendMessage(linkId, body) {
    const r = await rest('messages', { method: 'POST', headers: { prefer: 'return=representation' }, body: { link_id: linkId, sender_id: me(), body } });
    const m = r[0], t = threads[linkId] || (threads[linkId] = { items: [], at: Date.now() });
    t.items.push({ kind: 'msg', id: m.id, mine: true, body: m.body, at: m.created_at, read: false });
    return m;
  }

  /* ---------- plans and access (coach plans, Plus, free plans granted by email) ---------- */
  const AKEY = 'groundwork.access';
  let access = ls.get(AKEY) || null;   // { userId, rows: [{kind, plan, seats, source, ends_at}], at }
  const accessRows = () => (access && access.userId === me() ? access.rows || [] : []);
  const live = r => !r.ends_at || Date.parse(r.ends_at) > Date.now();
  async function refreshAccess() {
    if (!signedIn()) return;
    await rest('rpc/claim_grants', { method: 'POST', body: {} }).catch(() => null);
    const rows = await rest('rpc/my_access', { method: 'POST', body: {} });
    const test = await rest('rpc/test_checkout_on', { method: 'POST', body: {} }).catch(() => false);
    const admin = await rest('rpc/is_admin', { method: 'POST', body: {} }).catch(() => false);   // migration 009
    access = { userId: me(), rows: Array.isArray(rows) ? rows : [], test: test === true, admin: admin === true, at: Date.now() }; ls.set(AKEY, access);
  }
  /* Test checkout (migration 007): while payments aren't set up, the server can let anyone start a free
     14-day test coach plan. Switched off on the server before launch. */
  const testCheckout = () => !!(access && access.userId === me() && access.test);
  const isAdmin = () => !!(access && access.userId === me() && access.admin);
  async function startTestPlan(plan) { await rest('rpc/start_test_coach_plan', { method: 'POST', body: { p_plan: plan } }); await refreshAccess(); }
  const hasCoach = () => accessRows().some(r => r.kind === 'coach' && live(r));
  const hasPlus = () => accessRows().some(r => live(r));            // coaches and coached clients get Plus too
  function coachAccess() { return accessRows().filter(r => r.kind === 'coach' && live(r)).sort((a, b) => (b.seats || 0) - (a.seats || 0))[0] || null; }
  function plusSource() { const r = accessRows().filter(live); return r.find(x => x.kind === 'plus' && x.source !== 'coach') || r.find(x => x.kind === 'coach') || r.find(x => x.source === 'coach') || null; }
  async function saveCoachProfile(p) { await upsert('coach_profiles', 'user_id', [Object.assign({ user_id: me(), updated_at: new Date().toISOString() }, p)]); }

  /* ---------- feedback (migration 008): insert-only, works signed in or not ---------- */
  async function sendFeedback(row) { await rest('feedback', { method: 'POST', headers: { prefer: 'return=minimal' }, body: row }); }

  /* ---------- reports ---------- */
  async function report(r) {
    await rest('reports', { method: 'POST', headers: { prefer: 'return=minimal' }, body: { reporter_id: me(), link_id: r.linkId || null, message_id: r.messageId || null, reported_body: r.body ? String(r.body).slice(0, 2000) : null, reason: r.reason, details: (r.details || '').slice(0, 1000) } });
  }

  /* ---------- invite links ---------- */
  const inviteLink = code => { const b = String(cfg().inviteBase || 'https://movla.app/'); return (/\/$|\.html?$/.test(b) ? b : b + '/') + '?join=' + code; };
  async function invitePreview(code) { const r = await api('/rest/v1/rpc/invite_preview', { method: 'POST', anon: true, body: { code } }); return (r && r[0]) || null; }

  /* ---------- links from emails (confirm address / reset password) ---------- */
  function readAuthLink() {
    if (!configured() || !/access_token=/.test(location.hash || '')) return null;
    const p = new URLSearchParams(location.hash.slice(1));
    const at = p.get('access_token'), rt = p.get('refresh_token'), type = p.get('type');
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    if (!at || !rt) return null;
    let user = null; try { const j = JSON.parse(atob(at.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); user = { id: j.sub, email: j.email }; } catch (e) { return null; }
    setSession({ access_token: at, refresh_token: rt, expires_in: Number(p.get('expires_in')) || 3600, user });
    return type || 'signin';
  }

  return {
    configured, signedIn, email, me, status, meta: () => meta, friendlyAuthError,
    signUp, signIn, signOut, recover, setPassword, deleteAccount, afterSignIn, syncNow, markDirty, keepLocal, useRemote, schedule,
    roster: () => roster, rosterAge: () => Date.now() - rosterAt, rosterBusy: () => !!rosterLoading, loadRoster, invite, endLink, assign, saveNote,
    acceptInvite, activeLink, setShare, setClientNote, answer, pending: () => pending, readAuthLink, isApplying: () => applying,
    checkInbox, loadThread, markRead, sendMessage, thread: id => threads[id] || null, threadBusy: id => !!loadingThread[id],
    unread: id => (id ? unread[id] || [] : unread), onMessages: fn => { notifyHook = fn; }, inviteLink, invitePreview,
    rpc: (fn, body) => rest('rpc/' + fn, { method: 'POST', body: body || {} }),
    needsConsent, recordConsent, report, sendFeedback, refreshAccess, hasCoach, hasPlus, coachAccess, plusSource, saveCoachProfile, testCheckout, isAdmin, startTestPlan,
  };
})();

/* ================= hooks into the app ================= */
(() => {
  if (!Cloud.configured()) return;

  // Every save marks the cloud copy out of date; a push follows a moment later.
  const _save = save;
  save = function () { _save(); Cloud.markDirty(); };

  // Coach roster: cloud clients first, then any file-based or sample clients on this phone.
  const _clients = clients;
  clients = function () { const local = _clients(); const r = Cloud.signedIn() ? Cloud.roster() : null; return r ? r.concat(local) : local; };

  const _render = render;
  render = function () {
    _render();
    if (S.onboarded && coachOn() && Cloud.signedIn() && (UI.tab === 'clients' || !Cloud.roster()) && !Cloud.rosterBusy() && Cloud.rosterAge() > 60000)
      Cloud.loadRoster().then(() => { const a = document.activeElement; if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render(); }).catch(() => null);
  };

  // The welcome screen offers sign-in, and shows account sheets (onboarding normally has none).
  const _ob = viewOnboarding;
  viewOnboarding = function () {
    let html = _ob();
    if (UI.obStep === 0 && !Cloud.signedIn()) html = html.replace('<button class="btn ghost block" data-act="seed-demo">Explore with sample data</button>', '$&<button class="btn ghost block" data-act="acct-open" data-mode="signin">I have an account · Sign in</button><button class="link" data-act="coach-start" style="align-self:center">I\'m a personal trainer or coach</button>');
    if (UI.obStep === 0) { const site = CLOUD_CONFIG.inviteBase || 'https://movla.app/'; html = html.replace('</div></div></div>', `<p class="tiny faint" style="text-align:center;margin:4px 0 0"><a href="${site}privacy.html" target="_blank" rel="noopener">Privacy</a> · <a href="${site}privacy.html#health-data" target="_blank" rel="noopener">Consumer health data</a> · <a href="${site}terms.html" target="_blank" rel="noopener">Terms</a></p></div></div></div>`); }
    if (UI.sheet && ['account', 'cloudChoice', 'newPassword', 'cloudConsent', 'coachStart'].includes(UI.sheet.type)) html += `<div class="scrim" data-act="close-sheet"></div>${sheetHtml()}`;
    if (UI.toast) html += `<div class="toast" role="status">${esc(UI.toast)}</div>`;
    return html;
  };

  /* ---------- Settings: Account & sync ---------- */
  const syncLine = () => {
    const st = Cloud.status, m = Cloud.meta();
    if (Cloud.needsConsent()) return 'Not backing up yet: confirm how your data is stored.';
    if (st.conflict) return 'Your data changed on another device. Choose which copy to keep.';
    if (st.state === 'syncing') return 'Syncing…';
    if (st.state === 'offline') return 'Offline. Changes sync when you\'re back online.';
    if (st.state === 'error') return 'Sync problem: ' + st.error;
    if (m.syncedAt) { const mins = Math.round((Date.now() - m.syncedAt) / 60000); return `Backed up ${mins < 1 ? 'just now' : mins < 60 ? mins + ' min ago' : new Date(m.syncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`; }
    return m.dirty ? 'Waiting to sync' : 'Signed in';
  };
  const accountCard = () => Cloud.signedIn()
    ? `<div class="card" style="box-shadow:none" id="set-account"><span class="eyebrow">Account &amp; sync</span>
        <div class="row between" style="gap:10px"><div style="min-width:0"><div class="h3" style="overflow-wrap:anywhere">${esc(Cloud.email())}</div><div class="small muted" id="sync-line">${esc(syncLine())}</div></div></div>
        ${Cloud.status.conflict ? `<button class="btn train block" data-act="cloud-resolve">Choose which data to keep</button>` : ''}${Cloud.needsConsent() ? `<button class="btn train block" data-act="cloud-consent">Review and continue</button>` : ''}
        ${(() => { const c = Cloud.coachAccess(), p = Cloud.plusSource(); const end = r => r && r.ends_at ? ` until ${shortDate(dateKey(new Date(r.ends_at)))}` : ''; return c ? `<p class="small" style="margin:0">${icon('check', 14)} Coach plan: up to ${c.seats} clients${c.source === 'grant' ? ' (complimentary)' : ''}${end(c)}</p>` : p ? `<p class="small" style="margin:0">${icon('check', 14)} Movla Plus${p.source === 'coach' ? ' from your coach' : p.source === 'grant' ? ' (complimentary)' : ''}${end(p)}</p>` : `<p class="small" style="margin:0">Free plan · <button class="link" data-act="plus-open">See Plus</button></p>`; })()}
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="cloud-sync">Sync now</button><button class="btn ghost sm" data-act="acct-signout">Sign out</button><button class="btn danger sm" data-act="acct-delete">Delete account</button></div>
        ${Cloud.isAdmin() ? `<a class="btn ghost sm" href="${esc((CLOUD_CONFIG.inviteBase || '').replace(/[^/]*$/, '') + 'admin.html')}" target="_blank" rel="noopener">${icon('chart', 16)} Admin console</a>` : ''}
        <p class="tiny faint" style="margin:0">Your plan, logs and settings are backed up privately to your account.</p></div>`
    : `<div class="card" style="box-shadow:none" id="set-account"><span class="eyebrow">Account &amp; sync</span>
        <p class="small muted" style="margin:0">Back up your data and use Movla on more than one device. Coaches and clients connect live with an account.</p>
        <div class="grid2"><button class="btn train sm" data-act="acct-open" data-mode="signup">Create account</button><button class="btn ghost sm" data-act="acct-open" data-mode="signin">Sign in</button></div></div>`;
  const _settings = SHEETS.settings;
  SHEETS.settings = s => _settings(s).replace('<div class="card" style="box-shadow:none" id="set-mode">', accountCard() + '<div class="card" style="box-shadow:none" id="set-mode">');

  /* ---------- sheets ---------- */
  Object.assign(SHEETS, {
    cloudConsent(s) {
      return sheetHead('How your data is stored', 'One question before we back up your data')
        + `<p class="small muted" style="margin:0">With an account, Movla stores your workouts, food log, weigh-ins, measurements, pain reports, health-check answers and any phone or watch activity in your account, so you can use it on other devices and, if you choose, share it with a coach.</p>
        <ul class="small muted" style="margin:0;padding-left:20px;display:grid;gap:4px"><li>Used only to run the app: never sold, never used for ads.</li><li>A coach sees only the categories you choose.</li><li>Export it any time, or delete your account and all of it.</li></ul>
        ${consentBox(s.consent)}
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="consent-agree">Continue</button>
        <button class="btn ghost block" data-act="consent-decline">Sign out instead</button>`;
    },
    report(s) {
      if (s.done) return sheetHead('Thanks for reporting', 'We review reports within 24 hours')
        + `<p class="small muted" style="margin:0">If someone is making you uncomfortable you can stop all contact now. ${coachOn() ? 'Removing a client ends the link and they can no longer message you.' : 'Leaving your coach ends the link: they can no longer message you or see your data.'}</p>
        ${s.linkId ? `<button class="btn danger block" data-act="${coachOn() ? 'coach-remove' : 'client-leave'}" data-id="${esc(s.linkId)}">${coachOn() ? `Remove ${esc(s.name)}` : `Leave ${esc(s.name)}`}</button>` : ''}
        <button class="btn ghost block" data-act="close-sheet">Done</button>`;
      const R = [['harassment', 'Harassment or bullying'], ['inappropriate', 'Sexual or inappropriate'], ['unsafe', 'Unsafe advice (dieting, injury, self-harm)'], ['spam', 'Spam or a scam'], ['other', 'Something else']];
      return sheetHead(s.messageId ? 'Report this message' : `Report ${esc(s.name)}`, 'Only our review team sees reports')
        + (s.body ? `<div class="msg them" style="max-width:100%"><div class="bubble">${esc(s.body)}</div></div>` : '')
        + `<div class="list">${R.map(([k, l]) => `<button class="li" data-act="report-reason" data-v="${k}" aria-pressed="${s.reason === k}"><span class="grow"><span class="t">${l}</span></span>${s.reason === k ? `<span class="tag train">${icon('check', 12)}</span>` : ''}</button>`).join('')}</div>
        <div class="field"><label for="rp-details">Anything else we should know? <span class="faint">(optional)</span></label><textarea class="input" id="rp-details" rows="2" maxlength="1000" data-acct="details">${esc(s.details || '')}</textarea></div>
        <button class="btn danger block" data-act="report-send" ${s.busy ? 'disabled' : ''}>Send report</button>
        <p class="tiny faint" style="margin:0">If someone is in danger, contact local emergency services.</p>`;
    },
    account(s) {
      const mode = s.mode || 'signin';
      const titles = { signin: ['Sign in', 'Pick up where you left off'], signup: ['Create your account', 'Back up and sync your progress'], reset: ['Reset your password', 'We\'ll email you a link'] };
      return sheetHead(titles[mode][0], titles[mode][1])
        + (s.reason && !s.done ? `<div class="banner">${icon('info', 18)}<span>${esc(s.reason)}</span></div>` : '')
        + (s.done ? `<div class="banner">${icon('check', 18)}<span>${esc(s.done)}</span></div>` : '')
        + `<div class="field"><label for="acct-email">Email</label><input class="input" id="acct-email" type="email" autocomplete="email" inputmode="email" data-acct="email" value="${esc(s.email || '')}"></div>
        ${mode !== 'reset' ? `<div class="field"><label for="acct-pw">Password</label><input class="input" id="acct-pw" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" data-acct="pw" value="${esc(s.pw || '')}">${mode === 'signup' ? '<span class="tiny faint">At least 8 characters</span>' : ''}</div>` : ''}
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="acct-submit" ${s.busy ? 'disabled' : ''}>${s.busy ? 'One moment…' : mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
        <div class="row between" style="gap:10px;flex-wrap:wrap">${mode === 'signin' ? '<button class="link" data-act="acct-mode" data-mode="signup">Create an account</button><button class="link muted" data-act="acct-mode" data-mode="reset">Forgot password?</button>' : '<button class="link" data-act="acct-mode" data-mode="signin">I already have an account</button>'}</div>
        ${mode === 'signup' ? consentBox(s.consent) : ''}`;
    },
    cloudChoice() {
      const c = Cloud.status.conflict || {};
      const when = c.updated_at ? new Date(c.updated_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'earlier';
      return sheetHead('Which data should we keep?', 'This phone and your account have different data')
        + `<div class="list"><button class="li" data-act="cloud-use-remote"><span class="ni">${icon('download', 20)}</span><span class="grow"><span class="t">Use my account's data</span><br><span class="d">Last saved ${esc(when)}. Replaces what's on this phone.</span></span></button>
          <button class="li" data-act="cloud-use-local"><span class="ni">${icon('user', 20)}</span><span class="grow"><span class="t">Keep this phone's data</span><br><span class="d">Replaces the copy in your account.</span></span></button></div>
        <p class="tiny faint" style="margin:0">Tip: if you're unsure, save a backup first (Settings → Back up your data).</p>`;
    },
    newPassword(s) {
      return sheetHead('Choose a new password', Cloud.email())
        + `<div class="field"><label for="np-pw">New password</label><input class="input" id="np-pw" type="password" autocomplete="new-password" data-acct="pw" value="${esc(s.pw || '')}"></div>
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="np-save">Save password</button>`;
    },
    cloudInvite(s) {
      const link = Cloud.inviteLink(s.code), coachName = (S.coachMode && S.coachMode.name) || S.profile.name || 'Your coach';
      const msg = `${coachName} invited you to train together on Movla. Tap to join: ${link}`;
      return sheetHead(`Invite ${esc(s.name)}`, 'Send this link. It works once.')
        + `<div class="card" style="box-shadow:none;gap:8px"><span class="label">Invite link</span><div class="invite-link" id="invite-link">${esc(link)}</div>
          <span class="small muted">${esc(s.name)} taps it, creates an account, chooses what to share and answers a few setup questions, then lands in their Coach tab, linked to you.</span></div>
        <button class="btn train block" data-act="cloud-share-code" data-text="${esc(msg)}">${icon('share', 18)} Send invite link</button>
        <button class="btn ghost block" data-act="cloud-copy-link" data-text="${esc(link)}">${icon('copy', 18)} Copy link</button>
        <p class="small muted" style="margin:0;text-align:center">Or they can enter code <b class="num" id="invite-code" style="letter-spacing:.08em">${esc(s.code)}</b> in Movla → Coach tab → Enable coaching.</p>
        <button class="btn ghost block" data-act="close-sheet">Done</button>`;
    },
  });

  /* ---------- actions ---------- */
  const busy = (on) => { if (UI.sheet) { UI.sheet.busy = on; render(); } };
  const minPw = 8;
  Object.assign(ACT, {
    'consent-agree': async () => {
      const s = UI.sheet; if (!s.consent) { s.error = 'Tick the box to continue, or sign out instead.'; render(); return; }
      Cloud.recordConsent(); const after = s.after; UI.stack = []; UI.sheet = null; render();
      try {
        const res = await Cloud.afterSignIn();
        if (res === 'choose') { UI.sheet = { type: 'cloudChoice' }; render(); return; }
        if (after === 'coachStart') { UI.sheet = { type: 'coachStart', step: 'business', tall: true }; render(); return; }
        if (after && S.onboarded) { UI.sheet = { type: after }; render(); return; }
        toast(res === 'restored' ? 'Welcome back. Your data is restored.' : 'Thanks. Your data is backed up.');
      } catch (e) { toast('Couldn\'t reach the server. Your data will sync when you\'re back online.'); }
    },
    'consent-decline': async () => { UI.stack = []; UI.sheet = null; await Cloud.signOut(); if (UI.join) { UI.join.step = 'account'; UI.join.mode = 'signin'; } render(); toast('Signed out. Your data stays on this phone.'); },
    'cloud-consent': () => pushSheet({ type: 'cloudConsent' }),
    'msg-select': t => { UI.msgSel = UI.msgSel === t.dataset.id ? null : t.dataset.id; if (window.paintThread) paintThread(); },
    'msg-report': t => {
      const link = t.dataset.link, th = Cloud.thread(link), m = th && th.items.find(x => x.id === t.dataset.id);
      const name = S.coach && S.coach.linkId === link ? S.coach.name : ((findClient(link) || {}).name || 'this person');
      UI.msgSel = null; pushSheet({ type: 'report', linkId: link, messageId: m ? m.id : null, body: m ? m.body : '', name, reason: null, details: '' });
    },
    'report-reason': t => { UI.sheet.reason = t.dataset.v; render(); },
    'report-send': async () => {
      const s = UI.sheet; if (!s.reason) { toast('Choose a reason'); return; }
      s.busy = true; render();
      try { await Cloud.report({ linkId: s.linkId, messageId: s.messageId, body: s.body, reason: s.reason, details: s.details }); s.busy = false; s.done = true; render(); }
      catch (e) { s.busy = false; render(); toast('Couldn\'t send the report. Check your connection and try again.'); }
    },
    'acct-open': t => pushSheet({ type: 'account', mode: t.dataset.mode || 'signin', email: '', pw: '' }),
    'acct-mode': t => { UI.sheet.mode = t.dataset.mode; UI.sheet.error = ''; UI.sheet.done = ''; render(); },
    'acct-submit': async () => {
      const s = UI.sheet, mail = (s.email || '').trim(), pw = s.pw || '';
      if (!/^\S+@\S+\.\S+$/.test(mail)) { s.error = 'Enter your email address.'; render(); return; }
      if (s.mode !== 'reset' && !pw) { s.error = 'Enter your password.'; render(); return; }
      if (s.mode === 'signup' && pw.length < minPw) { s.error = `Use a password of at least ${minPw} characters.`; render(); return; }
      if (s.mode === 'signup' && !s.consent) { s.error = 'Please agree to how your data is stored to create an account.'; render(); return; }
      s.error = ''; busy(true);
      try {
        if (s.mode === 'reset') { await Cloud.recover(mail); s.busy = false; s.done = 'If there\'s an account for that email, a reset link is on its way.'; render(); return; }
        if (s.mode === 'signup') {
          const r = await Cloud.signUp(mail, pw);
          if (r.confirm) { s.busy = false; s.mode = 'signin'; s.done = 'Check your email and tap the link to confirm, then sign in here.'; render(); return; }
          Cloud.recordConsent();
        } else await Cloud.signIn(mail, pw);
        const res = await Cloud.afterSignIn();
        UI.stack = []; UI.sheet = null;
        if (res === 'consent') { UI.sheet = { type: 'cloudConsent', after: s.after }; render(); return; }
        if (res === 'choose') { UI.sheet = { type: 'cloudChoice' }; render(); return; }
        if (s.after === 'coachStart') { UI.sheet = Object.assign({ type: 'coachStart', tall: true }, s.afterState || {}); render(); return; }
        if (s.after && S.onboarded) { UI.sheet = { type: s.after }; render(); toast('Signed in. Now enter your coach\'s code.'); return; }
        render();
        toast(res === 'restored' ? 'Welcome back. Your data is restored.' : s.mode === 'signup' ? 'Account created. Your data is backed up.' : (S.onboarded ? 'Signed in. Your data is backed up.' : 'Signed in. Finish setup and your data backs up automatically.'));
      } catch (e) { if (UI.sheet === s) { s.busy = false; s.error = Cloud.friendlyAuthError(e); render(); } }
    },
    'np-save': async () => {
      const s = UI.sheet, pw = s.pw || '';
      if (pw.length < minPw) { s.error = `Use at least ${minPw} characters.`; render(); return; }
      try { await Cloud.setPassword(pw); closeAll(); toast('Password updated'); } catch (e) { s.error = Cloud.friendlyAuthError(e); render(); }
    },
    'cloud-sync': async () => { await Cloud.syncNow(); toast(Cloud.status.state === 'ok' ? 'Synced' : Cloud.status.conflict ? 'Choose which data to keep' : Cloud.status.error || 'Couldn\'t sync'); },
    'cloud-resolve': () => pushSheet({ type: 'cloudChoice' }),
    'cloud-use-remote': async () => { closeAll(); try { await Cloud.useRemote(); toast('Using your account\'s data'); } catch (e) { toast('Couldn\'t load your data. Try again.'); } render(); },
    'cloud-use-local': async () => { closeAll(); try { await Cloud.keepLocal(); toast('This phone\'s data is now in your account'); } catch (e) { toast('Couldn\'t sync. Try again.'); } render(); },
    'acct-signout': () => confirmSheet('Sign out?', 'Your data stays on this phone. Sign in again any time to keep syncing.', 'Sign out', async () => { await Cloud.signOut(); if (UI.tab === 'clients') UI.tab = 'today'; render(); toast('Signed out'); }),
    'acct-delete': () => confirmSheet('Delete your account?', 'This permanently deletes your account and everything stored in the cloud, including coach links. Data on this phone stays until you erase it in Settings.', 'Delete account', async () => {
      try { await Cloud.deleteAccount(); render(); toast('Account deleted'); } catch (e) { toast('Couldn\'t delete the account: ' + (e.message || 'try again')); }
    }, true),
    'cloud-copy-link': async t => { try { await navigator.clipboard.writeText(t.dataset.text); toast('Link copied'); } catch (e) { toast('Press and hold the link to copy it'); } },
    'cloud-share-code': async t => {
      const text = t.dataset.text;
      try {
        if (typeof Native !== 'undefined' && Native.isNative) { await Native.call('Share', 'share', { title: 'Movla invite', text, dialogTitle: 'Send invite code' }); return; }
        if (navigator.share) { await navigator.share({ title: 'Movla invite', text }); return; }
        await navigator.clipboard.writeText(text); toast('Invite copied. Paste it into a text or email.');
      } catch (e) { /* share cancelled */ }
    },
    'cloud-assign-open': t => { const id = t && t.dataset && t.dataset.id, a = Cloud.pending().find(x => !id || x.id === id); if (!a) { toast('That plan was already answered'); return; } pushSheet({ type: 'assignReview', payload: Object.assign({}, a.payload, { sentAt: dateKey(new Date(a.created_at)) }), assignId: a.id, tall: true }); },
    'assign-decline': async () => {
      const s = UI.sheet; try { await Cloud.answer(s.assignId, 'declined'); closeAll(); toast('Declined. Your plan stays as it is.'); } catch (e) { toast('Couldn\'t reach the server. Try again.'); }
    },
    'coach-enable': () => {
      if (!Cloud.signedIn()) { pushSheet({ type: 'account', mode: 'signup', email: '', pw: '', after: 'coachEnable', reason: 'Coaching needs a free account so you and your coach stay in sync. Already have one? Tap "I already have an account".' }); return; }
      pushSheet({ type: 'coachEnable' });
    },
    'join-code': () => {
      const code = val('join-code').toUpperCase().replace(/[^A-F0-9]/g, '');
      if (code.length !== 8) { toast('Enter the 8-character code from your coach'); return; }
      pushSheet({ type: 'coachJoin', invite: { cloud: true, code, coachName: 'your coach' }, share: defaultShare(), tall: true });
    },
  });
  // Accepting a plan from the cloud also tells the coach.
  const _accept = ACT['assign-accept'];
  ACT['assign-accept'] = () => { const id = UI.sheet && UI.sheet.assignId; _accept(); if (id) Cloud.answer(id, 'accepted').catch(() => toast('Plan set. We\'ll tell your coach when you\'re back online.')); };
  // Joining by code.
  const _join = ACT['join-accept'];
  ACT['join-accept'] = async () => {
    const s = UI.sheet, o = s.invite;
    if (!o.cloud) { _join(); return; }
    if (s.busy) return; s.busy = true;
    try {
      const r = await Cloud.acceptInvite(o.code, Object.assign({}, s.share));
      S.coach = { cloud: true, linkId: r.linkId, id: r.coachId, name: r.coachName, clientId: Cloud.me(), linkedAt: todayKey(), lastSent: null, share: Object.assign(defaultShare(), r.share || s.share) };
      save(); closeAll(); toast(`Linked with ${r.coachName}. Your progress syncs automatically.`);
      Cloud.syncNow();
    } catch (e) { s.busy = false; toast(/not found|already used/i.test(e.message) ? 'That code didn\'t work. Check it with your coach: each code works once.' : /own invite/i.test(e.message) ? 'That\'s your own invite code. Send it to your client instead.' : /already linked/i.test(e.message) ? 'You\'re already linked with this coach. Pull down or reopen the app to refresh.' : 'Couldn\'t join: ' + (e.message || 'try again')); }
  };
  // Sharing changes apply on the server straight away.
  const _share = ACT['share-set'];
  ACT['share-set'] = async t => {
    if (!(S.coach && S.coach.cloud)) { _share(t); return; }
    const sh = S.coach.share = Object.assign(defaultShare(), S.coach.share || {}), k = t.dataset.k, before = Object.assign({}, sh);
    sh[k] = !sh[k]; save(); render();
    try { await Cloud.setShare(S.coach.linkId, sh); toast(k === 'paused' ? (sh.paused ? 'Sharing paused' : 'Sharing resumed') : 'Saved. Your coach sees the change right away.'); }
    catch (e) { S.coach.share = before; save(); render(); toast('Couldn\'t save that change. Check your connection.'); }
  };
  const _leave = ACT['client-leave'];
  ACT['client-leave'] = () => {
    if (!(S.coach && S.coach.cloud)) { _leave(); return; }
    confirmSheet('Leave your coach?', 'Your coach immediately loses access to your data. Your plan and history stay.', 'Leave', async () => {
      try { await Cloud.endLink(S.coach.linkId); S.coach = null; save(); render(); toast('Unlinked'); } catch (e) { toast('Couldn\'t reach the server. Try again when you\'re online.'); }
    }, true);
  };

  // Fields typed into account sheets survive re-renders.
  document.addEventListener('input', e => {
    const el = e.target; if (!el || !el.dataset) return;
    if (el.dataset.acct && UI.sheet) UI.sheet[el.dataset.acct] = el.type === 'checkbox' ? el.checked : el.value;
  });
  /* ---------- messages ---------- */
  UI.msgDraft = UI.msgDraft || {};
  document.addEventListener('input', e => {
    const el = e.target; if (!el || !el.dataset || el.dataset.msgdraft == null) return;
    UI.msgDraft[el.dataset.msgdraft] = el.value;
    el.style.height = 'auto'; el.style.height = Math.min(140, el.scrollHeight + 2) + 'px';
  });
  document.addEventListener('keydown', e => {
    const el = e.target; if (!el || !el.dataset || el.dataset.msgdraft == null) return;
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); ACT['msg-send']({ dataset: { link: el.dataset.msgdraft } }); }
  });
  ACT['msg-send'] = async t => {
    const link = t.dataset.link, body = (UI.msgDraft[link] || '').trim().slice(0, 2000);
    if (!body) { const el = document.getElementById('msg-input'); if (el) el.focus(); return; }
    UI.msgDraft[link] = ''; const el = document.getElementById('msg-input'); if (el) { el.value = ''; el.style.height = ''; }
    try { await Cloud.sendMessage(link, body); paintThread(); }
    catch (e) { UI.msgDraft[link] = body; if (el) el.value = body; toast(/row-level|policy/i.test(e.message) ? 'This coaching link has ended, so messages can\'t be sent.' : 'Couldn\'t send. Check your connection and try again.'); }
  };
  ACT['open-coach-tab'] = () => { UI.stack = []; UI.sheet = null; UI.tab = coachOn() ? 'clients' : 'coach'; render(); window.scrollTo(0, document.body.scrollHeight); };
  ACT['coach-inbox'] = () => {
    const ids = Object.keys(Cloud.unread()).filter(id => findClient(id));
    UI.tab = 'clients'; UI.stack = []; UI.sheet = null;
    if (ids.length) UI.sheet = { type: 'client', id: ids[0], tab: 'chat', tall: true };
    render();
  };
  // Keep an open conversation fresh, and the inbox checked, while the app is on screen.
  const openThread = () => { const el = document.getElementById('gw-thread'); return el ? el.dataset.link : null; };
  window.paintThread = () => {
    const el = document.getElementById('gw-thread'); if (!el) return;
    el.innerHTML = threadBody(el.dataset.link, el.dataset.name || '');
    el.scrollTop = el.scrollHeight;
  };
  const _renderMsg = render;
  render = function () {
    _renderMsg();
    const link = openThread();
    if (link && Cloud.signedIn()) {
      paintThread();
      const t = Cloud.thread(link);
      if ((!t || Date.now() - t.at > 15000 || Cloud.unread(link).length) && !Cloud.threadBusy(link)) Cloud.loadThread(link).then(() => { paintThread(); refreshIfIdle(); }).catch(() => null);
    }
  };
  let tick = 0;
  setInterval(async () => {
    if (!Cloud.signedIn() || document.visibilityState !== 'visible') return;
    tick++;
    const link = openThread();
    try {
      if (link) { const before = (Cloud.thread(link) || { items: [] }).items.length; await Cloud.loadThread(link); if (Cloud.thread(link).items.length !== before) paintThread(); }
      if (tick % 3 === 0 && await Cloud.checkInbox()) refreshIfIdle();
    } catch (e) { /* offline: try again next tick */ }
  }, 15000);
  function refreshIfIdle() { const a = document.activeElement; if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) render(); }
  // New messages: a phone notification when the app isn't in front, otherwise a toast (unless that chat is open).
  let notifId = 0;
  Cloud.onMessages(fresh => {
    const shown = openThread();
    fresh.forEach(m => {
      if (m.link_id === shown && document.visibilityState === 'visible') return;
      const who = S.coach && S.coach.linkId === m.link_id ? S.coach.name : ((findClient(m.link_id) || {}).name || 'Your client');
      const body = m.body.length > 140 ? m.body.slice(0, 137) + '…' : m.body;
      if (document.visibilityState === 'visible') { toast(`${who}: ${body}`); return; }
      if (typeof Native !== 'undefined' && Native.isNative && S.reminders && S.reminders.browser)
        Native.call('LocalNotifications', 'schedule', { notifications: [{ id: 7960 + (notifId++ % 20), title: `Message from ${who}`, body, schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }, extra: { act: 'coachmsg' } }] }).catch(() => null);
      else { try { if (S.reminders && S.reminders.browser && 'Notification' in window && Notification.permission === 'granted') new Notification(`Message from ${who}`, { body, tag: 'gw-' + m.link_id }); } catch (e) { /* not available */ } }
    });
    refreshIfIdle();
  });

  /* ---------- reminders: a new plan from the coach, or a sync choice ---------- */
  const _rem = computeReminders;
  computeReminders = function (state, now) {
    let out = _rem(state, now);
    if (!state.onboarded || !Cloud.signedIn()) return out;
    if (state.coach && state.coach.cloud) out = out.filter(r => r.id !== 'coachupd');
    const p = Cloud.pending();
    if (p.length && state.coach) out.unshift({ id: 'cloudplan', level: 'high', title: `New plan from ${state.coach.name}`, body: p[0].payload && p[0].payload.note ? `“${p[0].payload.note}”` : 'Review it and choose whether to use it.', action: 'cloud-assign-open', actionLabel: 'Review plan', icon: 'user' });
    const today = todayKey(), un = Cloud.unread();
    if (state.coach && state.coach.cloud) {
      const m = un[state.coach.linkId] || [], lastM = m[m.length - 1];
      if (lastM && state.dismissed['msg_' + lastM.id] !== today) out.unshift({ id: 'msg_' + lastM.id, level: 'high', title: m.length > 1 ? `${m.length} new messages from ${state.coach.name}` : `Message from ${state.coach.name}`, body: lastM.body.length > 120 ? lastM.body.slice(0, 117) + '…' : lastM.body, action: 'open-coach-tab', actionLabel: 'Reply', icon: 'chat' });
    }
    if (coachOn()) {
      const ids = Object.keys(un).filter(id => (findClient(id) || {}).cloud), all = ids.flatMap(id => un[id]), lastM = all.sort((a, b) => (a.created_at < b.created_at ? -1 : 1))[all.length - 1];
      if (lastM && state.dismissed['msg_' + lastM.id] !== today) {
        const name = (findClient(lastM.link_id) || {}).name || 'A client';
        out.unshift({ id: 'msg_' + lastM.id, level: 'high', title: ids.length > 1 ? `New messages from ${ids.length} clients` : all.length > 1 ? `${all.length} new messages from ${name}` : `Message from ${name}`, body: lastM.body.length > 120 ? lastM.body.slice(0, 117) + '…' : lastM.body, action: 'coach-inbox', actionLabel: 'Reply', icon: 'chat' });
      }
    }
    if (Cloud.needsConsent()) out.unshift({ id: 'cloudconsent', level: 'high', title: 'One question about your account', body: 'Confirm how your data is stored so we can back it up.', action: 'cloud-consent', actionLabel: 'Review', icon: 'info' });
    if (Cloud.status.conflict) out.unshift({ id: 'cloudconflict', level: 'high', title: 'Your data changed on another device', body: 'Choose which copy to keep so both stay in sync.', action: 'cloud-resolve', actionLabel: 'Choose', icon: 'info' });
    return out;
  };

  /* ---------- start-up and staying fresh ---------- */
  const linkType = Cloud.readAuthLink();
  let last = 0;
  const kick = () => { if (Cloud.signedIn() && Date.now() - last > 20000) { last = Date.now(); Cloud.syncNow(); } };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
  window.addEventListener('online', () => { last = 0; kick(); });
  setTimeout(async () => {
    if (!Cloud.signedIn()) return;
    if (linkType === 'recovery') { pushSheet({ type: 'newPassword', pw: '' }); return; }
    if (linkType) { const r = await Cloud.afterSignIn().catch(() => null); if (r === 'consent') { UI.sheet = { type: 'cloudConsent' }; render(); } else if (r === 'choose') { UI.sheet = { type: 'cloudChoice' }; render(); } else if (r) toast('Email confirmed. You\'re signed in.'); return; }
    kick();
  }, 300);
})();

/* ================= message thread rendering (used by the Coach tab and the coach's client view) ================= */
function threadBody(link, otherName) {
  const t = typeof Cloud !== 'undefined' && Cloud.thread(link);
  const first = otherName || 'them';
  if (!t) return `<div class="empty small muted" style="padding:24px 0">Loading messages…</div>`;
  if (!t.items.length) return `<div class="empty" style="padding:22px 8px">${icon('chat', 26)}<span>No messages yet. Messages here go straight to ${esc(first)}.</span></div>`;
  let lastDay = '';
  const dayLabel = k => k === todayKey() ? 'Today' : k === addDays(todayKey(), -1) ? 'Yesterday' : shortDate(k);
  const time = iso => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const lastMine = [...t.items].reverse().find(x => x.kind === 'msg' && x.mine);
  return t.items.map(it => {
    const day = dateKey(new Date(it.at)), sep = day !== lastDay ? `<div class="msg-day">${dayLabel(day)}</div>` : ''; lastDay = day;
    if (it.kind === 'plan') {
      const a = it.payload, prog = a.program && PROGRAM_BY_ID[a.program];
      const what = [prog ? prog.name : a.workouts && a.workouts.length ? `${a.workouts.length} workout${a.workouts.length > 1 ? 's' : ''}` : '', a.targets ? `${fmtInt(a.targets.protein * 4 + a.targets.carbs * 4 + a.targets.fat * 9)} kcal targets` : ''].filter(Boolean).join(' + ') || 'a note';
      const st = it.status === 'accepted' ? 'Accepted' : it.status === 'declined' ? 'Declined' : it.mine ? 'Waiting for a reply' : '';
      return sep + `<div class="msg-plan">${icon('dumbbell', 16)}<div class="grow"><b>${it.mine ? 'You sent a plan' : `${esc(first)} sent you a plan`}</b>: ${esc(what)}${a.note ? `<br><span class="muted">“${esc(a.note)}”</span>` : ''}<br><span class="tiny faint">${time(it.at)}${st ? ' · ' + st : ''}</span></div>${!it.mine && it.status === 'sent' ? `<button class="btn train sm" data-act="cloud-assign-open" data-id="${it.id}">Review</button>` : ''}</div>`;
    }
    const sel = !it.mine && UI.msgSel === it.id;
    return sep + `<div class="msg ${it.mine ? 'me' : 'them'}">${it.mine ? `<div class="bubble">` : `<button class="bubble" data-act="msg-select" data-id="${it.id}" aria-expanded="${sel}" aria-label="Message from ${esc(first)}. Tap for options">`}${esc(it.body).replace(/\n/g, '<br>')}${it.mine ? '</div>' : '</button>'}<span class="tiny faint">${time(it.at)}${it === lastMine && it.read ? ' · Seen' : ''}</span>${sel ? `<button class="link small danger" data-act="msg-report" data-link="${esc(link)}" data-id="${it.id}">${icon('info', 14)} Report message</button>` : ''}</div>`;
  }).join('');
}
function threadHtml(link, otherName) {
  const first = otherName || 'them';
  return `<div class="thread" id="gw-thread" data-link="${esc(link)}" data-name="${esc(otherName || '')}" role="log" aria-live="polite" aria-label="Messages with ${esc(otherName || '')}">${threadBody(link, otherName)}</div>
    <div class="compose"><textarea class="input" id="msg-input" rows="1" maxlength="2000" placeholder="Message ${esc(first)}" aria-label="Message ${esc(first)}" data-msgdraft="${esc(link)}">${esc((UI.msgDraft || {})[link] || '')}</textarea><button class="btn train" data-act="msg-send" data-link="${esc(link)}">Send</button></div>`;
}

/* Consent checkbox used at sign-up (account sheet, join flow) and for older accounts. */
function consentBox(checked) {
  const site = (typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG.inviteBase) || 'https://movla.app/';
  return `<label class="consent"><input type="checkbox" data-acct="consent" data-jf="consent" ${checked ? 'checked' : ''}><span class="small">I consent to Movla storing my workout, nutrition, body and health information in my account to run the app, as described in the <a href="${site}privacy.html#health-data" target="_blank" rel="noopener">Privacy Policy</a>, and I agree to the <a href="${site}terms.html" target="_blank" rel="noopener">Terms of Use</a>.</span></label>`;
}
