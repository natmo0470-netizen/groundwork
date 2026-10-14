/* Groundwork — Coach tools (file-based until cloud sync in Phase 5).
   Coach: turns on Coach mode, gets a Clients tab with a seat limit by plan, invites clients,
   assigns programs / their own workouts / macro targets, and reads clients' progress updates.
   Client: joins a coach with an invite, receives plans, and sends weekly updates.
   Everything travels as small files (or pasteable text) through the share sheet, email or
   messages. After the invite, files are encrypted with a key only the coach and that client hold.
   File envelope: { gw: 'coach', v: 1, type: 'invite' | 'assign' | 'update', coachId, clientId, ... } */

const COACH_PLANS = [
  { id: 'starter', name: 'Starter', seats: 10, price: '$25/mo' },
  { id: 'pro', name: 'Pro', seats: 30, price: '$55/mo' },
  { id: 'studio', name: 'Studio', seats: 75, price: '$99/mo' },
];
const coachOn = () => !!(S.coachMode && S.coachMode.on);
const coachPlan = () => COACH_PLANS.find(p => p.id === (S.coachMode && S.coachMode.plan)) || COACH_PLANS[0];
const clients = () => (S.coachMode && S.coachMode.clients) || [];
const findClient = id => clients().find(c => c.id === id);
function ago(k) { if (!k) return 'never'; const d = daysBetween(k, todayKey()); return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`; }

/* ================= files ================= */
async function sendCoachFile(obj, fileBase, label) {
  const text = JSON.stringify(obj);
  UI.lastCoachText = 'GWC1:' + btoa(unescape(encodeURIComponent(text)));
  const name = `${fileBase}-${todayKey()}.gwcoach.json`;
  try {
    if (typeof Native !== 'undefined' && Native.isNative) await Native.shareFile(name, text, label);
    else {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    return true;
  } catch (e) { return false; }
}
function parseCoachText(text) {
  text = (text || '').trim();
  if (text.startsWith('GWC1:')) text = decodeURIComponent(escape(atob(text.slice(5))));
  const o = JSON.parse(text);
  if (!o || o.gw !== 'coach') throw new Error('not a coach file');
  return o;
}
async function sealFor(type, coachId, clientId, key, payload) {
  const base = { gw: 'coach', v: 1, type, coachId, clientId };
  if (key && GWCrypto.ok()) return GWCrypto.withKey(payload, key, Object.assign(base, { enc: 'aes-gcm' }));
  return Object.assign(base, { payload });
}
async function unseal(o, key) { return o.enc ? GWCrypto.openKey(o, key) : o.payload; }

/* ================= client progress summary (what a client sends) ================= */
function buildUpdate(note) {
  const today = todayKey(), from28 = addDays(today, -27), from14 = addDays(today, -13);
  const T = calcTargets(S);
  const food = [];
  for (let i = 13; i >= 0; i--) { const k = addDays(today, -i), t = foodTotals(S, k); food.push({ date: k, kcal: Math.round(t.kcal), p: Math.round(t.p), logged: (S.foodLog[k] || []).length > 0 }); }
  let planned = 0, done = 0;
  for (let i = 0; i < 14; i++) { const k = addDays(from14, i); if (k > today) break; if (S.plan && k < S.plan.createdAt) { if (workoutDoneOn(S, k)) { planned++; done++; } continue; } if (workoutForDate(S, k)) { planned++; if (workoutDoneOn(S, k)) done++; } }
  return {
    name: S.profile.name || 'Client', sentAt: new Date().toISOString(), note: note || '',
    profile: { goal: S.profile.goal, experience: S.profile.experience, sex: S.profile.sex, age: S.profile.age, heightCm: S.profile.heightCm, units: S.profile.units },
    targets: { calories: T.calories, protein: T.protein, carbs: T.carbs, fat: T.fat },
    plan: S.plan ? { name: S.plan.split, days: S.schedule.days.length } : null,
    adherence: { planned, done },
    weights: S.weights.filter(w => w.date >= addDays(today, -59)),
    workouts: S.workouts.filter(w => w.date >= from28).map(w => ({ date: w.date, name: w.name, durationMin: w.durationMin, prs: (w.prs || []).length, sets: w.sets.map(s => [s.exId, Math.round((s.weightKg || 0) * 10) / 10, s.reps, s.rir == null ? null : s.rir, s.type || null]) })),
    food,
    checkins: S.checkins.slice(-4),
    measurements: (S.measurements || []).slice(-6),
    pain: (S.painLog || []).filter(p => p.date >= from28),
    safety: { needsClearance: typeof needsClearance === 'function' ? needsClearance(S.safety) : false, cleared: !!(S.safety && S.safety.cleared) },
  };
}
function clientFlags(d) {
  if (!d) return [];
  const f = [];
  if (d.adherence && d.adherence.planned && d.adherence.done / d.adherence.planned < 0.6) f.push(['Missed sessions', 'warn']);
  const logged = (d.food || []).filter(x => x.logged).slice(-7);
  if (logged.length >= 3 && d.targets) { const avg = logged.reduce((s, x) => s + x.kcal, 0) / logged.length; if (avg < d.targets.calories * 0.8) f.push(['Eating under target', 'warn']); }
  if (logged.length < 3) f.push(['Not logging food', '']);
  if ((d.pain || []).some(p => p.kind === 'sharp')) f.push(['Reported pain', 'warn']);
  if (d.safety && d.safety.needsClearance && !d.safety.cleared) f.push(['Needs doctor OK', 'warn']);
  return f;
}
function weightTrend(d) {
  const w = (d && d.weights) || []; if (w.length < 2) return null;
  const last = w.slice(-3), first = w.filter(x => x.date <= addDays(w[w.length - 1].date, -21)).slice(-3);
  if (!first.length) return null;
  const avg = a => a.reduce((s, x) => s + x.kg, 0) / a.length;
  return avg(last) - avg(first);
}

/* ================= Clients tab (coach) ================= */
function viewClients() {
  const list = clients(), plan = coachPlan();
  return `<div class="stack" style="gap:2px"><span class="eyebrow">Coaching</span><h1 class="h1">Your clients</h1></div>
    <div class="card train"><div class="card-head"><span class="eyebrow">${esc(S.coachMode.name || 'Coach')} · ${plan.name} plan</span><span class="tag train">${list.length} / ${plan.seats} seats</span></div>
      <div class="progress" style="height:6px"><i style="width:${Math.min(100, list.length / plan.seats * 100)}%"></i></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn train sm" data-act="coach-add">${icon('plus', 16)} Add client</button><button class="btn ghost sm" data-act="coach-import">${icon('download', 16)} Open a client update</button><button class="btn ghost sm" data-act="coach-plan">Seats</button></div></div>
    ${list.length ? list.map(c => { const d = c.data, fl = clientFlags(d), tr = weightTrend(d);
      return `<button class="card client-card" data-act="client-open" data-id="${c.id}" style="text-align:left">
        <div class="row between"><div><div class="h3">${esc(c.name)}</div><div class="small muted">${d ? `Update ${ago(d.sentAt.slice(0, 10))}` : c.linked ? 'Linked · waiting for first update' : 'Invite sent'}${d && d.plan ? ' · ' + esc(d.plan.name) : ''}</div></div><span class="chev">${icon('chevR', 18)}</span></div>
        ${d ? `<div class="stats"><div class="stat"><div class="v">${d.adherence.done}/${d.adherence.planned}</div><div class="k">Sessions 2 wk</div></div><div class="stat"><div class="v">${tr == null ? '—' : (tr > 0 ? '+' : '') + kgToDisp(S, tr)}</div><div class="k">Weight 3 wk (${wUnit(S)})</div></div><div class="stat"><div class="v">${(() => { const l = d.food.filter(x => x.logged).slice(-7); return l.length ? fmtInt(l.reduce((s, x) => s + x.kcal, 0) / l.length) : '—'; })()}</div><div class="k">Avg kcal</div></div></div>` : ''}
        ${fl.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${fl.map(([t, k]) => `<span class="tag ${k === 'warn' ? 'fuel' : ''}">${t}</span>`).join('')}</div>` : ''}
      </button>`; }).join('')
      : `<div class="card"><div class="empty">${icon('user', 28)}<span>Add your first client. They join with an invite file, then send you weekly updates.</span><button class="btn ghost sm" data-act="coach-sample">Try it with a sample client</button></div></div>`}
    <p class="tiny faint">Client data arrives only when a client sends you an update, and is stored on this device. Live sync arrives with accounts in a later version.</p>`;
}

/* ================= sheets ================= */
Object.assign(SHEETS, {
  coaching() {
    const c = S.coach;
    return sheetHead('Coaching', 'Work with a coach, or coach clients yourself')
      + `<div class="card" style="box-shadow:none"><span class="eyebrow">Your coach</span>
        ${c ? `<div class="row between"><div><div class="h3">${esc(c.name)}</div><div class="small muted">Linked ${shortDate(c.linkedAt)} · last update sent ${ago(c.lastSent)}</div></div></div>
          <button class="btn train block" data-act="client-send">${icon('share', 18)} Send update to ${esc(c.name.split(' ')[0])}</button>
          <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="client-import">Open a file from your coach</button><button class="btn danger sm" data-act="client-leave">Leave coach</button></div>`
        : `<p class="small muted" style="margin:0">Got an invite from a coach? Open it here to link up. Your coach can then send you plans and targets, and you send back weekly updates.</p><button class="btn ghost block" data-act="client-import">Open coach invite</button>`}</div>
      <div class="card" style="box-shadow:none"><span class="eyebrow">Coach mode</span>
        <div class="toggle"><span class="small"><b>I'm a coach</b><br><span class="faint">Adds a Clients tab to manage clients, assign programs and macros, and review their progress.</span></span><button class="switch" role="switch" aria-checked="${coachOn()}" data-act="coach-toggle" aria-label="Coach mode"></button></div>
        ${coachOn() ? `<div class="field"><label for="coach-name">Your name (shown to clients)</label><input class="input" id="coach-name" data-coachname value="${esc(S.coachMode.name || '')}"></div>` : ''}</div>`;
  },
  coachPlan() {
    const cur = coachPlan();
    return sheetHead('Coach plans', 'Pay per client seat; clients use Groundwork free while linked')
      + `<div class="list">${COACH_PLANS.map(p => `<button class="li" data-act="coach-plan-pick" data-id="${p.id}"><span class="grow"><span class="t">${p.name} · up to ${p.seats} clients</span><br><span class="d">${p.price}</span></span>${cur.id === p.id ? '<span class="tag train">Current</span>' : `<span class="chev">${icon('chevR', 18)}</span>`}</button>`).join('')}</div>
      <p class="tiny faint">Billing isn't switched on in this test version, so any plan can be tried free. Subscriptions start with the Pro launch.</p>`;
  },
  coachAdd(s) {
    const full = clients().length >= coachPlan().seats;
    return sheetHead('Add a client', full ? 'All seats are in use' : `${coachPlan().seats - clients().length} seats left`)
      + (full ? `<p class="muted">Your ${coachPlan().name} plan covers ${coachPlan().seats} clients. Move up a plan or remove a client to add another.</p><button class="btn train block" data-act="coach-plan">See plans</button>`
        : `<div class="field"><label for="ca-name">Client name</label><input class="input" id="ca-name" placeholder="e.g. Jordan"></div>
        <p class="small muted">Creates an invite file to send by text, email or AirDrop. Your client opens it in Groundwork → Settings → Coaching.</p>
        <button class="btn train block" data-act="coach-invite">${icon('share', 18)} Create and send invite</button>`);
  },
  client(s) {
    const c = findClient(s.id); if (!c) return sheetHead('Client', '');
    const d = c.data;
    const tabs = `<div class="seg">${[['overview', 'Overview'], ['training', 'Training'], ['food', 'Nutrition'], ['plan', 'Assign']].map(([k, l]) => `<button data-act="client-tab" data-v="${k}" aria-pressed="${(s.tab || 'overview') === k}">${l}</button>`).join('')}</div>`;
    let body = '';
    const tab = s.tab || 'overview';
    if (!d && tab !== 'plan') body = `<div class="empty">${icon('download', 26)}<span>No update yet. Ask ${esc(c.name)} to tap <b>Send update to coach</b>, then open the file here.</span></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="coach-reinvite" data-id="${c.id}">Resend invite</button><button class="btn ghost sm" data-act="coach-import">Open update</button></div>`;
    else if (tab === 'overview') {
      const fl = clientFlags(d), tr = weightTrend(d), pseudo = { weights: d.weights, profile: { units: S.profile.units } };
      body = `<div class="small muted">Update ${ago(d.sentAt.slice(0, 10))} · ${GOALS[d.profile.goal] ? GOALS[d.profile.goal].label : ''} · ${d.profile.age} y · ${esc(d.plan ? d.plan.name : 'no plan')}</div>
        ${fl.length ? `<div class="row" style="gap:6px;flex-wrap:wrap">${fl.map(([t, k]) => `<span class="tag ${k === 'warn' ? 'fuel' : ''}">${t}</span>`).join('')}</div>` : ''}
        ${d.note ? `<div class="banner">${icon('chat', 18)}<span><b>${esc(c.name)}:</b> ${esc(d.note)}</span></div>` : ''}
        <div class="stats"><div class="stat"><div class="v">${d.adherence.done}/${d.adherence.planned}</div><div class="k">Sessions 2 wk</div></div><div class="stat"><div class="v">${d.weights.length ? kgToDisp(S, d.weights[d.weights.length - 1].kg) : '—'}</div><div class="k">Weight (${wUnit(S)})</div></div><div class="stat"><div class="v">${tr == null ? '—' : (tr > 0 ? '+' : '') + kgToDisp(S, tr)}</div><div class="k">3-wk change</div></div></div>
        ${weightChart(pseudo, 60) || '<p class="small faint">Not enough weigh-ins for a chart yet.</p>'}
        ${d.measurements.length ? `<p class="small muted">Waist: ${d.measurements.filter(m => m.waist).map(m => `${cmToDisp(m.waist)} ${lenUnit()} (${shortDate(m.date)})`).slice(-3).join(' → ') || '—'}</p>` : ''}
        ${d.pain.length ? `<div class="stack" style="gap:4px"><span class="label">Pain reports</span>${d.pain.map(p => `<span class="small">${shortDate(p.date)} · ${esc(p.area)} · ${p.kind === 'sharp' ? 'sharp' : 'ache'} · ${esc((EX_BY_ID[p.exId] || {}).name || '')}</span>`).join('')}</div>` : ''}
        <div class="field"><label for="cl-notes">Private notes</label><textarea class="input" id="cl-notes" rows="3" data-clnotes="${c.id}" placeholder="Only you see these">${esc(c.notes || '')}</textarea></div>`;
    } else if (tab === 'training') {
      body = d.workouts.length ? d.workouts.slice().reverse().map(w => {
        const byEx = {}; w.sets.forEach(([id, kg, reps, rir, type]) => { if (type === 'warm') return; (byEx[id] = byEx[id] || []).push([kg, reps, rir]); });
        return `<div class="card" style="box-shadow:none;gap:6px"><div class="row between"><b>${esc(w.name)}</b><span class="small faint">${shortDate(w.date)} · ${w.durationMin} min${w.prs ? ` · ${w.prs} PR` : ''}</span></div>
          ${Object.entries(byEx).map(([id, sets]) => `<div class="row between small"><span>${esc((EX_BY_ID[id] || {}).name || id)}</span><span class="num faint">${sets.map(([kg, r, rir]) => `${kg ? kgToDisp(S, kg) + '×' : ''}${r}${rir != null ? ' @' + rir : ''}`).join(', ')}</span></div>`).join('')}</div>`;
      }).join('') : '<p class="muted">No workouts in the last 4 weeks.</p>';
    } else if (tab === 'food') {
      const T = d.targets;
      body = `<p class="small muted" style="margin:0">Targets: ${fmtInt(T.calories)} kcal · ${T.protein} g protein</p>
        <div class="list">${d.food.slice().reverse().map(x => `<div class="li"><span class="grow">${shortDate(x.date)}</span>${x.logged ? `<span class="num small ${x.kcal > T.calories * 1.1 || x.kcal < T.calories * 0.8 ? 'over' : ''}">${fmtInt(x.kcal)} kcal</span><span class="num small faint" style="width:70px;text-align:right">${x.p} g P</span>` : '<span class="small faint">Not logged</span>'}</div>`).join('')}</div>`;
    } else {
      const a = s.assign || (s.assign = { mode: 'program', program: 'starter3', days: [1, 3, 5], targets: false, kcal: d ? d.targets.calories : 2000, p: d ? d.targets.protein : 150, c: d ? d.targets.carbs : 200, f: d ? d.targets.fat : 65, note: '' });
      const mine = (S.plan ? S.plan.workouts.filter(w => w.custom) : []);
      body = `<div class="seg"><button data-act="as-mode" data-v="program" aria-pressed="${a.mode === 'program'}">A program</button><button data-act="as-mode" data-v="custom" aria-pressed="${a.mode === 'custom'}">My workouts</button><button data-act="as-mode" data-v="none" aria-pressed="${a.mode === 'none'}">Targets only</button></div>
        ${a.mode === 'program' ? `<div class="field"><label for="as-prog">Program</label><select class="input" id="as-prog" data-as="program">${PROGRAMS.map(p => `<option value="${p.id}" ${a.program === p.id ? 'selected' : ''}>${esc(p.name)} (${p.days} days)</option>`).join('')}</select></div>` : ''}
        ${a.mode === 'custom' ? (mine.length ? `<div class="stack" style="gap:6px">${mine.map(w => `<button class="li" data-act="as-cw" data-id="${w.id}" aria-pressed="${(a.cw || []).includes(w.id)}"><span class="fw-check" style="${(a.cw || []).includes(w.id) ? 'background:var(--train);border-color:var(--train)' : ''}">${(a.cw || []).includes(w.id) ? icon('check', 14) : ''}</span><span class="grow"><span class="t">${esc(w.name)}</span><br><span class="d">${w.items.length} exercises</span></span></button>`).join('')}</div>` : `<p class="small muted">Build workouts with <b>Create your own workout</b> on your Train tab, then send them here.</p>`) : ''}
        ${a.mode !== 'none' ? `<span class="label">Training days</span><div class="daypick">${[1, 2, 3, 4, 5, 6, 0].map(x => `<button data-act="as-day" data-d="${x}" aria-pressed="${a.days.includes(x)}" aria-label="${DOW_LONG[x]}">${DOW[x].slice(0, 2)}</button>`).join('')}</div>` : ''}
        <div class="toggle"><span class="small"><b>Set macro targets</b><br><span class="faint">Otherwise the app's recommendation stays</span></span><button class="switch" role="switch" aria-checked="${!!a.targets}" data-act="as-targets" aria-label="Set macro targets"></button></div>
        ${a.targets ? `<div class="grid2"><div class="field"><label for="as-p">Protein (g)</label><input class="input" id="as-p" inputmode="numeric" data-as="p" value="${a.p}"></div><div class="field"><label for="as-c">Carbs (g)</label><input class="input" id="as-c" inputmode="numeric" data-as="c" value="${a.c}"></div><div class="field"><label for="as-f">Fat (g)</label><input class="input" id="as-f" inputmode="numeric" data-as="f" value="${a.f}"></div><div class="field"><span class="label">Calories</span><div class="mid-num" style="padding-top:6px">${fmtInt(a.p * 4 + a.c * 4 + a.f * 9)}</div></div></div>` : ''}
        <div class="field"><label for="as-note">Note to ${esc(c.name)}</label><textarea class="input" id="as-note" rows="2" data-as="note" placeholder="e.g. Great week. Adding a 4th day.">${esc(a.note || '')}</textarea></div>
        <button class="btn train block" data-act="as-send">${icon('share', 18)} Send to ${esc(c.name)}</button>
        ${c.lastAssign ? `<p class="tiny faint">Last sent ${ago(c.lastAssign)}.</p>` : ''}`;
    }
    return sheetHead(esc(c.name), c.linked ? 'Linked client' : 'Invite sent') + tabs + body
      + (tab === 'overview' ? `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="coach-import">Open new update</button><button class="btn danger sm" data-act="coach-remove" data-id="${c.id}">Remove client</button></div>` : '');
  },
  coachImport(s) {
    return sheetHead(s.title || 'Open a coach file', 'Choose the file you received, or paste its text')
      + `<input class="input" id="cf-file" type="file" accept=".json,.gwcoach,application/json,text/plain" aria-label="Coach file">
      <textarea class="input" id="cf-text" rows="4" placeholder="Or paste text starting with GWC1:" style="font:12px ui-monospace,monospace"></textarea>
      <button class="btn train block" data-act="coach-file-open">Open</button>`;
  },
  coachSent(s) {
    return sheetHead('Ready to send', s.sub || '')
      + `<p class="small muted">If the share sheet didn't open, or you'd rather paste it into a message, copy this text instead. ${s.encrypted ? 'It\'s encrypted: only the other person\'s Groundwork can read it.' : ''}</p>
      <textarea class="input" id="cs-text" rows="4" readonly style="font:12px ui-monospace,monospace">${esc(UI.lastCoachText || '')}</textarea>
      <button class="btn ghost block" data-act="coach-copy">${icon('copy', 18)} Copy text</button><button class="btn train block" data-act="close-sheet">Done</button>`;
  },
  assignReview(s) {
    const a = s.payload, prog = a.program && PROGRAM_BY_ID[a.program];
    return sheetHead(`New plan from ${esc(S.coach.name)}`, `Sent ${shortDate(a.sentAt.slice(0, 10))}`)
      + (a.note ? `<div class="banner">${icon('chat', 18)}<span>${esc(a.note)}</span></div>` : '')
      + `<div class="list">${prog ? `<div class="li"><span class="grow"><span class="t">Program: ${esc(prog.name)}</span><br><span class="d">${a.days.length} days a week</span></span></div>` : ''}
        ${a.workouts && a.workouts.length ? `<div class="li"><span class="grow"><span class="t">${a.workouts.length} workout${a.workouts.length > 1 ? 's' : ''} from your coach</span><br><span class="d">${a.workouts.map(w => esc(w.name)).join(', ')} · ${a.days.length} days a week</span></span></div>` : ''}
        ${a.targets ? `<div class="li"><span class="grow"><span class="t">Targets: ${fmtInt(a.targets.protein * 4 + a.targets.carbs * 4 + a.targets.fat * 9)} kcal</span><br><span class="d">${a.targets.protein} g protein · ${a.targets.carbs} g carbs · ${a.targets.fat} g fat</span></span></div>` : ''}</div>
      <p class="small faint">Accepting replaces your current plan${a.targets ? ' and targets' : ''}. Your history and records stay.</p>
      <button class="btn train block" data-act="assign-accept">Accept</button>`;
  },
});

/* ================= apply things ================= */
function applyAssignment(a) {
  if (a.program && PROGRAM_BY_ID[a.program]) { S.program = a.program; S.schedule.days = a.days.slice(); S.plan = buildPlan(S, 1); }
  else if (a.workouts && a.workouts.length) {
    S.program = null; S.schedule.days = a.days.slice();
    const ws = a.workouts.map(w => Object.assign(JSON.parse(JSON.stringify(w)), { custom: true, fromCoach: true }));
    S.customWorkouts = (S.customWorkouts || []).filter(w => !w.fromCoach).concat(ws);
    const P = buildPlan(S, 1);
    const days = S.schedule.days.slice().sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7));
    P.dayMap = {}; days.forEach((d, i) => { P.dayMap[d] = ws[i % ws.length].id; });
    P.cycle = days.length !== ws.length ? ws.map(w => w.id) : null;
    P.split = `Plan from ${S.coach.name}`;
    S.plan = P;
  }
  if (a.targets) S.macros = Object.assign({}, S.macros, { mode: 'custom', custom: { protein: a.targets.protein, carbs: a.targets.carbs, fat: a.targets.fat } });
  S.coach.lastAssign = { sentAt: a.sentAt, note: a.note || '' };
}
function sampleClient() {
  const today = todayKey(), weights = [], workouts = [], food = [];
  for (let i = 40; i >= 0; i -= 2) weights.push({ date: addDays(today, -i), kg: Math.round((84 - (40 - i) * 0.06 + Math.sin(i) * 0.4) * 10) / 10 });
  const ex = [['bb_back_squat', 100], ['bb_bench', 75], ['bb_row', 70], ['bb_rdl', 90], ['db_ohp', 22], ['lat_pulldown', 60]];
  for (let i = 27, n = 0; i >= 0; i--) { const k = addDays(today, -i); if ([1, 3, 5].includes(parseKey(k).getDay())) { n++; const pick = n % 2 ? ex.slice(0, 3) : ex.slice(3); workouts.push({ date: k, name: n % 2 ? 'Full Body A' : 'Full Body B', durationMin: 52, prs: n % 4 === 0 ? 1 : 0, sets: pick.flatMap(([id, kg]) => [0, 1, 2].map(j => [id, kg + n * 1.25, 8 - (j > 1 ? 1 : 0), 2, null])) }); } }
  for (let i = 13; i >= 0; i--) food.push({ date: addDays(today, -i), kcal: i % 5 === 2 ? 0 : 2050 + ((i * 137) % 300) - 150, p: 140 + ((i * 31) % 30), logged: i % 5 !== 2 });
  return { name: 'Sample: Jordan', sentAt: new Date(Date.now() - 864e5).toISOString(), note: 'Knees felt better this week. Can we add a 4th day?', profile: { goal: 'lose', experience: 'intermediate', sex: 'male', age: 31, heightCm: 180, units: 'imperial' }, targets: { calories: 2100, protein: 160, carbs: 200, fat: 70 }, plan: { name: 'Beginner Full Body', days: 3 }, adherence: { planned: 6, done: 5 }, weights, workouts, food, checkins: [], measurements: [{ date: addDays(today, -28), waist: 94 }, { date: today, waist: 91.5 }], pain: [{ date: addDays(today, -9), exId: 'bulgarian_split', area: 'Knee', kind: 'ache' }], safety: { needsClearance: false, cleared: false } };
}

