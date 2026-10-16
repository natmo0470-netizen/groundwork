/* Movla — admin console (admin.html).
   Signs in with a normal Movla account; the server only answers people listed in public.admins
   (migration 009). Every read and change goes through the admin_* functions, so this page holds no
   special keys. Analytics are aggregate counts from data people already sync; nothing is tracked. */
(() => {
  const CFG = typeof CLOUD_CONFIG !== 'undefined' ? CLOUD_CONFIG : {};
  const BASE = String(CFG.url || '').replace(/\/$/, '');
  const KEY = 'movla.admin.session';
  const root = document.getElementById('root');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n == null ? '–' : Number(n).toLocaleString());
  const day = iso => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '–');
  const when = iso => {
    if (!iso) return '–';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago'; if (s < 86400 * 14) return Math.round(s / 86400) + ' d ago';
    return day(iso);
  };
  const PLANS = [['starter', 'Starter · 5'], ['growth', 'Growth · 15'], ['pro', 'Pro · 40'], ['studio', 'Studio · 100']];

  /* ---------- session ---------- */
  const store = { get() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { /* blocked */ } } };
  let session = store.get();
  // On movla.app, reuse the app's sign-in while its token is still fresh (never refreshed here, so the app's session is untouched).
  function borrowAppSession() {
    try {
      const s = JSON.parse(localStorage.getItem('groundwork.session') || 'null');
      if (s && s.access_token && s.expires_at * 1000 > Date.now() + 120000) return { access_token: s.access_token, expires_at: s.expires_at, user: s.user, borrowed: true };
    } catch (e) { /* ignore */ }
    return null;
  }
  function setSession(j) {
    session = j && j.access_token ? { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600), user: { id: j.user.id, email: j.user.email } } : null;
    store.set(session);
  }
  async function refresh() {
    if (!session || session.borrowed || !session.refresh_token) throw Object.assign(new Error('Signed out'), { signedOut: true });
    const r = await fetch(BASE + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: CFG.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) { setSession(null); throw Object.assign(new Error('Your session ended. Sign in again.'), { signedOut: true }); }
    setSession(j);
  }
  async function rpc(name, body, retried) {
    if (session && session.expires_at * 1000 < Date.now() + 60000 && !retried) { try { await refresh(); } catch (e) { if (session && session.borrowed) { session = null; } else throw e; } }
    if (!session) throw Object.assign(new Error('Signed out'), { signedOut: true });
    const t0 = performance.now();
    const r = await fetch(BASE + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: CFG.anonKey, authorization: 'Bearer ' + session.access_token, 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    const ms = Math.round(performance.now() - t0);
    if (r.status === 401 && !retried) { await refresh(); return rpc(name, body, true); }
    const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
    if (!r.ok) throw Object.assign(new Error((j && (j.message || j.msg)) || 'Request failed (' + r.status + ')'), { status: r.status });
    rpc.lastMs = ms;
    return j;
  }
  async function signIn(email, password) {
    const r = await fetch(BASE + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: CFG.anonKey, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.access_token) throw new Error((j && (j.msg || j.error_description)) || 'That email and password don\'t match an account.');
    setSession(j);
  }

  /* ---------- state ---------- */
  const st = { tab: (location.hash || '#overview').slice(1), range: 30, data: {}, busy: {}, msg: '', filters: { fb: 'new', fbKind: '', rep: 'open', q: '' } };
  const TABS = [['overview', 'Overview'], ['people', 'People'], ['coaches', 'Coaches'], ['feedback', 'Feedback'], ['reports', 'Reports'], ['grants', 'Free plans'], ['system', 'System']];

  async function load(tab, force) {
    if (st.busy[tab] || (st.data[tab] && !force)) return;
    st.busy[tab] = true; render();
    try {
      if (tab === 'overview') st.data.overview = await rpc('admin_overview', { p_days: st.range });
      if (tab === 'people') st.data.people = await rpc('admin_users', { p_search: st.filters.q, p_limit: 100 });
      if (tab === 'coaches') st.data.coaches = await rpc('admin_coach_requests');
      if (tab === 'feedback') st.data.feedback = await rpc('admin_feedback', { p_status: st.filters.fb, p_kind: st.filters.fbKind, p_limit: 200 });
      if (tab === 'reports') st.data.reports = await rpc('admin_reports', { p_status: st.filters.rep });
      if (tab === 'grants') st.data.grants = await rpc('admin_grants');
      if (tab === 'system') { st.data.system = await rpc('admin_system'); st.data.dbMs = rpc.lastMs; runChecks(); }
      st.err = '';
    } catch (e) {
      if (e.signedOut) { session = null; st.err = e.message === 'Signed out' ? '' : e.message; }
      else st.err = e.message;
    }
    st.busy[tab] = false; render();
  }

  /* ---------- charts (single series; hover shows the day's value) ---------- */
  function chart(series, key, label, kind) {
    const W = 520, H = 170, L = 30, B = 22, T = 8, n = series.length;
    if (!n) return '<p class="faint">No data yet.</p>';
    const vals = series.map(s => s[key] || 0), max = Math.max(1, ...vals);
    const nice = max <= 2 ? 2 : max <= 4 ? 4 : Math.ceil(max / 4) * 4;
    const x = i => L + (i + 0.5) * ((W - L) / n), y = v => T + (H - T - B) * (1 - v / nice), bw = Math.max(2, (W - L) / n - 2);
    const ticks = [0, nice / 2, nice].filter((v, i, a) => a.indexOf(v) === i);
    const step = Math.ceil(n / 6);
    let g = ticks.map(v => `<line class="grid" x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(Math.round(v))}</text>`).join('');
    g += series.map((s, i) => (i % step === 0 || i === n - 1) ? `<text class="axis" x="${x(i)}" y="${H - 4}" text-anchor="middle">${new Date(s.day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>` : '').join('');
    if (kind === 'line') {
      const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      g += `<path class="area" d="M${x(0)},${y(0)} L${pts.join(' L')} L${x(n - 1)},${y(0)} Z"/><path class="ln" d="M${pts.join(' L')}"/>`;
      g += `<circle class="dot" cx="${x(n - 1)}" cy="${y(vals[n - 1])}" r="4"/>`;
    } else {
      g += vals.map((v, i) => { const h = Math.max(v ? 2 : 0, y(0) - y(v)); return `<rect class="bar" x="${(x(i) - bw / 2).toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4, bw / 2)}"/>`; }).join('');
    }
    g += series.map((s, i) => `<rect class="hit" x="${(x(i) - (W - L) / n / 2).toFixed(1)}" y="${T}" width="${((W - L) / n).toFixed(1)}" height="${H - T - B}" data-tip="${esc(new Date(s.day + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }))}: ${fmt(vals[i])} ${esc(label)}" data-x="${x(i)}" data-y="${y(vals[i])}"/>`).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} per day, last ${n} days">${g}<line class="cross" style="display:none" y1="${T}" y2="${H - B}"/></svg></div>`;
  }
  document.addEventListener('mousemove', e => {
    const hit = e.target.closest && e.target.closest('.hit'), chartEl = e.target.closest && e.target.closest('.chart');
    document.querySelectorAll('.tip').forEach(t => t.remove());
    document.querySelectorAll('.chart .cross').forEach(c => { c.style.display = 'none'; });
    if (!hit || !chartEl) return;
    const svg = chartEl.querySelector('svg'), box = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = box.width / vb.width;
    const cross = svg.querySelector('.cross'); cross.setAttribute('x1', hit.dataset.x); cross.setAttribute('x2', hit.dataset.x); cross.style.display = '';
    const tip = document.createElement('div'); tip.className = 'tip'; tip.textContent = hit.dataset.tip;
    tip.style.left = (Number(hit.dataset.x) * k) + 'px'; tip.style.top = (Number(hit.dataset.y) * k) + 'px';
    chartEl.appendChild(tip);
  });

  /* ---------- views ---------- */
  const kpi = (k, v, d) => `<div class="kpi"><span class="k">${k}</span><span class="v">${v}</span>${d ? `<span class="d">${d}</span>` : ''}</div>`;
  const pct = (a, b) => (b ? Math.round(a / b * 100) + '%' : '–');

  function viewOverview() {
    const o = st.data.overview; if (!o) return busy();
    const t = o.totals, s = o.series || [], ret = o.retention || {};
    const sum = k => s.reduce((n, d) => n + (d[k] || 0), 0);
    const attention = [
      t.coach_requests ? [`${t.coach_requests} coach request${t.coach_requests > 1 ? 's' : ''} waiting`, 'coaches'] : null,
      t.feedback_new ? [`${t.feedback_new} new feedback note${t.feedback_new > 1 ? 's' : ''}`, 'feedback'] : null,
      t.reports_open ? [`${t.reports_open} open report${t.reports_open > 1 ? 's' : ''}`, 'reports'] : null,
    ].filter(Boolean);
    return `
      ${attention.length ? `<div class="card" style="gap:8px"><span class="eyebrow">Needs attention</span>${attention.map(([txt, tab]) => `<button class="li" data-tab="${tab}" style="cursor:pointer"><span class="pill warn"><span class="dotst"></span></span><span class="grow">${esc(txt)}</span><span class="faint">Open →</span></button>`).join('')}</div>` : `<div class="card" style="flex-direction:row;align-items:center"><span class="pill ok"><span class="dotst"></span> All clear</span><span class="muted">No coach requests, new feedback or open reports.</span></div>`}
      <div class="kpis">
        ${kpi('Accounts', fmt(t.users), `+${fmt(t.new_7d)} this week · +${fmt(t.new_30d)} in 30 days`)}
        ${kpi('Active today', fmt(t.active_1d), `${fmt(t.active_7d)} this week · ${fmt(t.active_30d)} in 30 days`)}
        ${kpi('Week-1 retention', pct(ret.active_7d, ret.cohort), ret.cohort ? `${fmt(ret.active_7d)} of ${fmt(ret.cohort)} who joined 1–5 weeks ago used it this week` : 'Needs accounts older than a week')}
        ${kpi('Workouts', fmt(t.workouts_7d), `this week · ${fmt(t.workouts_total)} all time`)}
        ${kpi('Food days logged', fmt(t.food_days_7d), 'this week')}
        ${kpi('Coaches', fmt(t.coaches), `${fmt(t.coached_clients)} clients · ${fmt(t.invites_open)} invites open`)}
        ${kpi('Messages', fmt(t.messages_7d), 'this week')}
        ${kpi('Plus', fmt(t.plus_paid), `paid · ${fmt(t.plus_free)} free (grants, test)`)}
      </div>
      <div class="row" style="gap:8px;align-items:center"><span class="small muted">Charts:</span><div class="seg" style="width:auto">${[14, 30, 90].map(d => `<button data-range="${d}" aria-pressed="${st.range === d}" style="padding:4px 12px">${d} days</button>`).join('')}</div></div>
      <div class="grid2">
        <div class="card"><div class="card-head"><span class="eyebrow">People logging each day</span><span class="small faint">${fmt(Math.round(sum('loggers') / Math.max(1, s.length)))} a day on average</span></div>${chart(s, 'loggers', 'people logged a workout, food or weight', 'line')}</div>
        <div class="card"><div class="card-head"><span class="eyebrow">New accounts</span><span class="small faint">${fmt(sum('signups'))} in ${s.length} days</span></div>${chart(s, 'signups', 'new accounts', 'bar')}</div>
        <div class="card"><div class="card-head"><span class="eyebrow">Workouts logged</span><span class="small faint">${fmt(sum('workouts'))} in ${s.length} days</span></div>${chart(s, 'workouts', 'workouts', 'bar')}</div>
        <div class="card"><div class="card-head"><span class="eyebrow">Coach messages</span><span class="small faint">${fmt(sum('messages'))} in ${s.length} days</span></div>${chart(s, 'messages', 'messages', 'bar')}</div>
      </div>
      <p class="tiny faint" style="margin:0">Counts come from data people sync with an account. People using Movla without an account aren't counted, and nothing is tracked beyond what they save.</p>`;
  }

  function accessPills(list) {
    if (!list || !list.length) return '<span class="pill plain">Free</span>';
    return list.map(a => `<span class="pill ${a.kind === 'coach' ? 'ok' : 'plain'}">${a.kind === 'coach' ? 'Coach · ' + esc(a.plan) : 'Plus'}${a.source === 'grant' ? ' · free' : a.source === 'trial' ? ' · trial' : ''}${a.ends_at ? ' · to ' + day(a.ends_at) : ''}</span>`).join(' ');
  }
  function viewPeople() {
    const rows = st.data.people;
    return `<div class="card">
      <form class="inline-form" data-form="search"><div class="field"><label for="q">Search by email or name</label><input class="input" id="q" value="${esc(st.filters.q)}" placeholder="e.g. gmail.com"></div><button class="btn xs train" type="submit">Search</button></form>
      ${!rows ? busy() : !rows.length ? '<p class="faint">No matches.</p>' : `<div class="scrollx"><table class="tbl"><thead><tr><th>Account</th><th>Joined</th><th>Last active</th><th>Workouts</th><th>Plan</th><th></th></tr></thead><tbody>
        ${rows.map(u => `<tr><td><b>${esc(u.display_name || '—')}</b>${u.admin ? ' <span class="pill ok">admin</span>' : ''}<br><span class="small muted">${esc(u.email)}</span></td><td class="small">${day(u.created_at)}</td><td class="small">${when(u.synced_at || u.last_sign_in_at)}</td><td class="small">${fmt(u.workouts)}${u.last_workout ? `<br><span class="faint">last ${day(u.last_workout)}</span>` : ''}</td><td>${accessPills(u.access)}</td>
          <td><div class="row-actions">
            <select class="input" data-give-for="${u.id}" aria-label="Plan to give" style="width:auto;min-height:32px;font-size:13px"><option value="plus">Free Plus</option>${PLANS.map(([v, l]) => `<option value="coach:${v}">Coach ${l}</option>`).join('')}</select>
            <button class="btn ghost xs" data-act="give" data-id="${u.id}" data-email="${esc(u.email)}">Give</button>
            ${(u.access || []).some(a => a.source !== 'store' && a.source !== 'web') ? `<button class="btn ghost xs" data-act="end-access" data-id="${u.id}" data-email="${esc(u.email)}">End free plan</button>` : ''}
          </div></td></tr>`).join('')}</tbody></table></div>`}
    </div>`;
  }

  function viewCoaches() {
    const rows = st.data.coaches; if (!rows) return busy();
    if (!rows.length) return '<div class="card"><p class="faint" style="margin:0">Nobody has filled in the coach sign-up yet.</p></div>';
    const waiting = rows.filter(r => !r.plan), active = rows.filter(r => r.plan);
    const card = r => `<div class="card" style="gap:8px">
      <div class="row between" style="align-items:flex-start;gap:8px"><div><b>${esc(r.display_name || '—')}</b>${r.business_name ? ` · ${esc(r.business_name)}` : ''}<br><span class="small muted">${esc(r.email)}</span></div>${r.plan ? `<span class="pill ok">${esc(r.plan)}${r.plan_source === 'trial' ? ' · trial' : r.plan_source === 'grant' ? ' · free' : ''}${r.plan_ends ? ' · to ' + day(r.plan_ends) : ''}</span>` : '<span class="pill warn">Waiting</span>'}</div>
      <div class="small muted">${esc({ in_person: 'In person', online: 'Online', hybrid: 'In person + online' }[r.coaching_type] || r.coaching_type)} · ${r.client_count != null ? fmt(r.client_count) + ' clients today' : 'client count not given'} · wants ${esc(r.plan_wanted || '—')}${r.certification ? ` · ${esc(r.certification)}${r.cert_number ? ' #' + esc(r.cert_number) : ''} (self-reported)` : ''}</div>
      ${(r.specialties || []).length ? `<div class="small faint">${r.specialties.map(esc).join(', ')}</div>` : ''}
      <div class="inline-form"><div class="field"><label class="small">Plan</label><select class="input" data-plan-for="${r.user_id}">${PLANS.map(([v, l]) => `<option value="${v}" ${(r.plan || r.plan_wanted) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label class="small">For</label><select class="input" data-months-for="${r.user_id}"><option value="">No end date</option><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></div>
        <button class="btn train xs" data-act="approve-coach" data-id="${r.user_id}">${r.plan ? 'Change plan' : 'Approve'}</button>${r.plan ? `<button class="btn ghost xs" data-act="end-coach" data-id="${r.user_id}">End plan</button>` : ''}</div>
    </div>`;
    return `${waiting.length ? `<span class="eyebrow">Waiting for a plan (${waiting.length})</span>${waiting.map(card).join('')}` : ''}
      ${active.length ? `<span class="eyebrow">Coaches with a plan (${active.length})</span>${active.map(card).join('')}` : ''}
      <p class="tiny faint" style="margin:0">Approving gives a free coach plan (source "grant"). Once billing is live, paid plans appear here automatically.</p>`;
  }

  const KIND_LABEL = { idea: 'Idea', problem: 'Problem', confusing: 'Confusing', praise: 'Praise', other: 'Other' };
  function viewFeedback() {
    const rows = st.data.feedback;
    return `<div class="card">
      <div class="row wrap" style="gap:8px"><div class="seg" style="width:auto">${[['new', 'New'], ['planned', 'Planned'], ['done', 'Done'], ['', 'All']].map(([v, l]) => `<button data-fb="${v}" aria-pressed="${st.filters.fb === v}" style="padding:4px 12px">${l}</button>`).join('')}</div>
        <select class="input" data-fbkind style="width:auto;min-height:36px"><option value="">All types</option>${Object.entries(KIND_LABEL).map(([v, l]) => `<option value="${v}" ${st.filters.fbKind === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      ${!rows ? busy() : !rows.length ? '<p class="faint" style="margin:0">Nothing here.</p>' : `<div>${rows.map(f => `<div class="fb">
        <div class="row wrap" style="gap:6px"><span class="pill ${f.kind === 'problem' ? 'bad' : f.kind === 'idea' ? 'ok' : 'plain'}">${KIND_LABEL[f.kind] || esc(f.kind)}</span>${f.area ? `<span class="pill plain">${esc(f.area)}</span>` : ''}${f.rating ? `<span class="pill plain">Ease ${f.rating}/5</span>` : ''}<span class="small faint">${when(f.created_at)} · v${esc(f.app_version)} · ${esc(f.platform)}${f.email ? ' · ' + esc(f.email) : ''}</span></div>
        <p>${esc(f.message)}</p>
        <div class="row wrap" style="gap:8px">${f.contact ? `<a class="btn ghost xs" href="mailto:${esc(f.contact)}?subject=${encodeURIComponent('About your Movla feedback')}">Reply to ${esc(f.contact)}</a>` : ''}
          <select class="input" data-fbstatus="${f.id}" style="width:auto;min-height:32px;font-size:13px">${['new', 'read', 'planned', 'done', 'wont'].map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${{ new: 'New', read: 'Read', planned: 'Planned', done: 'Done', wont: 'Won\'t do' }[s]}</option>`).join('')}</select></div>
      </div>`).join('')}</div>`}
    </div>`;
  }

  function viewReports() {
    const rows = st.data.reports;
    return `<div class="card">
      <div class="seg" style="width:auto;align-self:flex-start">${[['open', 'Open'], ['reviewed', 'Reviewed'], ['actioned', 'Actioned'], ['', 'All']].map(([v, l]) => `<button data-rep="${v}" aria-pressed="${st.filters.rep === v}" style="padding:4px 12px">${l}</button>`).join('')}</div>
      ${!rows ? busy() : !rows.length ? '<p class="faint" style="margin:0">No reports.</p>' : `<div>${rows.map(r => `<div class="fb">
        <div class="row wrap" style="gap:6px"><span class="pill bad">${esc(r.reason)}</span><span class="pill plain">${esc(r.status)}</span><span class="small faint">${when(r.created_at)} · reported by ${esc(r.reporter || 'deleted account')}${r.reported_user ? ' · about ' + esc(r.reported_user) : ''}</span></div>
        ${r.reported_body ? `<p class="small" style="border-left:3px solid var(--line);padding-left:10px">${esc(r.reported_body)}</p>` : ''}${r.details ? `<p class="small muted">${esc(r.details)}</p>` : ''}
        <div class="row-actions">${r.status !== 'reviewed' ? `<button class="btn ghost xs" data-act="report" data-id="${r.id}" data-v="reviewed">Mark reviewed</button>` : ''}${r.status !== 'actioned' ? `<button class="btn ghost xs" data-act="report" data-id="${r.id}" data-v="actioned">Mark actioned</button>` : ''}${r.link_id ? `<button class="btn danger xs" data-act="end-link" data-id="${r.link_id}">End this coach link</button>` : ''}</div>
      </div>`).join('')}</div>`}
    </div>`;
  }

  function viewGrants() {
    const rows = st.data.grants;
    return `<div class="card"><span class="eyebrow">Give a free plan by email</span>
      <p class="small muted" style="margin:0">For friends, family, reviewers or early coaches. It applies when they sign up (or next time they open the app, if they already have an account).</p>
      <form class="inline-form" data-form="grant">
        <div class="field" style="min-width:200px"><label for="g-email">Email</label><input class="input" id="g-email" type="email" required></div>
        <div class="field"><label for="g-kind">Plan</label><select class="input" id="g-kind"><option value="plus">Plus</option>${PLANS.map(([v, l]) => `<option value="coach:${v}">Coach ${l}</option>`).join('')}</select></div>
        <div class="field"><label for="g-months">For</label><select class="input" id="g-months"><option value="">No end date</option><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></div>
        <div class="field"><label for="g-note">Note</label><input class="input" id="g-note" placeholder="e.g. family"></div>
        <button class="btn train xs" type="submit">Add</button></form></div>
      <div class="card">${!rows ? busy() : !rows.length ? '<p class="faint" style="margin:0">No free plans yet.</p>' : `<div class="scrollx"><table class="tbl"><thead><tr><th>Email</th><th>Plan</th><th>Length</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>
        ${rows.map(g => `<tr><td>${esc(g.email)}</td><td>${g.kind === 'coach' ? 'Coach · ' + esc(g.plan) : 'Plus'}</td><td class="small">${g.months ? g.months + ' mo' : 'No end'}</td><td>${g.revoked ? '<span class="pill plain">Cancelled</span>' : g.claimed_at ? `<span class="pill ok">Used ${day(g.claimed_at)}</span>` : '<span class="pill warn">Waiting</span>'}</td><td class="small muted">${esc(g.note)}</td><td>${!g.revoked && !g.claimed_at ? `<button class="btn ghost xs" data-act="revoke" data-id="${g.id}">Cancel</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`}</div>`;
  }

  /* System: live checks run from this browser, plus database facts from admin_system. */
  const checks = {};
  async function timed(name, fn) {
    checks[name] = { state: 'run' }; render();
    const t0 = performance.now();
    try { const note = await fn(); checks[name] = { state: 'ok', ms: Math.round(performance.now() - t0), note }; }
    catch (e) { checks[name] = { state: 'bad', ms: Math.round(performance.now() - t0), note: e.message }; }
    render();
  }
  function runChecks() {
    timed('site', async () => { const r = await fetch('sw.js?ts=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); const m = (await r.text()).match(/VERSION = '[^']*v([\d.]+)'/); return m ? 'Live version ' + m[1] : 'Online'; });
    timed('auth', async () => { const r = await fetch(BASE + '/auth/v1/health', { headers: { apikey: CFG.anonKey } }); if (!r.ok) throw new Error('HTTP ' + r.status); return 'Sign-in service up'; });
    timed('db', async () => { await rpc('is_admin'); return 'Database answering'; });
    timed('food', async () => { const r = await fetch(BASE + '/functions/v1/food-search?q=apple', { headers: { apikey: CFG.anonKey } }); const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.error) || 'HTTP ' + r.status); return `${(j.foods || []).length} USDA results for "apple"`; });
    timed('off', async () => { const r = await fetch('https://world.openfoodfacts.org/api/v2/product/3017624010701.json?fields=product_name'); if (!r.ok) throw new Error('HTTP ' + r.status); return 'Barcode database answering'; });
  }
  function viewSystem() {
    const s = st.data.system; if (!s) return busy();
    const free = 500 * 1024 * 1024, used = s.db_bytes || 0;
    const row = (k, label, help) => { const c = checks[k] || { state: 'run' }; return `<tr><td><b>${label}</b><br><span class="small faint">${help}</span></td><td>${c.state === 'run' ? '<span class="pill plain">Checking…</span>' : c.state === 'ok' ? '<span class="pill ok"><span class="dotst"></span> OK</span>' : '<span class="pill bad"><span class="dotst"></span> Down</span>'}</td><td class="small">${c.ms != null ? c.ms + ' ms' : ''}</td><td class="small muted">${esc(c.note || '')}</td></tr>`; };
    const tc = (s.settings || {}).test_checkout;
    return `<div class="card"><div class="card-head"><span class="eyebrow">Connections</span><button class="btn ghost xs" data-act="recheck">Check again</button></div>
      <div class="scrollx"><table class="tbl"><tbody>
        ${row('site', 'Website', 'movla.app on GitHub Pages')}
        ${row('auth', 'Accounts', 'Supabase sign-in')}
        ${row('db', 'Database', 'Supabase data API')}
        ${row('food', 'Food search', 'food-search function → USDA (private key)')}
        ${row('off', 'Barcodes', 'Open Food Facts')}
      </tbody></table></div>
      <p class="tiny faint" style="margin:0">Email sending (Resend) and builds (GitHub Actions) are checked in their own dashboards: <a href="https://resend.com/emails" target="_blank" rel="noopener">Resend</a> · <a href="https://github.com/natmo0470-netizen/groundwork/actions" target="_blank" rel="noopener">GitHub Actions</a> · <a href="https://supabase.com/dashboard/project/eavcynlwjpwigrvfuvzd" target="_blank" rel="noopener">Supabase</a></p></div>
    <div class="grid2">
      <div class="card"><span class="eyebrow">Database</span>
        <div class="row between small"><span>Storage used</span><b>${(used / 1048576).toFixed(1)} MB of 500 MB (free plan)</b></div>
        <div class="bar-meter" role="img" aria-label="${Math.round(used / free * 100)}% of storage used"><i style="width:${Math.min(100, used / free * 100).toFixed(1)}%"></i></div>
        <div class="small muted">${esc(s.postgres)} · answered in ${fmt(st.data.dbMs)} ms</div>
        <table class="tbl"><tbody>${Object.entries(s.tables || {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td class="small">${esc(k)}</td><td class="small" style="text-align:right">${fmt(v)} rows</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><span class="eyebrow">Switches</span>
        <div class="toggle"><span class="small"><b>Test checkout</b><br><span class="faint">Lets anyone start a free 14-day test coach plan. Turn off before launch.</span></span><button class="switch" role="switch" aria-checked="${tc === 'on'}" data-act="toggle-test" aria-label="Test checkout"></button></div>
      </div>
    </div>`;
  }

  const busy = () => '<p class="faint" style="margin:0">Loading…</p>';

  function viewLogin() {
    return `<div class="card login">
      <div class="adm-top"><span class="brand"><img src="icons/icon-192.png" alt="">Movla Admin</span></div>
      <p class="small muted" style="margin:0">Sign in with your Movla account. Only accounts on the admin list can use this page.</p>
      <form data-form="login" class="stack" style="gap:10px">
        <div class="field"><label for="em">Email</label><input class="input" id="em" type="email" autocomplete="email" required></div>
        <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
        ${st.err ? `<p class="err" role="alert">${esc(st.err)}</p>` : ''}
        <button class="btn train block" type="submit" ${st.signingIn ? 'disabled' : ''}>${st.signingIn ? 'Signing in…' : 'Sign in'}</button>
      </form></div>`;
  }
  function viewNotAdmin() {
    return `<div class="card login"><b>This account isn't an admin</b><p class="small muted" style="margin:0">Signed in as ${esc(session.user.email)}. To make it one, run this in the Supabase SQL Editor:</p>
      <pre class="small" style="white-space:pre-wrap;background:var(--surface-2);padding:10px;border-radius:10px;margin:0">insert into public.admins (user_id)
select id from auth.users where email = '${esc(session.user.email)}';</pre>
      <button class="btn ghost block" data-act="signout">Sign out</button></div>`;
  }

  function render() {
    if (!BASE) { root.innerHTML = '<p>Cloud settings are missing.</p>'; return; }
    if (!session) { root.innerHTML = viewLogin(); return; }
    if (st.admin === false) { root.innerHTML = viewNotAdmin(); return; }
    if (st.admin == null) { root.innerHTML = busy(); return; }
    const t = st.data.overview && st.data.overview.totals;
    const badge = { coaches: t && t.coach_requests, feedback: t && t.feedback_new, reports: t && t.reports_open };
    const focus = document.activeElement && document.activeElement.id;
    const view = { overview: viewOverview, people: viewPeople, coaches: viewCoaches, feedback: viewFeedback, reports: viewReports, grants: viewGrants, system: viewSystem }[st.tab] || viewOverview;
    root.innerHTML = `
      <div class="adm-top"><span class="brand"><img src="icons/icon-192.png" alt="">Movla Admin</span><span class="grow"></span>
        <span class="small muted">${esc(session.user.email)}</span><button class="btn ghost xs" data-act="refresh">Refresh</button><button class="btn ghost xs" data-act="signout">Sign out</button></div>
      <nav class="adm-tabs" role="tablist">${TABS.map(([id, l]) => `<button role="tab" data-tab="${id}" aria-selected="${st.tab === id}">${l}${badge[id] ? `<span class="count">${badge[id]}</span>` : ''}</button>`).join('')}</nav>
      ${st.msg ? `<div class="banner" style="background:var(--train-soft)">${esc(st.msg)}</div>` : ''}
      ${st.err ? `<div class="banner" role="alert" style="background:color-mix(in srgb, var(--bad) 14%, transparent)">${esc(st.err)}</div>` : ''}
      ${view()}`;
    if (focus) { const el = document.getElementById(focus); if (el) el.focus(); }
  }
  const flash = m => { st.msg = m; render(); clearTimeout(flash.t); flash.t = setTimeout(() => { st.msg = ''; render(); }, 3500); };
  function go(tab) { st.tab = tab; history.replaceState(null, '', '#' + tab); st.err = ''; render(); load(tab); if (tab !== 'overview') load('overview'); }

  async function act(fn, okMsg, reloadTabs) {
    try { await fn(); if (okMsg) flash(okMsg); (reloadTabs || [st.tab]).forEach(t => load(t, true)); if (st.tab !== 'overview') load('overview', true); }
    catch (e) { st.err = e.message; render(); }
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('button, [data-tab]'); if (!t) return;
    if (t.dataset.tab) { go(t.dataset.tab); return; }
    if (t.dataset.range) { st.range = Number(t.dataset.range); load('overview', true); return; }
    if (t.dataset.fb != null) { st.filters.fb = t.dataset.fb; load('feedback', true); return; }
    if (t.dataset.rep != null) { st.filters.rep = t.dataset.rep; load('reports', true); return; }
    const a = t.dataset.act, id = t.dataset.id;
    if (a === 'signout') { setSession(null); session = null; st.admin = null; st.data = {}; render(); return; }
    if (a === 'refresh') { st.data = {}; load(st.tab, true); if (st.tab !== 'overview') load('overview', true); return; }
    if (a === 'recheck') { runChecks(); return; }
    if (a === 'give') {
      const [k, plan] = root.querySelector(`[data-give-for="${id}"]`).value.split(':');
      act(() => rpc('admin_grant_access', { p_user: id, p_kind: k, p_plan: plan || null, p_note: 'given in admin' }), k === 'plus' ? `Free Plus given to ${t.dataset.email}` : `Coach plan given to ${t.dataset.email}`);
    }
    if (a === 'end-access' && confirm(`End the free plans for ${t.dataset.email}? Paid plans aren't affected.`)) act(async () => { await rpc('admin_end_access', { p_user: id, p_kind: 'plus' }); await rpc('admin_end_access', { p_user: id, p_kind: 'coach' }); }, 'Free plans ended');
    if (a === 'approve-coach') {
      const plan = root.querySelector(`[data-plan-for="${id}"]`).value, m = root.querySelector(`[data-months-for="${id}"]`).value;
      act(() => rpc('admin_grant_access', { p_user: id, p_kind: 'coach', p_plan: plan, p_months: m ? Number(m) : null, p_note: 'approved in admin' }), 'Coach plan on. They\'ll see it next time the app syncs.');
    }
    if (a === 'end-coach' && confirm('End this coach\'s free or trial plan? Their clients keep their own data.')) act(() => rpc('admin_end_access', { p_user: id, p_kind: 'coach' }), 'Coach plan ended');
    if (a === 'report') act(() => rpc('admin_set_report', { p_id: id, p_status: t.dataset.v }), 'Report updated');
    if (a === 'end-link' && confirm('End this coach–client link? Messages stop and the coach loses access to the client\'s shared data.')) act(() => rpc('admin_end_link', { p_link: id }), 'Link ended');
    if (a === 'revoke' && confirm('Cancel this free plan before it\'s used?')) act(() => rpc('admin_revoke_grant', { p_id: id }), 'Cancelled');
    if (a === 'toggle-test') { const on = t.getAttribute('aria-checked') === 'true'; if (on || confirm('Turn test checkout back on? Anyone could start a free 14-day test coach plan.')) act(() => rpc('admin_set_setting', { p_key: 'test_checkout', p_value: on ? 'off' : 'on' }), on ? 'Test checkout is off' : 'Test checkout is on'); }
  });
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.fbstatus) act(() => rpc('admin_set_feedback', { p_id: t.dataset.fbstatus, p_status: t.value }), 'Saved', []);
    if (t.dataset.fbkind != null) { st.filters.fbKind = t.value; load('feedback', true); }
  });
  root.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target.dataset.form;
    if (f === 'login') {
      const em = document.getElementById('em').value.trim(), pw = document.getElementById('pw').value;
      st.signingIn = true; st.err = ''; render();
      try { await signIn(em, pw); await boot(); }
      catch (err) { st.err = err.message; }
      st.signingIn = false; render(); return;
    }
    if (f === 'search') { st.filters.q = document.getElementById('q').value.trim(); load('people', true); }
    if (f === 'grant') {
      const kind = document.getElementById('g-kind').value, m = document.getElementById('g-months').value;
      const [k, plan] = kind.split(':');
      act(() => rpc('admin_add_grant', { p_email: document.getElementById('g-email').value.trim(), p_kind: k, p_plan: plan || null, p_months: m ? Number(m) : null, p_note: document.getElementById('g-note').value.trim() }), 'Free plan added', ['grants']);
    }
  });

  async function boot() {
    if (!session) session = borrowAppSession();
    if (!session) { render(); return; }
    try { st.admin = (await rpc('is_admin')) === true; }
    catch (e) { if (e.signedOut) { session = null; st.admin = null; render(); return; } st.err = e.message; st.admin = false; }
    render();
    if (st.admin) { go(TABS.some(([id]) => id === st.tab) ? st.tab : 'overview'); }
  }
  boot();
})();
