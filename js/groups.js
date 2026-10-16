/* Movla — families and challenges (migration 010).
   Family: track progress together, a shared weekly workout goal, cheers on each other's workouts.
   Challenge: a competition over set dates on one metric the creator picks (weight loss %, body fat drop,
   strength gain, consistency), with a leaderboard.
   Everyone uses their own account; people join with an 8-character code or an invite link
   (https://movla.app/?group=CODE or movla://group/CODE). The server works out every number shown here,
   so nobody's body weight, food or other data ever reaches another phone: weight shows as a percent
   (pounds only if that person turns it on). */

const GROUP_METRICS = {
  weight_loss: { name: 'Weight loss', icon: 'scale', desc: 'Percent of starting body weight lost. Fair across different sizes. Only the percent is shown, never anyone\'s weight.' },
  body_fat: { name: 'Body fat drop', icon: 'target', desc: 'Points of body fat % dropped. Needs a smart scale, or body fat typed in with each weigh-in.' },
  strength: { name: 'Strength gain', icon: 'dumbbell', desc: 'Muscle building: average % increase in estimated one-rep max on lifts logged in the first week and later.' },
  consistency: { name: 'Consistency', icon: 'calendar', desc: '2 points for each day with a workout, 1 for each day with food logged. Anyone can win this one.' },
};