/* ================= hooks ================= */
const _tabBar = tabBar;
tabBar = () => {
  if (!coachOn()) return _tabBar();
  const t = [['today', 'Today', 'home'], ['train', 'Train', 'dumbbell'], ['food', 'Nutrition', 'fork'], ['progress', 'Progress', 'chart'], ['clients', 'Clients', 'user']];
  return `<nav class="tabs" aria-label="Main"><div class="tabs-inner">${t.map(([id, label, ic]) => `<button class="tab" data-tab="${id}" data-act="tab" data-id="${id}" ${UI.tab === id ? 'aria-current="page"' : ''}>${icon(ic, 24)}<span>${label}</span></button>`).join('')}</div></nav>`;
};
/* Settings: Coaching entry. */
const _settingsCoach = SHEETS.settings;
SHEETS.settings = s => _settingsCoach(s).replace('<div class="card" style="box-shadow:none" id="set-profile">',
  `<div class="card" style="box-shadow:none"><span class="eyebrow">Coaching</span><button class="li" data-act="coaching-open"><span class="ni">${icon('user', 20)}</span><span class="grow"><span class="t">${S.coach ? 'Coach: ' + esc(S.coach.name) : coachOn() ? 'Coach mode on' : 'Work with a coach'}</span><br><span class="d">${S.coach ? 'Send updates, open new plans' : 'Join a coach, or turn on coach mode'}</span></span><span class="chev">${icon('chevR', 18)}</span></button></div>
  <div class="card" style="box-shadow:none" id="set-profile">`);