const Groups = (() => {
  const KEY = 'groundwork.groups', PENDING = 'groundwork.groupJoin';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  let C = store.get(KEY) || {};   // { uid, list, at, detail: { id: { d, at } } } — last answer, shown offline
  let unavailable = false, loadingList = false;
  const loadingDetail = {};
  const can = () => typeof Cloud !== 'undefined' && Cloud.configured() && !unavailable;
  const mine = () => (C.uid && Cloud.me && C.uid === Cloud.me() ? C : (C = { uid: Cloud.me ? Cloud.me() : null, list: null, detail: {} }));
  const persist = () => store.set(KEY, C);
  const missing = e => e && (e.status === 404 || /PGRST202|could not find the function/i.test((e.code || '') + ' ' + (e.message || '')));
  const rpc = (fn, body) => Cloud.rpc(fn, body);
  const typed = (s, k, fallback) => (s && s.f && s.f[k] != null ? s.f[k] : fallback);

  async function refresh(force) {
    if (!can() || !Cloud.signedIn() || loadingList) return;
    const c = mine();
    if (!force && c.at && Date.now() - c.at < 60e3) return;
    loadingList = true;
    try {
      const before = JSON.stringify([c.list, c.detail]);
      c.list = await rpc('my_groups'); c.at = Date.now(); persist();
      // Details for active groups, so cards can show ranks and team totals.
      for (const g of c.list.filter(g => !g.ended || (g.ends_on && g.ends_on >= addDays(todayKey(), -7))).slice(0, 10)) await loadDetail(g.id, force, true);
      if (JSON.stringify([c.list, c.detail]) !== before) render();
    } catch (e) { if (missing(e)) { unavailable = true; render(); } }
    loadingList = false;
  }
  async function loadDetail(id, force, quiet) {
    const c = mine(), cur = c.detail[id];
    if (loadingDetail[id] || (!force && cur && Date.now() - cur.at < 30e3)) return;
    loadingDetail[id] = true;
    const before = JSON.stringify(cur ? cur.d : null);
    try { c.detail[id] = { d: await rpc('group_detail', { p_group: id }), at: Date.now() }; persist(); if (JSON.stringify(c.detail[id].d) === before) quiet = true; }
    catch (e) { if (/not in this group/i.test(e.message || '')) { delete c.detail[id]; c.list = (c.list || []).filter(g => g.id !== id); persist(); } }
    loadingDetail[id] = false;
    if (!quiet) render();
  }
  const detail = id => (mine().detail[id] || {}).d || null;
  const list = () => mine().list || [];
  const available = () => can();

  /* ---------- formatting ---------- */
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  const fmt1 = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
  function score(m, metric) {
    const s = m.score;
    if (!s || s.value == null) return { big: '—', sub: s && s.note ? s.note : '' };
    const v = Number(s.value);
    if (metric === 'weight_loss') return { big: v >= 0 ? `${fmt1(v)}%` : `+${fmt1(-v)}%`, sub: (v >= 0 ? 'lost' : 'gained') + (s.lbs != null ? ` · ${fmt1(Math.abs(s.lbs))} lb` : '') };
    if (metric === 'body_fat') return { big: `${fmt1(Math.abs(v))}`, sub: `body fat points ${v >= 0 ? 'down' : 'up'}` };
    if (metric === 'strength') return { big: `${v > 0 ? '+' : ''}${fmt1(v)}%`, sub: `across ${s.lifts} lift${s.lifts === 1 ? '' : 's'}` };
    return { big: `${v}`, sub: `pts · ${s.workouts} workout${s.workouts === 1 ? '' : 's'}, ${s.food_days} food day${s.food_days === 1 ? '' : 's'}` };
  }
  function timing(g) {
    const today = g.today || todayKey();
    if (g.kind !== 'challenge') return null;
    const total = daysBetween(g.starts_on, g.ends_on) + 1;
    if (today < g.starts_on) return { state: 'soon', label: `Starts ${shortDate(g.starts_on)}`, pct: 0 };
    if (g.ended) return { state: 'ended', label: `Ended ${shortDate(g.ends_on)}`, pct: 100 };
    const day = daysBetween(g.starts_on, today) + 1, left = daysBetween(today, g.ends_on);
    return { state: 'live', label: `Day ${day} of ${total} · ${left === 0 ? 'last day' : left + ' day' + (left === 1 ? '' : 's') + ' left'}`, pct: Math.min(100, (day / total) * 100), left };
  }
  function meRow(d) { return d && (d.members || []).find(m => m.is_me); }
  function summary(g) {
    const d = detail(g.id), me = meRow(d);
    if (g.kind === 'family') {
      const goal = d && d.group.weekly_goal;
      return `${g.members} ${g.members === 1 ? 'person' : 'people'}${d ? ` · ${d.group.team_week}${goal ? ' of ' + goal : ''} workout${(goal || d.group.team_week) === 1 ? '' : 's'} this week` : ''}`;
    }
    const t = timing(d ? d.group : g);
    if (me && me.rank && !(t && t.state === 'soon')) return `${t.state === 'ended' ? 'Finished' : 'You\'re'} ${ord(me.rank)} of ${d.members.length} · ${t.state === 'ended' ? 'final results' : t.label.split(' · ').pop()}`;
    return `${GROUP_METRICS[g.metric].name} · ${g.members} ${g.members === 1 ? 'person' : 'people'} · ${t ? t.label.split(' · ').pop() : ''}`;
  }
  const inviteLink = code => {
    const base = (typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG.inviteBase) || 'https://movla.app/';
    return base.replace(/[?#].*$/, '').replace(/[^/]*$/, '') + '?group=' + code;
  };

  /* ---------- Progress: the Together card ---------- */
  function card() {
    if (!can()) return '';
    if (!Cloud.signedIn()) {
      return `<div class="card" id="together"><div class="card-head"><span class="eyebrow">Family &amp; challenges</span>${icon('trophy', 18, 'style="color:var(--fuel)"')}</div>
        <p class="small muted" style="margin:0">Track progress with your family, or challenge friends to a weight-loss or muscle-building competition with a leaderboard. Needs a free account so you can see each other.</p>
        <button class="btn ghost block" data-act="acct-open" data-mode="signup">Create a free account</button></div>`;
    }
    setTimeout(() => refresh(false), 0);
    const L = list();
    const rows = L.map(g => {
      const d = detail(g.id), t = g.kind === 'challenge' ? timing(d ? d.group : g) : null;
      return `<button class="li" data-act="grp-open" data-id="${g.id}"><span class="ni">${icon(g.kind === 'family' ? 'home' : 'trophy', 20)}</span>
        <span class="grow"><span class="t">${esc(g.name)}</span><br><span class="d">${esc(summary(g))}</span></span>
        ${g.new_cheers ? `<span class="tag fuel">${icon('heart', 12)} ${g.new_cheers}</span>` : t && t.state === 'live' ? `<span class="tag train">Live</span>` : ''}<span class="chev">${icon('chevR', 18)}</span></button>`;
    }).join('');
    return `<div class="card" id="together"><div class="card-head"><span class="eyebrow">Family &amp; challenges</span>${icon('trophy', 18, 'style="color:var(--fuel)"')}</div>
      ${L.length ? `<div class="list">${rows}</div>` : `<p class="small muted" style="margin:0">Track progress together with your family, or challenge friends and family to a weight-loss or muscle-building competition with a leaderboard.</p>`}
      <div class="row wrap" style="gap:8px">${L.length ? `<button class="btn ghost sm" data-act="grp-new">${icon('plus', 16)} Start one</button>` : `<button class="btn train sm" data-act="grp-create" data-kind="family">${icon('home', 16)} Start a family</button><button class="btn train sm" data-act="grp-create" data-kind="challenge">${icon('trophy', 16)} Start a challenge</button>`}<button class="btn ghost sm" data-act="grp-join">Join with a code</button></div></div>`;
  }
  /* Today: one quiet line per live challenge. */
  function todayLine() {
    if (!can() || !Cloud.signedIn()) return '';
    setTimeout(() => refresh(false), 0);
    return list().filter(g => g.kind === 'challenge' && !g.ended).map(g => {
      const d = detail(g.id), me = meRow(d); if (!d || !me) return '';
      const t = timing(d.group); if (!t || t.state !== 'live') return '';
      const s = score(me, g.metric);
      return `<button class="card li" style="flex-direction:row;gap:12px;padding:12px 14px" data-act="grp-open" data-id="${g.id}"><span class="ni">${icon('trophy', 20, 'style="color:var(--fuel)"')}</span>
        <span class="grow"><span class="t">${esc(g.name)}</span><br><span class="d">${me.rank ? `You're ${ord(me.rank)} of ${d.members.length}` : 'Not scored yet'} · ${s.big !== '—' ? esc(s.big + ' ' + s.sub.split(' · ')[0]) + ' · ' : ''}${t.left} day${t.left === 1 ? '' : 's'} left</span></span><span class="chev">${icon('chevR', 18)}</span></button>`;
    }).join('');
  }

  /* ---------- the group screen ---------- */
  function medal(rank) {
    const c = rank === 1 ? 'var(--fuel)' : rank === 2 ? 'var(--ink-3)' : rank === 3 ? '#b07a4a' : null;
    return `<span class="grp-rank" style="${c ? `background:color-mix(in srgb, ${c} 18%, transparent);color:${c}` : ''}">${rank && rank <= 3 ? icon('trophy', 16) : rank ? rank : '–'}</span>`;
  }
  function board(d) {
    const g = d.group, t = timing(g);
    const rows = d.members.map(m => {
      const s = score(m, g.metric);
      return `<div class="li grp-row${m.is_me ? ' me' : ''}">${medal(t.state === 'soon' ? null : m.rank)}
        <span class="grow"><span class="t">${esc(m.name)}${m.is_me ? ' <span class="faint small">(you)</span>' : ''}</span><br><span class="d">${esc(s.sub || '')}</span></span>
        <b class="num" style="font-size:18px">${esc(s.big)}</b>
        ${m.is_me ? '' : `<button class="icon-btn cheer${m.cheered ? ' on' : ''}" data-act="grp-cheer" data-to="${m.user_id}" data-ref="board" aria-pressed="${m.cheered}" aria-label="Cheer ${esc(m.name)}">${icon('flame', 18)}${m.cheers ? `<span class="tiny">${m.cheers}</span>` : ''}</button>`}</div>`;
    }).join('');
    const leader = d.members.find(m => m.rank === 1);
    return `${t.state === 'ended' && leader ? `<div class="card fuel" style="box-shadow:none;flex-direction:row;align-items:center;gap:12px"><span class="grp-rank big" style="background:var(--fuel-soft);color:var(--fuel)">${icon('trophy', 22)}</span><div><div class="h3">${(() => { const top = d.members.filter(m => m.rank === 1).map(m => m.is_me ? 'You' : m.name); return esc(top.length > 1 ? top.slice(0, -1).join(', ') + ' and ' + top[top.length - 1] + ' tied for first' : (top[0] === 'You' ? 'You won!' : top[0] + ' won')); })()}</div><div class="small muted">${esc(score(leader, g.metric).big + ' ' + score(leader, g.metric).sub)}</div></div></div>` : ''}
      <div class="card" style="box-shadow:none;gap:6px"><div class="card-head"><span class="eyebrow">Leaderboard</span><span class="small faint">${esc(t.label)}</span></div>
        ${t.state !== 'ended' ? `<div class="tbar"><i style="width:${t.pct}%;background:var(--train)"></i></div>` : ''}
        <div class="list">${rows}</div>
        <p class="tiny faint" style="margin:0">${esc(GROUP_METRICS[g.metric].desc)}</p></div>`;
  }
  function family(d) {
    const g = d.group, goal = g.weekly_goal, done = g.team_week;
    const rows = d.members.map(m => {
      const trend = m.trend_pct != null ? `${m.trend_pct < 0 ? '↓' : m.trend_pct > 0 ? '↑' : ''}${fmt1(Math.abs(m.trend_pct))}%${m.trend_lbs != null ? ` (${fmt1(Math.abs(m.trend_lbs))} lb)` : ''} in 30 days` : '';
      const bits = [`${m.workouts_week} workout${m.workouts_week === 1 ? '' : 's'} this week`, m.streak > 1 ? `${m.streak}-day streak` : '', trend].filter(Boolean);
      return `<div class="li grp-row${m.is_me ? ' me' : ''}"><span class="grp-rank">${esc((m.name || '?').trim().charAt(0).toUpperCase())}</span>
        <span class="grow"><span class="t">${esc(m.name)}${m.is_me ? ' <span class="faint small">(you)</span>' : ''}</span><br><span class="d">${esc(bits.join(' · '))}</span></span>
        ${m.streak > 2 ? `<span class="tag fuel">${icon('flame', 12)} ${m.streak}</span>` : ''}</div>`;
    }).join('');
    return `${goal ? `<div class="card train" style="box-shadow:none;gap:6px"><div class="card-head"><span class="eyebrow">Team goal this week</span><b class="num">${done} / ${goal}</b></div>
        <div class="tbar"><i style="width:${Math.min(100, done / goal * 100)}%;background:var(--train)"></i></div>
        <div class="small muted">${done >= goal ? 'Goal reached. Nice work, everyone.' : `${goal - done} more workout${goal - done === 1 ? '' : 's'} to go, together.`}</div></div>` : ''}
      <div class="card" style="box-shadow:none;gap:6px"><span class="eyebrow">Everyone</span><div class="list">${rows}</div></div>`;
  }
  function feed(d) {
    if (!d.feed.length) return `<div class="card" style="box-shadow:none"><span class="eyebrow">Recent workouts</span><p class="small muted" style="margin:0">Workouts people finish show up here so you can cheer them on.</p></div>`;
    return `<div class="card" style="box-shadow:none;gap:6px"><span class="eyebrow">Recent workouts</span><div class="list">${d.feed.map(f => `<div class="li">
        <span class="grow"><span class="t">${esc(f.is_me ? 'You' : f.who)} · ${esc(f.name)}</span><br><span class="d">${esc(prettyDate(f.day))}${f.minutes ? ` · ${f.minutes} min` : ''}${f.prs ? ` · ${f.prs} PR${f.prs > 1 ? 's' : ''}` : ''}</span></span>
        ${f.is_me ? (f.cheers ? `<span class="tag fuel">${icon('heart', 12)} ${f.cheers}</span>` : '') : `<button class="icon-btn cheer${f.cheered ? ' on' : ''}" data-act="grp-cheer" data-to="${f.user_id}" data-ref="${esc(f.ref)}" aria-pressed="${f.cheered}" aria-label="Cheer this workout">${icon('heart', 18)}${f.cheers ? `<span class="tiny">${f.cheers}</span>` : ''}</button>`}</div>`).join('')}</div></div>`;
  }
  function settingsPart(s, d) {
    const g = d.group, me = meRow(d) || {};
    const weighty = g.kind === 'family' || g.metric === 'weight_loss';
    return `<div class="card" style="box-shadow:none;gap:8px"><span class="eyebrow">Invite people</span>
        <b class="num" style="font-size:26px;letter-spacing:.14em">${esc(g.code)}</b>
        <div class="grid2"><button class="btn train sm" data-act="grp-share">${icon('share', 16)} Share invite</button><button class="btn ghost sm" data-act="grp-copy">${icon('copy', 16)} Copy link</button></div>
        <p class="tiny faint" style="margin:0">They'll need the Movla app or movla.app and a free account. Up to 30 people.</p></div>
      <div class="card" style="box-shadow:none;gap:8px"><span class="eyebrow">You in this ${g.kind}</span>
        <div class="row" style="gap:8px"><input class="input grow" id="grp-myname" data-gf="myname" maxlength="30" value="${esc(typed(s, 'myname', me.name || ''))}" aria-label="Your name in this group"><button class="btn ghost sm" data-act="grp-rename-me">Save</button></div>
        ${g.kind === 'family' ? `<div class="toggle"><span class="small"><b>Share my weight trend</b><br><span class="faint">As a percent over 30 days. Your weight itself is never shown.</span></span><button class="switch" role="switch" aria-checked="${!!me.share_weight}" data-act="grp-pref" data-k="p_share_weight" data-v="${!me.share_weight}" aria-label="Share my weight trend"></button></div>` : ''}
        ${weighty ? `<div class="toggle"><span class="small"><b>Show pounds too</b><br><span class="faint">Others see pounds ${g.kind === 'family' ? 'gained or lost' : 'lost'} next to the percent. Off: percent only.</span></span><button class="switch" role="switch" aria-checked="${!!me.show_lbs}" data-act="grp-pref" data-k="p_show_lbs" data-v="${!me.show_lbs}" aria-label="Show pounds too"></button></div>` : ''}
        <p class="tiny faint" style="margin:0">What others here see: your name, workouts you finish (name and length), how many days you log, your streak${g.kind === 'challenge' ? ' and your score' : ''}. Never your weight, food, notes or anything else.</p></div>
      ${g.is_owner ? manage(s, d) : ''}
      <button class="btn ghost block" data-act="grp-leave">Leave ${esc(g.kind === 'family' ? 'family' : 'challenge')}</button>`;
  }
  function manage(s, d) {
    const g = d.group;
    if (!s.manage) return `<button class="link" data-act="grp-manage" style="align-self:center">Manage ${g.kind === 'family' ? 'family' : 'challenge'}</button>`;
    const others = d.members.filter(m => !m.is_me);
    return `<div class="card" style="box-shadow:none;gap:10px"><span class="eyebrow">Manage</span>
      <div class="field"><label for="grp-name">Name</label><input class="input" id="grp-name" data-gf="name" maxlength="40" value="${esc(typed(s, 'name', g.name))}"></div>
      ${g.kind === 'family' ? `<div class="field"><label for="grp-goal">Weekly team goal <span class="faint">(workouts, all of you together)</span></label><input class="input" id="grp-goal" data-gf="goal" inputmode="numeric" placeholder="None" value="${esc(typed(s, 'goal', g.weekly_goal || ''))}"></div>`
        : !g.ended ? `<div class="field"><label for="grp-end">End date</label><input class="input" id="grp-end" type="date" min="${addDays(todayKey(), 0) > g.starts_on ? todayKey() : addDays(g.starts_on, 1)}" data-gf="end" value="${esc(typed(s, 'end', g.ends_on))}"></div>` : ''}
      <button class="btn train block" data-act="grp-save">Save changes</button>
      ${others.length ? `<div class="list">${others.map(m => `<div class="li"><span class="grow">${esc(m.name)}</span><button class="btn ghost xs sm" data-act="grp-remove" data-id="${m.user_id}" data-name="${esc(m.name)}">Remove</button></div>`).join('')}</div>` : ''}
      <div class="row wrap" style="gap:8px"><button class="btn ghost sm" data-act="grp-newcode">New invite code</button>${g.kind === 'challenge' && !g.ended ? `<button class="btn ghost sm" data-act="grp-end">End challenge now</button>` : ''}<button class="btn danger sm" data-act="grp-delete">Delete</button></div></div>`;
  }

  SHEETS.group = s => {
    const d = detail(s.id), g0 = list().find(x => x.id === s.id);
    if (!d) { loadDetail(s.id); return sheetHead(esc(g0 ? g0.name : 'Loading…'), '') + `<div class="empty">${icon('timer', 26)}<span>Loading…</span></div>`; }
    const g = d.group;
    if (!s.fresh) { s.fresh = true; loadDetail(s.id, true); }
    const sub = g.kind === 'family' ? `Family · ${d.members.length} ${d.members.length === 1 ? 'person' : 'people'}` : `${GROUP_METRICS[g.metric].name} challenge · ${shortDate(g.starts_on)} – ${shortDate(g.ends_on)}`;
    const tab = s.tab || 'main';
    return sheetHead(esc(g.name), sub)
      + `<div class="seg"><button data-act="grp-tab" data-v="main" aria-pressed="${tab === 'main'}">${g.kind === 'family' ? 'Family' : 'Leaderboard'}</button><button data-act="grp-tab" data-v="feed" aria-pressed="${tab === 'feed'}">Workouts</button><button data-act="grp-tab" data-v="settings" aria-pressed="${tab === 'settings'}">Invite &amp; settings</button></div>`
      + (s.msg ? `<p class="small" role="status" style="margin:0;color:var(--train)">${esc(s.msg)}</p>` : '')
      + (tab === 'feed' ? feed(d) : tab === 'settings' ? settingsPart(s, d) : (g.kind === 'family' ? family(d) : board(d)) + (d.members.length < 2 ? `<button class="btn train block" data-act="grp-tab" data-v="settings">${icon('share', 18)} Invite people</button>` : ''));
  };

  /* ---------- create ---------- */
  SHEETS.groupNew = () => sheetHead('Start something together', '')
    + `<div class="opts"><button class="opt" data-act="grp-create" data-kind="family"><span class="ni">${icon('home', 20)}</span><span class="grow"><span class="t">Family</span><br><span class="d">See each other's workouts and streaks, cheer each other on, and share a weekly goal.</span></span>${icon('chevR', 18)}</button>
      <button class="opt" data-act="grp-create" data-kind="challenge"><span class="ni">${icon('trophy', 20)}</span><span class="grow"><span class="t">Challenge</span><br><span class="d">A competition with friends or family: weight loss, body fat, strength or consistency, with a leaderboard.</span></span>${icon('chevR', 18)}</button></div>`;

  SHEETS.groupCreate = s => {
    const d = s.draft, fam = s.kind === 'family';
    if (s.created) {
      return sheetHead(fam ? 'Family started' : 'Challenge created', 'Now invite people')
        + `<div class="card train" style="box-shadow:none;align-items:center;gap:6px"><span class="small muted">Invite code</span><b class="num" style="font-size:30px;letter-spacing:.14em">${esc(s.created.code)}</b></div>
          <button class="btn train block" data-act="grp-share" data-code="${esc(s.created.code)}" data-name="${esc(d.name)}">${icon('share', 18)} Share invite</button>
          <button class="btn ghost block" data-act="grp-copy" data-code="${esc(s.created.code)}">${icon('copy', 18)} Copy link</button>
          <button class="btn ghost block" data-act="grp-open" data-id="${s.created.id}" data-fresh="1">Open ${fam ? 'family' : 'challenge'}</button>`;
    }
    const weeks = [[4, '4 weeks'], [8, '8 weeks'], [12, '12 weeks']];
    return sheetHead(fam ? 'Start a family' : 'Start a challenge', fam ? 'Track progress together' : 'You pick what counts')
      + `<div class="field"><label for="gc-name">Name</label><input class="input" id="gc-name" maxlength="40" data-gcx="name" placeholder="${fam ? 'The Smiths' : 'Fall Shred'}" value="${esc(d.name || '')}"></div>
      ${fam ? `<div class="field"><label for="gc-goal">Weekly team goal <span class="faint">(optional)</span></label><input class="input" id="gc-goal" inputmode="numeric" data-gcx="goal" placeholder="e.g. 10 workouts a week, all of you together" value="${esc(d.goal || '')}"></div>`
      : `<div class="field"><span class="label">What counts?</span><div class="opts">${Object.entries(GROUP_METRICS).map(([k, m]) => `<button class="opt" data-act="gc-metric" data-v="${k}" aria-pressed="${d.metric === k}"><span class="ni">${icon(m.icon, 20)}</span><span class="grow"><span class="t">${m.name}</span><br><span class="d">${m.desc}</span></span>${d.metric === k ? icon('check', 18) : ''}</button>`).join('')}</div></div>
        <div class="field"><label for="gc-start">Starts</label><input class="input" id="gc-start" type="date" data-gcx="start" min="${addDays(todayKey(), -7)}" value="${esc(d.start || todayKey())}"></div>
        <div class="field"><span class="label">How long?</span><div class="seg">${weeks.map(([w, l]) => `<button data-act="gc-weeks" data-v="${w}" aria-pressed="${Number(d.weeks || 8) === w}">${l}</button>`).join('')}</div>
          <div class="small faint">Ends ${prettyDate(addDays(d.start || todayKey(), (Number(d.weeks) || 8) * 7 - 1))}</div></div>`}
      <div class="field"><label for="gc-me">Your name here</label><input class="input" id="gc-me" maxlength="30" data-gcx="me" placeholder="How others will see you" value="${esc(d.me != null ? d.me : (S.profile && S.profile.name) || '')}"></div>
      ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
      <button class="btn train block" data-act="gc-save" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Creating…' : fam ? 'Start family' : 'Create challenge'}</button>
      <p class="tiny faint" style="margin:0">Members see names, finished workouts, logging streaks${fam ? ' and, if each person allows it, weight trend as a percent' : ' and scores'}. Nobody sees anyone's actual weight, food or other details.</p>`;
  };

  /* ---------- join ---------- */
  SHEETS.groupJoin = s => {
    if (!Cloud.signedIn()) {
      return sheetHead('Join a family or challenge', '')
        + `<p class="muted" style="margin:0">You'll need a free Movla account so the group can see your progress. Your code is saved; you'll come right back here.</p>
          <button class="btn train block" data-act="acct-open" data-mode="signup">Create a free account</button><button class="btn ghost block" data-act="acct-open" data-mode="signin">Sign in</button>`;
    }
    const p = s.preview;
    if (!p) {
      return sheetHead('Join with a code', 'Ask whoever started it for their 8-character code')
        + `<div class="field"><label for="gj-code">Code</label><input class="input big" id="gj-code" maxlength="8" autocapitalize="characters" autocomplete="off" spellcheck="false" style="letter-spacing:.14em;text-transform:uppercase" data-gf="code" value="${esc(typed(s, 'code', s.code || ''))}"></div>
          ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
          <button class="btn train block" data-act="gj-look" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Checking…' : 'Next'}</button>`;
    }
    const fam = p.kind === 'family';
    return sheetHead(esc(p.name), fam ? `Family · started by ${esc(p.owner || 'someone')}` : `${GROUP_METRICS[p.metric].name} challenge · ${shortDate(p.starts_on)} – ${shortDate(p.ends_on)}`)
      + `<div class="card" style="box-shadow:none;gap:6px"><span class="small">${p.members} ${p.members === 1 ? 'person' : 'people'} so far${fam ? '' : ` · started by ${esc(p.owner || 'someone')}`}</span>
          ${fam ? '' : `<span class="small muted">${esc(GROUP_METRICS[p.metric].desc)}</span>`}</div>
        ${p.joined ? `<p class="small muted" style="margin:0">You're already in this ${fam ? 'family' : 'challenge'}.</p><button class="btn train block" data-act="grp-open" data-id="${p.id}">Open it</button>`
        : p.ended ? `<p class="small" style="margin:0;color:var(--bad)">This challenge has ended.</p>`
        : `<div class="field"><label for="gj-me">Your name here</label><input class="input" id="gj-me" data-gf="me" maxlength="30" value="${esc(typed(s, 'me', (S.profile && S.profile.name) || ''))}"></div>
          <p class="tiny faint" style="margin:0">They'll see your name, workouts you finish (name and length), how many days you log and your streak${fam ? ', plus your weight trend as a percent (you can turn that off)' : ' and your score'}. Never your weight, food or anything else. You can leave any time.</p>
          ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
          <button class="btn train block" data-act="gj-join" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Joining…' : 'Join ' + (fam ? 'family' : 'challenge')}</button>`}
        <button class="link muted" data-act="gj-back" style="align-self:center">Use a different code</button>`;
  };

  /* ---------- actions ---------- */
  const err = e => (e && e.message) || 'Couldn\'t reach the server. Try again.';
  const cur = () => UI.sheet && UI.sheet.type === 'group' ? UI.sheet : null;
  async function act(fn, body, okMsg, reload = true) {
    const s = cur();
    try { await rpc(fn, body); if (s) { s.msg = okMsg || ''; s.f = {}; } if (reload && s) await loadDetail(s.id, true, true); await refresh(true); if (okMsg && !s) toast(okMsg); }
    catch (e) { toast(err(e)); }
    render();
  }
  function share(code, name) {
    const url = inviteLink(code), text = `Join ${name ? '"' + name + '" ' : 'me '}on Movla. Code ${code}: ${url}`;
    if (navigator.share) navigator.share({ title: 'Join me on Movla', text, url }).catch(() => { /* cancelled */ });
    else copy(url, 'Invite link copied');
  }
  function copy(txt, msg) { try { navigator.clipboard.writeText(txt).then(() => toast(msg || 'Copied'), () => toast(txt)); } catch (e) { toast(txt); } }
  const groupOf = () => { const s = cur(); return s && detail(s.id) ? detail(s.id).group : null; };

  Object.assign(ACT, {
    'grp-new': () => pushSheet({ type: 'groupNew' }),
    'grp-create': t => { const sheet = { type: 'groupCreate', kind: t.dataset.kind, draft: { weeks: 8 }, tall: true }; if (UI.sheet && UI.sheet.type === 'groupNew') { UI.sheet = sheet; render(); } else pushSheet(sheet); },
    'grp-join': () => pushSheet({ type: 'groupJoin' }),
    'grp-open': t => { const sheet = { type: 'group', id: t.dataset.id, tall: true }; if (UI.sheet && /^group(Create|Join)$/.test(UI.sheet.type)) { UI.stack = []; UI.sheet = sheet; render(); } else pushSheet(sheet); },
    'grp-tab': t => { const s = cur(); s.tab = t.dataset.v; s.msg = ''; render(); },
    'grp-manage': () => { cur().manage = true; render(); },
    'gc-metric': t => { UI.sheet.draft.metric = t.dataset.v; UI.sheet.error = ''; render(); },
    'gc-weeks': t => { UI.sheet.draft.weeks = Number(t.dataset.v); render(); },
    'gc-save': async () => {
      const s = UI.sheet, d = s.draft, fam = s.kind === 'family';
      const name = (d.name || '').trim();
      if (!name) { s.error = 'Give it a name.'; render(); return; }
      if (!fam && !d.metric) { s.error = 'Choose what counts.'; render(); return; }
      const goal = fam && d.goal ? parseInt(d.goal, 10) : null;
      if (fam && d.goal && !(goal >= 1 && goal <= 200)) { s.error = 'The weekly goal should be between 1 and 200 workouts.'; render(); return; }
      const start = d.start || todayKey();
      s.busy = true; s.error = ''; render();
      try {
        s.created = await rpc('group_create', { p_kind: s.kind, p_name: name, p_metric: fam ? null : d.metric, p_starts: fam ? null : start, p_ends: fam ? null : addDays(start, (Number(d.weeks) || 8) * 7 - 1), p_goal: goal, p_display: (d.me || (S.profile && S.profile.name) || '').trim() || null });
        refresh(true);
      } catch (e) { s.error = err(e); }
      s.busy = false; render();
    },
    'gj-look': async () => {
      const s = UI.sheet, code = (val('gj-code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      s.code = code;
      if (code.length !== 8) { s.error = 'Codes are 8 letters and numbers.'; render(); return; }
      s.busy = true; s.error = ''; render();
      try { const p = await rpc('group_preview', { p_code: code }); if (!p) s.error = 'That code didn\'t match a family or challenge.'; else s.preview = p; }
      catch (e) { s.error = err(e); }
      s.busy = false; render();
    },
    'gj-back': () => { const s = UI.sheet; s.preview = null; s.error = ''; render(); },
    'gj-join': async () => {
      const s = UI.sheet; s.busy = true; s.error = ''; render();
      try {
        const id = await rpc('group_join', { p_code: s.code, p_display: (val('gj-me') || '').trim() || null });
        store.set(PENDING, null); await refresh(true);
        UI.stack = []; UI.sheet = { type: 'group', id, tall: true }; render(); toast(`You joined ${s.preview.name}`); return;
      } catch (e) { s.error = err(e); }
      s.busy = false; render();
    },
    'grp-cheer': async t => {
      const s = cur(), d = s && detail(s.id); if (!d) return;
      const ref = t.dataset.ref, to = t.dataset.to;
      // Flip it on screen right away; the server answer replaces it.
      const item = ref === 'board' ? d.members.find(m => m.user_id === to) : d.feed.find(f => f.ref === ref && f.user_id === to);
      if (item) { item.cheered = !item.cheered; item.cheers = Math.max(0, (item.cheers || 0) + (item.cheered ? 1 : -1)); render(); }
      try { await rpc('group_cheer', { p_group: s.id, p_to: to, p_ref: ref, p_emoji: ref === 'board' ? 'fire' : 'clap' }); loadDetail(s.id, true); }
      catch (e) { toast(err(e)); loadDetail(s.id, true); }
    },
    'grp-share': t => { const g = groupOf(); share(t.dataset.code || g.code, t.dataset.name || (g && g.name)); },
    'grp-copy': t => { const g = groupOf(); copy(inviteLink(t.dataset.code || g.code), 'Invite link copied'); },
    'grp-rename-me': () => { const v = (val('grp-myname') || '').trim(); if (!v) return; act('group_prefs', { p_group: cur().id, p_display: v }, 'Name saved'); },
    'grp-pref': t => act('group_prefs', { p_group: cur().id, [t.dataset.k]: t.dataset.v === 'true' }, ''),
    'grp-save': () => {
      const s = cur(), g = groupOf(), body = { p_group: s.id, p_name: (val('grp-name') || '').trim() || null };
      if (g.kind === 'family') { const v = (val('grp-goal') || '').trim(); if (v) { const n = parseInt(v, 10); if (!(n >= 1 && n <= 200)) { toast('Goal should be 1 to 200'); return; } body.p_goal = n; } else body.p_clear_goal = true; }
      else if (document.getElementById('grp-end')) body.p_ends = val('grp-end') || null;
      act('group_update', body, 'Saved');
    },
    'grp-newcode': () => act('group_new_code', { p_group: cur().id }, 'New code made. The old one no longer works.'),
    'grp-remove': t => { const id = cur().id; confirmSheet(`Remove ${t.dataset.name}?`, 'They\'ll leave this group and can rejoin only with the invite code.', 'Remove', async () => { await act('group_remove', { p_group: id, p_user: t.dataset.id }, ''); pushSheet({ type: 'group', id, tall: true, tab: 'settings', manage: true }); }, true); },
    'grp-end': () => { const id = cur().id; confirmSheet('End the challenge now?', 'Scores lock in as of today and the leaderboard shows final results.', 'End challenge', async () => { await act('group_end', { p_group: id }, ''); pushSheet({ type: 'group', id, tall: true }); }, true); },
    'grp-delete': () => { const id = cur().id, g = groupOf(); confirmSheet(`Delete ${g.name}?`, 'This removes it for everyone. Their own workouts and data stay in their apps.', 'Delete', async () => { await act('group_delete', { p_group: id }, 'Deleted', false); }, true); },
    'grp-leave': () => { const id = cur().id, g = groupOf(); confirmSheet(`Leave ${g.name}?`, g.is_owner ? 'The person who joined next takes over as organizer. If you\'re the only one here, it\'s deleted.' : 'You can rejoin with the invite code.', 'Leave', async () => { await act('group_leave', { p_group: id }, 'You left', false); }, true); },
  });
  document.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.gf && UI.sheet) { (UI.sheet.f = UI.sheet.f || {})[t.dataset.gf] = t.value; } });
  document.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.gcx && UI.sheet && UI.sheet.type === 'groupCreate') { UI.sheet.draft[t.dataset.gcx] = t.value; if (t.dataset.gcx === 'start') render(); } });

  /* ---------- invite links: ?group=CODE or movla://group/CODE ---------- */
  const codeFrom = s => { const m = String(s || '').match(/group[/=:]+([A-Za-z0-9]{8})\b/); return m ? m[1].toUpperCase() : null; };
  async function resume() {
    const code = store.get(PENDING);
    if (!code || !can() || !Cloud.signedIn() || (UI.sheet && UI.sheet.type === 'groupJoin' && UI.sheet.preview)) return;
    if (!S.onboarded) return;
    UI.stack = []; UI.sheet = { type: 'groupJoin', code, busy: true }; render();
    try { const p = await rpc('group_preview', { p_code: code }); if (p) UI.sheet.preview = p; else UI.sheet.error = 'That invite code no longer works.'; }
    catch (e) { UI.sheet.error = err(e); }
    store.set(PENDING, null); UI.sheet.busy = false; render();
  }
  function openCode(code) {
    store.set(PENDING, code);
    if (Cloud.signedIn()) resume();
    else if (S.onboarded) { UI.stack = []; UI.sheet = { type: 'groupJoin', code }; render(); }
  }
  function boot() {
    if (!can()) return;
    try {
      const q = new URLSearchParams(location.search), c = codeFrom('group=' + (q.get('group') || ''));
      if (c) { q.delete('group'); const qs = q.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); setTimeout(() => openCode(c), 400); }
      else if (store.get(PENDING)) setTimeout(resume, 800);
    } catch (e) { /* ignore */ }
    if (typeof Native !== 'undefined' && Native.isNative && Native.listen) Native.listen('App', 'appUrlOpen', ev => { const c = codeFrom(ev && ev.url); if (c) openCode(c); });
    // Back from signing up or in: pick the invite up again.
    const after = Cloud.afterSignIn;
    Cloud.afterSignIn = async (...a) => { const r = await after(...a); setTimeout(() => { resume(); refresh(true); }, 300); return r; };
  }

  return { card, todayLine, refresh, boot, available, list, detail, inviteLink };
})();

/* Progress: the card sits right under the heading. Today: a line per live challenge, at the bottom. */
{
  const progress = viewProgress;
  viewProgress = () => {
    const html = progress(), c = Groups.card();
    if (!c) return html;
    const at = html.indexOf('</h1></div>');
    return at < 0 ? html + c : html.slice(0, at + 11) + c + html.slice(at + 11);
  };
  const today = viewToday;
  viewToday = () => today() + Groups.todayLine();
}
Groups.boot();