/* Today: coach card for linked clients. */
const _viewTodayCoach = viewToday;
viewToday = () => {
  const html = _viewTodayCoach();
  if (!S.coach) return html;
  const c = S.coach, due = !c.lastSent || daysBetween(c.lastSent, todayKey()) >= 7;
  const card = `<div class="card train"><div class="card-head"><span class="eyebrow">Your coach · ${esc(c.name)}</span>${due ? '<span class="tag fuel">Update due</span>' : ''}</div>
    ${c.lastAssign && c.lastAssign.note ? `<p class="small" style="margin:0">“${esc(c.lastAssign.note)}”</p>` : ''}
    <button class="btn ${due ? 'train' : 'ghost'} sm" data-act="client-send" style="align-self:flex-start">${icon('share', 16)} Send update</button></div>`;
  const marker = '<div class="card fuel">';
  return html.includes(marker) ? html.replace(marker, card + marker) : html + card;
};

/* ================= actions ================= */
Object.assign(ACT, {
  'coaching-open': () => pushSheet({ type: 'coaching' }),
  'coach-toggle': () => { S.coachMode = S.coachMode || { on: false, plan: 'starter', clients: [], name: S.profile.name || '', id: 'co_' + uid() }; S.coachMode.on = !S.coachMode.on; if (!S.coachMode.on && UI.tab === 'clients') UI.tab = 'today'; save(); render(); toast(S.coachMode.on ? 'Coach mode on: see the Clients tab' : 'Coach mode off. Client data is kept.'); },
  'coach-plan': () => pushSheet({ type: 'coachPlan' }),
  'coach-plan-pick': t => { const p = COACH_PLANS.find(x => x.id === t.dataset.id); if (clients().length > p.seats) { toast(`You have ${clients().length} clients; ${p.name} covers ${p.seats}.`); return; } S.coachMode.plan = p.id; save(); popSheet(); toast(`${p.name} plan: up to ${p.seats} clients`); },
  'coach-add': () => pushSheet({ type: 'coachAdd' }),
  'coach-invite': async () => {
    const name = val('ca-name'); if (!name) { toast('Add your client\'s name'); return; }
    if (!GWCrypto.ok()) { toast('Secure files aren\'t available in this browser'); return; }
    const c = { id: 'cl_' + uid(), name, key: GWCrypto.newKey(), invitedAt: todayKey(), linked: false, data: null, notes: '' };
    S.coachMode.clients.push(c); save();
    const inv = { gw: 'coach', v: 1, type: 'invite', coachId: S.coachMode.id, coachName: S.coachMode.name || S.profile.name || 'Your coach', clientId: c.id, clientName: name, key: c.key };
    await sendCoachFile(inv, 'groundwork-invite-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'Groundwork coach invite');
    UI.stack = []; UI.sheet = { type: 'coachSent', sub: `Invite for ${name}. They open it in Settings → Coaching.`, encrypted: false }; render();
  },
  'coach-reinvite': async t => { const c = findClient(t.dataset.id); const inv = { gw: 'coach', v: 1, type: 'invite', coachId: S.coachMode.id, coachName: S.coachMode.name || 'Your coach', clientId: c.id, clientName: c.name, key: c.key }; await sendCoachFile(inv, 'groundwork-invite', 'Groundwork coach invite'); pushSheet({ type: 'coachSent', sub: `Invite for ${c.name}` }); },
  'coach-sample': () => { const c = { id: 'cl_' + uid(), name: 'Sample: Jordan', key: GWCrypto.ok() ? GWCrypto.newKey() : '', invitedAt: todayKey(), linked: true, sample: true, data: sampleClient(), notes: '' }; S.coachMode.clients.push(c); save(); render(); },
  'coach-remove': t => confirmSheet('Remove this client?', 'Their data is deleted from this device and the seat is freed. They keep everything on their own phone.', 'Remove', () => { S.coachMode.clients = clients().filter(c => c.id !== t.dataset.id); save(); closeAll(); toast('Client removed'); }, true),
  'client-open': t => pushSheet({ type: 'client', id: t.dataset.id, tab: 'overview', tall: true }),
  'client-tab': t => { UI.sheet.tab = t.dataset.v; render(); },
  'as-mode': t => { UI.sheet.assign.mode = t.dataset.v; render(); },
  'as-day': t => { const a = UI.sheet.assign, x = Number(t.dataset.d); a.days = a.days.includes(x) ? a.days.filter(y => y !== x) : a.days.concat([x]); render(); },
  'as-targets': () => { UI.sheet.assign.targets = !UI.sheet.assign.targets; render(); },
  'as-cw': t => { const a = UI.sheet.assign; a.cw = a.cw || []; a.cw = a.cw.includes(t.dataset.id) ? a.cw.filter(x => x !== t.dataset.id) : a.cw.concat([t.dataset.id]); render(); },
  'as-send': async () => {
    const s = UI.sheet, c = findClient(s.id), a = s.assign;
    const payload = { sentAt: new Date().toISOString(), note: a.note || '', days: a.days.slice() };
    if (a.mode === 'program') payload.program = a.program;
    if (a.mode === 'custom') { payload.workouts = S.plan.workouts.filter(w => (a.cw || []).includes(w.id)).map(w => JSON.parse(JSON.stringify(w))); if (!payload.workouts.length) { toast('Pick at least one workout'); return; } }
    if (a.mode !== 'none' && !a.days.length) { toast('Pick training days'); return; }
    if (a.targets) payload.targets = { protein: Math.round(a.p), carbs: Math.round(a.c), fat: Math.round(a.f) };
    if (a.mode === 'none' && !a.targets && !a.note) { toast('Nothing to send yet'); return; }
    if (c.sample) { toast('This is a sample client, so nothing is sent'); return; }
    const env = await sealFor('assign', S.coachMode.id, c.id, c.key, payload);
    await sendCoachFile(env, 'groundwork-plan-for-' + c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'Plan from your coach');
    c.lastAssign = todayKey(); save();
    UI.stack = []; UI.sheet = { type: 'coachSent', sub: `Plan for ${c.name}`, encrypted: !!env.enc }; render();
  },
  'coach-import': () => pushSheet({ type: 'coachImport', title: 'Open a client update' }),
  'client-import': () => pushSheet({ type: 'coachImport', title: S.coach ? 'Open a file from your coach' : 'Open coach invite' }),
  'coach-file-open': async () => {
    const readFile = f => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsText(f); });
    const f = document.getElementById('cf-file').files[0];
    let o;
    try { o = parseCoachText(f ? await readFile(f) : val('cf-text')); } catch (e) { toast('That isn\'t a Groundwork coach file'); return; }
    if (o.type === 'invite') {
      if (S.coach && S.coach.id !== o.coachId) { toast(`You're already linked to ${S.coach.name}. Leave first to switch coaches.`); return; }
      S.coach = { id: o.coachId, name: o.coachName, clientId: o.clientId, key: o.key, linkedAt: todayKey(), lastSent: null };
      if (o.clientName && !S.profile.name) S.profile.name = o.clientName;
      save(); closeAll(); toast(`Linked with ${o.coachName}. Send your first update when you're ready.`); return;
    }
    if (o.type === 'assign') {
      if (!S.coach || S.coach.id !== o.coachId || S.coach.clientId !== o.clientId) { toast('This plan is for a different coach link. Open the invite first.'); return; }
      let p; try { p = await unseal(o, S.coach.key); } catch (e) { toast('Couldn\'t read this file. Ask your coach to send it again.'); return; }
      UI.stack = []; UI.sheet = { type: 'assignReview', payload: p, tall: true }; render(); return;
    }
    if (o.type === 'update') {
      const c = coachOn() && findClient(o.clientId);
      if (!c || o.coachId !== S.coachMode.id) { toast('This update isn\'t from one of your clients'); return; }
      let p; try { p = await unseal(o, c.key); } catch (e) { toast('Couldn\'t read this update'); return; }
      c.data = p; c.linked = true; c.lastUpdate = todayKey(); save();
      UI.stack = []; UI.sheet = { type: 'client', id: c.id, tab: 'overview', tall: true }; UI.tab = 'clients'; render(); toast(`Update from ${c.name}`); return;
    }
    toast('Unknown coach file');
  },
  'assign-accept': () => { applyAssignment(UI.sheet.payload); save(); closeAll(); UI.tab = 'train'; UI.trainSeg = 'plan'; render(); toast('Your coach\'s plan is set'); },
  'client-send': () => pushSheet({ type: 'clientSend' }),
  'client-send-go': async () => {
    const note = val('cs-note');
    const env = await sealFor('update', S.coach.id, S.coach.clientId, S.coach.key, buildUpdate(note));
    await sendCoachFile(env, 'groundwork-update-' + (S.profile.name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'Update for your coach');
    S.coach.lastSent = todayKey(); save();
    UI.stack = []; UI.sheet = { type: 'coachSent', sub: `Update for ${S.coach.name}`, encrypted: !!env.enc }; render();
  },
  'client-leave': () => confirmSheet('Leave your coach?', 'Your plan and data stay. You can rejoin with a new invite.', 'Leave', () => { S.coach = null; save(); closeAll(); toast('Unlinked'); }, true),
  'coach-copy': async () => { try { await navigator.clipboard.writeText(UI.lastCoachText || ''); toast('Copied'); } catch (e) { const ta = document.getElementById('cs-text'); if (ta) { ta.focus(); ta.select(); } toast('Text selected. Copy it with your device\'s copy command.'); } },
});
SHEETS.clientSend = () => sheetHead(`Update for ${esc(S.coach.name)}`, 'Your last 4 weeks of training, food totals, weigh-ins and measurements')
  + `<div class="field"><label for="cs-note">Note to your coach (optional)</label><textarea class="input" id="cs-note" rows="3" placeholder="How did the week feel?"></textarea></div>
  <p class="tiny faint">Encrypted so only your coach can open it. Progress photos are never included.</p>
  <button class="btn train block" data-act="client-send-go">${icon('share', 18)} Send update</button>`;

document.addEventListener('change', e => {
  const el = e.target; if (!el || !el.dataset) return;
  if (el.dataset.coachname != null && S.coachMode) { S.coachMode.name = el.value.trim(); save(); }
  if (el.dataset.clnotes) { const c = findClient(el.dataset.clnotes); if (c) { c.notes = el.value; save(); } }
  if (el.dataset.as && UI.sheet && UI.sheet.assign) { const a = UI.sheet.assign, k = el.dataset.as; a[k] = ['p', 'c', 'f'].includes(k) ? Number(el.value) || 0 : el.value; if (['p', 'c', 'f'].includes(k)) render(); }
});

/* Weekly reminder for linked clients. */
const _remCoach = computeReminders;
computeReminders = function (state, now) {
  const out = _remCoach(state, now);
  if (state.onboarded && state.coach && (!state.coach.lastSent || daysBetween(state.coach.lastSent, dateKey(now || new Date())) >= 7) && !state.dismissed['coachupd'])
    out.push({ id: 'coachupd', level: 'normal', title: `Weekly update for ${state.coach.name}`, body: 'Takes a few seconds. Your coach uses it to adjust your plan.', action: 'client-send', actionLabel: 'Send update', icon: 'user' });
  return out;
};
