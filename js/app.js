/* Groundwork — app state, rendering and actions. */
let S = (() => { const saved = Store.load(); return saved ? Object.assign(defaultState(), saved) : defaultState(); })();
const UI = {
  tab: 'today', sheet: null, trainSeg: 'plan', libGroup: 'All', libMine: true, libQuery: '',
  foodDate: todayKey(), ob: null, obStep: 0, loggerOpen: false, rest: null, toast: null, chartRange: 30,
  food: { q: '', online: [], loading: false, err: '', meal: 'breakfast', tab: 'recent' },
};
const MEALS = [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snacks', 'Snacks']];

function save() { Store.save(S); }
function toast(msg) { UI.toast = msg; clearTimeout(toast._t); toast._t = setTimeout(() => { UI.toast = null; const t = document.querySelector('.toast'); if (t) t.remove(); }, 2600); render(); }
function openSheet(sheet) { UI.sheet = sheet; render(); }
function closeSheet() { UI.sheet = null; render(); }

/* ================= render ================= */
function render() {
  const root = document.getElementById('root');
  const y = window.scrollY;
  const lg = document.querySelector('.logger'); const lgY = lg ? lg.scrollTop : 0;
  const sh = document.querySelector('.sheet'); const shY = sh ? sh.scrollTop : 0;
  const prevSheet = render._sheetType;
  if (!S.onboarded) {
    root.innerHTML = viewOnboarding();
  } else {
    const views = { today: viewToday, train: viewTrain, food: viewFood, progress: viewProgress };
    root.innerHTML = `<div class="app">${header()}<main class="view" id="view">${views[UI.tab]()}</main>${tabBar()}</div>`
      + (S.activeWorkout && UI.loggerOpen ? viewLogger() : '')
      + (UI.rest && S.activeWorkout && UI.loggerOpen ? restBar() : '')
      + (UI.sheet ? `<div class="scrim" data-act="close-sheet"></div>${sheetHtml()}` : '')
      + (UI.toast ? `<div class="toast" role="status">${esc(UI.toast)}</div>` : '');
  }
  root.querySelectorAll('[data-demo]').forEach(el => {
    const [a, p] = el.dataset.demo.split('|');
    const ctl = Demo.mount(el, a, p, el.dataset.label);
    const btn = el.parentElement.querySelector('[data-act="demo-toggle"]');
    if (btn) { btn._ctl = ctl; btn.innerHTML = icon(ctl.playing ? 'pause' : 'play', 18) + `<span>${ctl.playing ? 'Pause' : 'Play'}</span>`; }
  });
  window.scrollTo(0, y);
  const lg2 = document.querySelector('.logger'); if (lg2) lg2.scrollTop = lgY;
  const sh2 = document.querySelector('.sheet');
  if (sh2 && UI.sheet && prevSheet === UI.sheet.type + (UI.sheet.key || '')) sh2.scrollTop = shY;
  render._sheetType = UI.sheet ? UI.sheet.type + (UI.sheet.key || '') : null;
  if (UI.sheet && UI.sheet.type === 'scan') startScan(); else if (typeof Scanner !== 'undefined') Scanner.stop();
}

function header() {
  const n = computeReminders(S).length;
  return `<header class="top">
    <div class="brand"><span class="brand-mark">${icon('bolt', 16)}</span>Groundwork</div>
    <div class="spacer"></div>
    <button class="icon-btn" data-act="open-notifs" aria-label="Reminders${n ? ', ' + n + ' new' : ''}">${icon('bell', 22)}${n ? `<span class="badge" id="bell-badge">${n}</span>` : ''}</button>
    <button class="icon-btn" data-act="open-settings" aria-label="Settings">${icon('sliders', 22)}</button>
  </header>`;
}
function tabBar() {
  const t = [['today', 'Today', 'home'], ['train', 'Train', 'dumbbell'], ['food', 'Nutrition', 'fork'], ['progress', 'Progress', 'chart']];
  return `<nav class="tabs" aria-label="Main"><div class="tabs-inner">${t.map(([id, label, ic]) =>
    `<button class="tab" data-tab="${id}" data-act="tab" data-id="${id}" ${UI.tab === id ? 'aria-current="page"' : ''}>${icon(ic, 24)}<span>${label}</span></button>`).join('')}</div></nav>`;
}

/* ================= onboarding ================= */
function obDraft() {
  if (!UI.ob) UI.ob = { name: '', sex: 'male', age: '', units: 'imperial', ft: '5', inch: '10', cm: '178', weight: '', goal: null, experience: null, activity: null, days: [1, 3, 5], minutes: 45, fullGym: false, items: [] };
  return UI.ob;
}
function obToState(o) {
  const st = defaultState();
  const cm = o.units === 'metric' ? Number(o.cm) : ftInToCm(o.ft || 0, o.inch || 0);
  const kg = o.units === 'metric' ? Number(o.weight) : Number(o.weight) * KG_PER_LB;
  st.profile = { name: o.name.trim(), sex: o.sex, age: Number(o.age), heightCm: cm, weightKg: kg, goal: o.goal || 'general', experience: o.experience || 'beginner', activity: o.activity || 'light', units: o.units };
  st.schedule = { days: o.days.slice(), minutes: o.minutes };
  st.equipment = { fullGym: o.fullGym, items: o.items.slice() };
  return st;
}
function obValid(step) {
  const o = obDraft();
  if (step === 1) {
    const age = Number(o.age), w = Number(o.weight);
    const cm = o.units === 'metric' ? Number(o.cm) : ftInToCm(o.ft || 0, o.inch || 0);
    return age >= 16 && age <= 90 && cm >= 120 && cm <= 230 && w > 0 && (o.units === 'metric' ? w >= 30 && w <= 300 : w >= 66 && w <= 660);
  }
  if (step === 2) return !!o.goal;
  if (step === 3) return !!o.experience && !!o.activity;
  if (step === 4) return o.days.length >= 2;
  return true;
}
function viewOnboarding() {
  const o = obDraft(), step = UI.obStep, total = 6;
  if (step === 0) {
    return `<div class="app"><div class="ob"><div class="welcome">
      <div class="brand"><span class="brand-mark">${icon('bolt', 16)}</span>Groundwork</div>
      <h1 class="h1">Train smarter.<br>Eat for it.</h1>
      <p class="muted">One plan for your workouts and your nutrition, built from your goal, your schedule and the equipment you actually have.</p>
      <div class="figs">
        <div data-demo="squat|dumbbell" data-label="Goblet squat demo"></div>
        <div data-demo="row|dumbbell" data-label="Dumbbell row demo"></div>
        <div data-demo="ohp|dumbbell" data-label="Shoulder press demo"></div>
      </div>
      <div class="pillars">
        <div class="pillar train"><span class="k">Train</span><span class="small muted">A weekly plan matched to your equipment, with a demo for every exercise.</span></div>
        <div class="pillar fuel"><span class="k">Fuel</span><span class="small muted">Calorie and macro targets for your goal, plus food logging.</span></div>
      </div>
    </div>
    <div class="stack">
      <button class="btn train block" data-act="ob-next">Get started · 2 minutes</button>
      <button class="btn ghost block" data-act="seed-demo">Explore with sample data</button>
    </div></div></div>`;
  }
  let body = '';
  if (step === 1) {
    const metric = o.units === 'metric';
    body = `<div class="stack"><span class="eyebrow">Step 1 of 5</span><h1 class="h1">About you</h1><p class="muted">Used to estimate how many calories you burn. Nothing leaves this device.</p></div>
      <div class="seg" role="group" aria-label="Units"><button data-act="ob-set" data-k="units" data-v="imperial" aria-pressed="${!metric}">lb · ft/in</button><button data-act="ob-set" data-k="units" data-v="metric" aria-pressed="${metric}">kg · cm</button></div>
      <div class="field"><label for="ob-name">First name <span class="faint">(optional)</span></label><input class="input" id="ob-name" data-ob="name" value="${esc(o.name)}" autocomplete="given-name"></div>
      <div class="field"><span class="label">Sex <span class="faint">(for the calorie formula)</span></span><div class="seg"><button data-act="ob-set" data-k="sex" data-v="male" aria-pressed="${o.sex === 'male'}">Male</button><button data-act="ob-set" data-k="sex" data-v="female" aria-pressed="${o.sex === 'female'}">Female</button></div></div>
      <div class="grid2">
        <div class="field"><label for="ob-age">Age</label><div class="input-suffix"><input class="input" id="ob-age" data-ob="age" inputmode="numeric" value="${esc(o.age)}" placeholder="30"><span>yrs</span></div></div>
        <div class="field"><label for="ob-weight">Weight</label><div class="input-suffix"><input class="input" id="ob-weight" data-ob="weight" inputmode="decimal" value="${esc(o.weight)}" placeholder="${metric ? '80' : '175'}"><span>${metric ? 'kg' : 'lb'}</span></div></div>
      </div>
      ${metric
        ? `<div class="field"><label for="ob-cm">Height</label><div class="input-suffix"><input class="input" id="ob-cm" data-ob="cm" inputmode="numeric" value="${esc(o.cm)}"><span>cm</span></div></div>`
        : `<div class="field"><span class="label">Height</span><div class="grid2"><div class="input-suffix"><input class="input" aria-label="Feet" data-ob="ft" inputmode="numeric" value="${esc(o.ft)}"><span>ft</span></div><div class="input-suffix"><input class="input" aria-label="Inches" data-ob="inch" inputmode="numeric" value="${esc(o.inch)}"><span>in</span></div></div></div>`}`;
  } else if (step === 2) {
    const ic = { lose: 'flame', muscle: 'dumbbell', strength: 'trophy', general: 'heart', endurance: 'run' };
    body = `<div class="stack"><span class="eyebrow">Step 2 of 5</span><h1 class="h1">What's your main goal?</h1><p class="muted">This sets your calorie target, rep ranges and weekly plan. You can change it any time.</p></div>
      <div class="opts">${Object.entries(GOALS).map(([k, g]) => `<button class="opt" data-act="ob-set" data-k="goal" data-v="${k}" aria-pressed="${o.goal === k}"><span class="opt-icon">${icon(ic[k], 22)}</span><span class="grow"><span class="t">${g.label}</span><br><span class="d">${g.blurb}</span></span></button>`).join('')}</div>`;
  } else if (step === 3) {
    const aic = { sedentary: 'sofa', light: 'walk', moderate: 'run', very: 'mountain' };
    body = `<div class="stack"><span class="eyebrow">Step 3 of 5</span><h1 class="h1">Experience and daily activity</h1></div>
      <div class="stack"><span class="label">Lifting experience</span><div class="opts">${Object.entries(EXPERIENCE).map(([k, e]) => `<button class="opt" data-act="ob-set" data-k="experience" data-v="${k}" aria-pressed="${o.experience === k}"><span class="grow"><span class="t">${e.label}</span><br><span class="d">${e.blurb}</span></span><span class="check">${icon('check', 16)}</span></button>`).join('')}</div></div>
      <div class="stack"><span class="label">Activity outside workouts</span><div class="opts">${Object.entries(ACTIVITY).map(([k, a]) => `<button class="opt" data-act="ob-set" data-k="activity" data-v="${k}" aria-pressed="${o.activity === k}"><span class="opt-icon">${icon(aic[k], 22)}</span><span class="grow"><span class="t">${a.label}</span><br><span class="d">${a.blurb}</span></span></button>`).join('')}</div></div>`;
  } else if (step === 4) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    const rec = o.experience === 'beginner' ? 3 : 4;
    body = `<div class="stack"><span class="eyebrow">Step 4 of 5</span><h1 class="h1">When can you train?</h1><p class="muted">Pick your training days. ${o.experience === 'beginner' ? 'Three days a week is a great start for beginners.' : `Most people progress well on ${rec} days.`}</p></div>
      <div class="daypick" role="group" aria-label="Training days">${order.map(d => `<button data-act="ob-day" data-d="${d}" aria-pressed="${o.days.includes(d)}" aria-label="${DOW_LONG[d]}">${DOW[d].slice(0, 2)}</button>`).join('')}</div>
      <p class="small faint">${o.days.length} day${o.days.length === 1 ? '' : 's'} a week · ${splitFor(Math.max(2, Math.min(6, o.days.length)), o.goal).name}${o.days.length > 6 ? ' (6 max; one day stays as rest)' : ''}${o.days.length < 2 ? ' · pick at least 2' : ''}</p>
      <div class="field"><span class="label">Time per workout</span><div class="seg">${[30, 45, 60, 75].map(m => `<button data-act="ob-set" data-k="minutes" data-v="${m}" aria-pressed="${o.minutes === m}">${m} min</button>`).join('')}</div></div>`;
  } else if (step === 5) {
    const groups = {};
    EQUIPMENT.forEach(e => (groups[e.group] = groups[e.group] || []).push(e));
    body = `<div class="stack"><span class="eyebrow">Step 5 of 5</span><h1 class="h1">What equipment do you have?</h1><p class="muted">Every exercise in your plan will use only what you pick. Bodyweight moves are always included.</p></div>
      <button class="opt" data-act="ob-fullgym" aria-pressed="${o.fullGym}"><span class="opt-icon">${icon('dumbbell', 22)}</span><span class="grow"><span class="t">Full gym</span><br><span class="d">Gym membership: selects everything below in one tap</span></span><span class="check">${icon('check', 16)}</span></button>
      <p class="small muted">Or pick exactly what you have at home or at your gym:</p>
      ${Object.entries(groups).map(([g, list]) => `<div class="stack"><span class="label">${g}</span><div class="chips">${list.map(e => `<button class="chip" data-act="ob-item" data-id="${e.id}" aria-pressed="${o.fullGym || o.items.includes(e.id)}">${e.label}</button>`).join('')}</div></div>`).join('')}<p class="small faint" role="status">${equipStatus(o)}</p>`;
  } else if (step === 6) {
    const st = obToState(o); const T = calcTargets(st); const plan = buildPlan(st);
    const first = plan.workouts[0];
    body = `<div class="stack"><span class="eyebrow">Your plan is ready</span><h1 class="h1">${o.name ? esc(o.name) + ', here' : 'Here'}'s where you start</h1></div>
      <div class="card fuel"><div class="card-head"><span class="eyebrow">Daily target</span><span class="tag fuel">${GOALS[st.profile.goal].label}</span></div>
        <div class="row"><span class="big-num">${fmtInt(T.calories)}</span><span class="unit">kcal / day</span></div>
        <div class="macros">${['p', 'c', 'f'].map(k => `<div class="macro ${k}"><div class="k">${{ p: 'Protein', c: 'Carbs', f: 'Fat' }[k]}</div><div class="mid-num" style="font-size:22px">${T[{ p: 'protein', c: 'carbs', f: 'fat' }[k]]}<span class="unit">g</span></div></div>`).join('')}</div>
        <p class="small muted">Maintenance is about ${fmtInt(T.tdee)} kcal. ${T.goalAdj ? `Your goal ${T.goalAdj < 0 ? 'removes' : 'adds'} ${fmtInt(Math.abs(T.goalAdj))}.` : ''} Weekly check-ins fine-tune this.</p></div>
      <div class="card train"><div class="card-head"><span class="eyebrow">Training</span><span class="tag train">${st.schedule.days.length} days · ${st.schedule.minutes} min</span></div>
        <div class="h2">${esc(plan.split)}</div>
        <div class="ex-mini">${first.items.map((it, i) => `<div class="row"><span class="n">${i + 1}</span><span class="grow">${esc(EX_BY_ID[it.exId].name)}</span><span class="small faint num">${it.sets}×${it.min}–${it.max}${EX_BY_ID[it.exId].unit === 'reps' ? '' : EX_BY_ID[it.exId].unit === 'sec' ? 's' : ' min'}</span></div>`).join('')}</div>
        <p class="small faint">First workout: ${esc(first.name)}. Every exercise has a demo and form tips.</p></div>
      <p class="tiny faint">Groundwork gives general fitness and nutrition guidance, not medical advice. Check with a doctor before starting if you have a health condition, are pregnant, or are new to exercise after a long break.</p>`;
  }
  const valid = obValid(step);
  return `<div class="app"><div class="ob">
    <div class="ob-top"><button class="icon-btn" data-act="ob-back" aria-label="Back">${icon('arrowL', 22)}</button><div class="progress"><i style="width:${(step / total) * 100}%"></i></div></div>
    <div class="ob-body">${body}</div>
    <div class="ob-foot"><button class="btn ${step === 6 ? 'train' : ''} block" data-act="${step === 6 ? 'ob-finish' : 'ob-next'}" ${valid ? '' : 'disabled'}>${step === 6 ? 'Start my plan' : 'Continue'}</button></div>
  </div></div>`;
}

/* ================= today ================= */
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; }
function viewToday() {
  const today = todayKey();
  const T = calcTargets(S);
  const tot = foodTotals(S, today);
  const rems = computeReminders(S);
  const planned = workoutForDate(S, today);
  const done = workoutDoneOn(S, today);
  const lw = lastWeight(S);
  const ci = checkinStatus(S);

  let trainCard;
  if (S.activeWorkout) {
    const a = S.activeWorkout, doneSets = a.items.reduce((n, it) => n + it.rows.filter(r => r.done).length, 0);
    trainCard = `<div class="card train"><div class="card-head"><span class="eyebrow">In progress</span><span class="tag train">${doneSets} sets done</span></div><div class="h2">${esc(a.name)}</div><button class="btn train block" data-act="open-logger">Resume workout</button></div>`;
  } else if (done) {
    trainCard = `<div class="card train"><div class="card-head"><span class="eyebrow">Today's training</span><span class="tag train">${icon('check', 14)} Done</span></div><div class="h2">${esc(done.name)}</div>
      <div class="stats"><div class="stat"><div class="v">${done.durationMin}<span class="unit">min</span></div><div class="k">Duration</div></div><div class="stat"><div class="v">${done.sets.length}</div><div class="k">Sets</div></div><div class="stat"><div class="v">${(done.prs || []).length}</div><div class="k">PRs</div></div></div></div>`;
  } else if (planned) {
    const bi = blockInfo(S);
    trainCard = `<div class="card train"><div class="card-head"><span class="eyebrow">Today's training</span><span class="tag train">${bi && bi.deload ? 'Deload week' : `~${S.schedule.minutes} min`}</span></div>
      <div><div class="h2">${esc(planned.name)}</div><div class="small muted">${esc(planned.focus)}</div></div>
      <div class="ex-mini">${planned.items.map((it, i) => `<div class="row"><span class="n">${i + 1}</span><span class="grow">${esc(EX_BY_ID[it.exId].name)}</span><span class="small faint num">${rxText(it, true)}</span></div>`).join('')}</div>
      <button class="btn train block" data-act="start-workout" data-id="${planned.id}">${icon('play', 18)} Start workout</button></div>`;
  } else {
    const next = nextPlanned(today);
    trainCard = `<div class="card train"><div class="card-head"><span class="eyebrow">Rest day</span>${next ? `<span class="tag">${next.when}</span>` : ''}</div>
      <div class="h2">Recover and recharge</div><p class="small muted">Muscles grow between sessions. A 20–30 minute walk and a good night's sleep count as training today.</p>
      ${next ? `<div class="row"><span class="small muted grow">Next: <b>${esc(next.w.name)}</b> · ${next.when}</span><button class="link" data-act="preview-workout" data-id="${next.w.id}">Preview</button></div>` : ''}</div>`;
  }

  const left = T.calories - tot.kcal;
  return `
    <div class="stack" style="gap:2px"><span class="eyebrow">${prettyDate(today)}</span><h1 class="h1">${greeting()}${S.profile.name ? ', ' + esc(S.profile.name) : ''}</h1></div>
    ${S.demo ? `<div class="banner">${icon('info', 18)}<span class="grow">You're viewing sample data.</span><button class="link fuel" data-act="end-demo">Start fresh</button></div>` : ''}
    ${rems.slice(0, 2).map(nudgeHtml).join('')}
    ${rems.length > 2 ? `<button class="link muted" data-act="open-notifs" style="align-self:flex-start">See all ${rems.length} reminders</button>` : ''}
    ${trainCard}
    <div class="card fuel">
      <div class="card-head"><span class="eyebrow">Nutrition today</span><button class="link fuel" data-act="tab" data-id="food">Open log</button></div>
      <div class="ring-wrap"><div class="ring">${ring(tot.kcal, T.calories, 'var(--fuel)')}<div class="c"><span class="mid-num ${left < 0 ? 'over' : ''}">${fmtInt(Math.abs(left))}</span><span class="tiny faint">${left < 0 ? 'kcal over' : 'kcal left'}</span></div></div>
      <div class="kv"><div class="row"><span class="small muted">Target</span><b class="num">${fmtInt(T.calories)}</b></div><div class="row"><span class="small muted">Eaten</span><b class="num">${fmtInt(tot.kcal)}</b></div><div class="row"><span class="small muted">Protein</span><b class="num">${r0(tot.p)} / ${T.protein} g</b></div></div></div>
      <div class="macros">${macroBar('p', 'Protein', tot.p, T.protein)}${macroBar('c', 'Carbs', tot.c, T.carbs)}${macroBar('f', 'Fat', tot.f, T.fat)}</div>
      <button class="btn fuel block" data-act="add-food" data-meal="${mealForNow()}">${icon('plus', 18)} Log food</button>
    </div>
    <div class="card"><div class="card-head"><span class="eyebrow">This week</span><span class="small faint">${weekDoneCount()} of ${weekPlannedCount()} sessions</span></div>${weekStrip()}</div>
    <div class="card">
      <div class="card-head"><span class="eyebrow">Body weight</span><button class="link" data-act="log-weight">Log weight</button></div>
      <div class="row between"><div><span class="mid-num">${lw ? kgToDisp(S, lw.kg) : '—'}</span><span class="unit">${wUnit(S)}</span><div class="tiny faint">${lw ? (lw.date === today ? 'Logged today' : 'Last logged ' + shortDate(lw.date)) : 'No weigh-ins yet'}</div></div>
      <div style="text-align:right"><div class="small"><b>${ci.due ? 'Check-in ready' : `Check-in in ${ci.daysUntil} day${ci.daysUntil === 1 ? '' : 's'}`}</b></div>${ci.due ? `<button class="btn sm train" data-act="open-checkin" style="margin-top:6px">Check in</button>` : `<div class="tiny faint">Adjusts calories to your trend</div>`}</div></div>
    </div>`;
}
function nudgeHtml(r) {
  return `<div class="nudge ${r.level === 'high' ? 'high' : ''}"><span class="ni">${icon(r.icon, 20)}</span><div class="stack grow" style="gap:4px;padding-right:22px"><b>${esc(r.title)}</b><span class="small muted">${esc(r.body)}</span>${r.action ? `<button class="link" data-act="${r.action}" style="align-self:flex-start">${esc(r.actionLabel)}</button>` : ''}</div><button class="x" data-act="dismiss" data-id="${r.id}" aria-label="Dismiss for today">${icon('x', 16)}</button></div>`;
}
function mealForNow() { const h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snacks'; }
function nextPlanned(fromKey) {
  for (let i = 1; i <= 7; i++) { const k = addDays(fromKey, i); const w = workoutForDate(S, k); if (w) return { w, when: i === 1 ? 'Tomorrow' : DOW_LONG[parseKey(k).getDay()] }; }
  return null;
}
function weekPlannedCount() { const ws = weekStart(todayKey()); let n = 0; for (let i = 0; i < 7; i++) if (workoutForDate(S, addDays(ws, i))) n++; return n; }
function weekDoneCount() { const ws = weekStart(todayKey()), we = addDays(ws, 6); return S.workouts.filter(w => w.date >= ws && w.date <= we).length; }
function weekStrip() {
  const ws = weekStart(todayKey()), today = todayKey();
  return `<div class="week">${[...Array(7)].map((_, i) => {
    const k = addDays(ws, i), d = parseKey(k), w = workoutForDate(S, k), done = workoutDoneOn(S, k);
    const cls = done ? 'done' : w ? (k < today && k >= S.startDate ? 'missed' : 'planned') : '';
    return `<div class="d ${k === today ? 'today' : ''}"><span>${DOW[d.getDay()].slice(0, 1)}</span><span class="dot ${cls}" title="${w ? esc(w.name) : 'Rest'}">${done ? icon('check', 14) : d.getDate()}</span></div>`;
  }).join('')}</div>`;
}
function rxText(it, compact) {
  const ex = EX_BY_ID[it.exId];
  const u = ex.unit === 'min' ? ' min' : ex.unit === 'sec' ? ' s' : '';
  if (ex.unit === 'min') return `${it.min}–${it.max} min`;
  return compact ? `${it.sets}×${it.min}–${it.max}${u}` : `${it.sets} sets × ${it.min}–${it.max}${u || ' reps'}${it.rest ? ` · rest ${it.rest >= 120 ? (it.rest / 60) + ' min' : it.rest + ' s'}` : ''}`;
}

/* ================= train ================= */
function viewTrain() {
  return `<div class="stack" style="gap:2px"><span class="eyebrow">Training</span><h1 class="h1">${UI.trainSeg === 'plan' ? 'Your plan' : 'Exercise library'}</h1></div>
    <div class="seg"><button data-act="train-seg" data-v="plan" aria-pressed="${UI.trainSeg === 'plan'}">My plan</button><button data-act="train-seg" data-v="lib" aria-pressed="${UI.trainSeg === 'lib'}">Exercise library</button></div>
    ${UI.trainSeg === 'plan' ? viewPlan() : viewLibrary()}`;
}
/* Equipment selection: "Full gym" is a shortcut that selects every item; untick any item to customise. */
function equipToggleAll(d) { d.fullGym = !d.fullGym; d.items = d.fullGym ? FULL_GYM.slice() : []; }
function equipToggleItem(d, id) {
  let items = d.fullGym ? FULL_GYM.slice() : d.items.slice();
  items = items.includes(id) ? items.filter(x => x !== id) : items.concat([id]);
  d.items = items; d.fullGym = FULL_GYM.every(x => items.includes(x));
}
function equipStatus(d) {
  if (d.fullGym) return 'Full gym: everything selected. Untick anything you don\'t have.';
  if (!d.items.length) return 'Nothing selected: you\'ll get bodyweight workouts. Bodyweight moves are always included.';
  return `${d.items.length} selected. Bodyweight moves are always included.`;
}
function equipSummary() {
  if (S.equipment.fullGym) return 'Full gym';
  if (!S.equipment.items.length) return 'Bodyweight only';
  return S.equipment.items.map(id => EQUIPMENT.find(e => e.id === id).label).join(', ');
}
function viewPlan() {
  const P = S.plan, today = todayKey(), order = [1, 2, 3, 4, 5, 6, 0];
  return `<div class="card train">
      <div class="card-head"><span class="eyebrow">${GOALS[S.profile.goal].label} · ${EXPERIENCE[S.profile.experience].label}</span></div>
      <div class="h2">${esc(P.split)}</div>
      <div class="small muted">${S.schedule.days.length} days a week · ${S.schedule.minutes} min · ${esc(equipSummary())}</div>
      ${blockCard()}
      <button class="btn ghost sm" data-act="open-settings" data-key="training" style="align-self:flex-start">Change days, time or equipment</button>
    </div>
    <div class="card"><span class="eyebrow">Weekly schedule</span><div class="list">${order.map(d => {
      const w = P.dayMap[d] ? P.workouts.find(x => x.id === P.dayMap[d]) : null;
      const isToday = parseKey(today).getDay() === d;
      return `<button class="li" ${w ? `data-act="preview-workout" data-id="${w.id}"` : 'disabled'}><span class="tag ${isToday ? 'train' : ''}" style="width:44px;justify-content:center">${DOW[d]}</span><span class="grow"><span class="t">${w ? esc(w.name) : '<span class="faint">Rest</span>'}</span>${w ? `<br><span class="d">${esc(w.focus)}</span>` : ''}</span>${w ? `<span class="chev">${icon('chevR', 18)}</span>` : ''}</button>`;
    }).join('')}</div></div>
    ${P.workouts.filter((w, i, a) => a.findIndex(x => x.id === w.id) === i).map(w => `<div class="card">
      <div class="card-head"><div><div class="h3">${esc(w.name)}</div><div class="small muted">${esc(w.focus)}</div></div><button class="btn sm train" data-act="start-workout" data-id="${w.id}">Start</button></div>
      <div class="list">${w.items.map((it, i) => exRow(it, `data-act="open-ex" data-id="${it.exId}"`)).join('')}</div>
      <button class="link muted" data-act="preview-workout" data-id="${w.id}" style="align-self:flex-start">${icon('swap', 16)} Swap, add or remove exercises</button>
    </div>`).join('')}
    <p class="small faint">Progression: when you hit the top of the rep range on every set, the logger suggests adding weight next time.</p>`;
}
function blockCard() {
  const b = blockInfo(S); if (!b) return '';
  const label = b.done ? 'Block complete' : b.deload ? `Week ${b.week} of ${b.len} · Deload week` : `Week ${b.week} of ${b.len}`;
  return `<div class="stack" style="gap:6px"><div class="row between"><span class="small"><b>Block ${b.block}</b> · ${label}</span>${b.done ? `<button class="btn sm train" data-act="new-block">Start block ${b.block + 1}</button>` : b.deload ? '' : `<span class="tiny faint">Deload in week ${b.len}</span>`}</div>
    <div class="blockbar">${[...Array(b.len)].map((_, i) => `<i class="${i + 1 < b.week || b.done ? 'past' : i + 1 === b.week ? 'now' : ''} ${i + 1 === b.len ? 'dl' : ''}"></i>`).join('')}</div></div>`;
}
function exRow(it, attrs, right) {
  const ex = EX_BY_ID[it.exId];
  return `<button class="li" ${attrs}><span class="thumb sm">${Demo.staticSvg(ex.anim, ex.prop, ex.name)}</span><span class="grow"><span class="t">${esc(ex.name)}</span><br><span class="d">${it.slot === 'finisher' ? 'Finisher · ' : ''}${rxText(it, false)}</span></span>${right || `<span class="chev">${icon('chevR', 18)}</span>`}</button>`;
}
function viewLibrary() {
  const equip = equipList(S);
  const groups = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio'];
  return `<div class="field"><div class="input-suffix"><input class="input" id="lib-q" type="text" inputmode="search" placeholder="Search exercises" value="${esc(UI.libQuery)}" aria-label="Search exercises"><span>${icon('search', 18)}</span></div></div>
    <div class="chips scroll">${groups.map(g => `<button class="chip" data-act="lib-group" data-v="${g}" aria-pressed="${UI.libGroup === g}">${g}</button>`).join('')}</div>
    <div class="toggle"><span class="small"><b>Only my equipment</b><br><span class="faint">${esc(equipSummary())}</span></span><button class="switch" role="switch" aria-checked="${UI.libMine}" data-act="lib-mine" aria-label="Only my equipment"></button></div>
    <div class="card" style="padding-top:4px;padding-bottom:4px"><div class="list" id="lib-list">${libraryRows(equip)}</div></div>`;
}
function libraryRows(equip) {
  const q = UI.libQuery.trim().toLowerCase();
  const list = EXERCISES.filter(e => (UI.libGroup === 'All' || e.group === UI.libGroup)
    && (!UI.libMine || exerciseAvailable(e, equip))
    && (!q || e.name.toLowerCase().includes(q) || e.muscles.join(' ').toLowerCase().includes(q)));
  if (!list.length) return `<div class="empty">No exercises match. ${UI.libMine ? 'Try turning off "Only my equipment".' : ''}</div>`;
  return list.map(e => `<button class="li" data-act="open-ex" data-id="${e.id}"><span class="thumb sm">${Demo.staticSvg(e.anim, e.prop, e.name)}</span><span class="grow"><span class="t">${esc(e.name)}</span><br><span class="d">${esc(e.muscles.join(', '))}</span></span><span class="tag">${e.req.length ? esc(EQUIPMENT.find(x => x.id === e.req[0]).short) : 'Bodyweight'}</span></button>`).join('');
}

/* ================= workout logger ================= */
function startWorkout(wid) {
  if (S.activeWorkout) { UI.loggerOpen = true; render(); return; }
  const w = S.plan.workouts.find(x => x.id === wid);
  if (!w) return;
  const bi = blockInfo(S);
  const deload = !!(bi && bi.deload);
  const items = w.items.map(it => {
    const sug = suggestion(S, it);
    const ex = EX_BY_ID[it.exId];
    const sets = deload && ex.unit === 'reps' ? Math.max(2, Math.ceil(it.sets / 2)) : it.sets;
    const wkg = deload && sug.weightKg ? roundLoad(S, sug.weightKg * 0.9) : sug.weightKg;
    return { ...it, sets, rows: [...Array(sets)].map(() => ({ weightKg: wkg, reps: null, done: false, _auto: true })) };
  });
  S.activeWorkout = { id: uid(), workoutId: w.id, name: w.name, date: todayKey(), startedAt: Date.now(), items, deload };
  UI.loggerOpen = true; UI.sheet = null;
  save(); render();
}
function prevText(exId, idx) {
  const last = lastSessionFor(S, exId);
  if (!last) return '—';
  const s = last.sets[idx] || last.sets[last.sets.length - 1];
  const ex = EX_BY_ID[exId];
  if (ex.unit !== 'reps') return `${s.reps}${ex.unit === 'min' ? ' min' : ' s'}`;
  return s.weightKg ? `${kgToDisp(S, s.weightKg)}×${s.reps}` : `${s.reps} reps`;
}
function viewLogger() {
  const a = S.activeWorkout;
  const doneSets = a.items.reduce((n, it) => n + it.rows.filter(r => r.done).length, 0);
  const totalSets = a.items.reduce((n, it) => n + it.rows.length, 0);
  return `<div class="logger" role="dialog" aria-label="Workout logger"><div class="logger-inner">
    <div class="logger-top"><button class="icon-btn" data-act="min-logger" aria-label="Minimize workout">${icon('chevD', 24)}</button>
      <div class="grow"><div class="h3">${esc(a.name)}</div><div class="tiny faint">${doneSets} of ${totalSets} sets</div></div>
      <span class="elapsed" id="elapsed">${elapsedText(a.startedAt)}</span>
      <button class="btn sm train" data-act="finish-workout">Finish</button></div>
    <div class="progress"><i style="width:${totalSets ? (doneSets / totalSets) * 100 : 0}%"></i></div>
    ${a.deload ? `<div class="banner">${icon('info', 18)}<span><b>Deload week.</b> Fewer sets at about 90% of your usual weight. Stop 3–4 reps short of failure. This lets you come back stronger next block.</span></div>` : ''}
    ${a.items.map((it, i) => loggerCard(it, i)).join('')}
    <button class="btn ghost block" data-act="add-ex" data-scope="active">${icon('plus', 18)} Add an exercise</button>
    <button class="btn danger block" data-act="cancel-workout">Discard workout</button>
  </div></div>`;
}
function loggerCard(it, i) {
  const ex = EX_BY_ID[it.exId];
  const weighted = ex.unit === 'reps' && ex.req.length > 0;
  const unitHead = ex.unit === 'min' ? 'Min' : ex.unit === 'sec' ? 'Sec' : 'Reps';
  const sug = suggestion(S, it);
  const deload = S.activeWorkout && S.activeWorkout.deload && ex.unit === 'reps';
  const dw = deload && it.rows[0] && it.rows[0].weightKg;
  const deloadTip = deload ? `Deload: ${it.rows.length} easy sets of ${it.min}${dw ? ` at ${kgToDisp(S, dw)} ${wUnit(S)} (about 90%)` : ''}. Leave plenty in the tank.` : '';
  if (deload) sug.reps = it.min;
  return `<div class="card" id="ex-${i}">
    <div class="row"><button class="thumb" data-act="open-ex" data-id="${ex.id}" data-ctx="${i}" aria-label="How to do ${esc(ex.name)}" style="border:0;padding:0">${Demo.staticSvg(ex.anim, ex.prop, ex.name)}</button>
      <div class="grow"><button class="link" data-act="open-ex" data-id="${ex.id}" data-ctx="${i}" style="color:var(--ink);font-size:16px;text-align:left">${esc(ex.name)}</button><div class="small muted">${it.slot === 'finisher' ? esc(it.note) + ' · ' : ''}${rxText(it, false)}</div></div>
      <button class="icon-btn" data-act="swap" data-scope="active" data-idx="${i}" aria-label="Swap exercise">${icon('swap', 20)}</button></div>
    <div class="tip">${icon('target', 16)}<span>${esc(deloadTip || sug.text)}</span></div>
    <div class="sets ${weighted ? '' : 'nowt'}">
      <span class="h">Set</span><span class="h">Previous</span>${weighted ? `<span class="h">${wUnit(S)}</span>` : ''}<span class="h">${unitHead}</span><span class="h"></span>
      ${it.rows.map((r, j) => `
        <span class="sn">${j + 1}</span><span class="prev">${prevText(ex.id, j)}</span>
        ${weighted ? `<span class="${r.done ? 'done-row' : ''}"><input inputmode="decimal" aria-label="Set ${j + 1} weight" data-set="w" data-i="${i}" data-j="${j}" value="${r.weightKg != null ? kgToDisp(S, r.weightKg) : ''}" placeholder="${sug.weightKg != null ? kgToDisp(S, sug.weightKg) : '–'}"></span>` : ''}
        <span class="${r.done ? 'done-row' : ''}"><input inputmode="numeric" aria-label="Set ${j + 1} ${unitHead.toLowerCase()}" data-set="r" data-i="${i}" data-j="${j}" value="${r.reps != null ? r.reps : ''}" placeholder="${ex.unit === 'reps' ? (sug.reps || it.min) : it.max}"></span>
        <button class="ok" data-act="toggle-set" data-i="${i}" data-j="${j}" aria-pressed="${r.done}" aria-label="Mark set ${j + 1} done">${icon('check', 20)}</button>`).join('')}
    </div>
    <div class="row"><button class="link" data-act="add-set" data-i="${i}">${icon('plus', 16)} Add set</button>${it.rows.length > 1 ? `<button class="link muted" data-act="remove-set" data-i="${i}">Remove last</button>` : ''}<span class="grow"></span>${S.activeWorkout.items.length > 1 ? `<button class="link danger" data-act="remove-ex" data-scope="active" data-idx="${i}">Remove exercise</button>` : ''}</div>
  </div>`;
}
function elapsedText(start) { const s = Math.floor((Date.now() - start) / 1000); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; }
function restBar() {
  const left = Math.max(0, Math.ceil((UI.rest.end - Date.now()) / 1000));
  return `<div class="restbar" role="timer" aria-live="polite"><div class="prog" id="rest-prog" style="width:${(1 - left / UI.rest.total) * 100}%"></div><div class="restbar-inner">
    <span class="small" style="opacity:.75">Rest</span><span class="t" id="rest-t">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span><span class="grow"></span>
    <button data-act="rest-add" data-v="-15">−15</button><button data-act="rest-add" data-v="15">+15</button><button data-act="rest-skip">Skip</button></div></div>`;
}
function finishWorkout() {
  const a = S.activeWorkout;
  const sets = [];
  a.items.forEach(it => it.rows.forEach((r, j) => { if (r.done) sets.push({ exId: it.exId, set: j + 1, weightKg: r.weightKg || 0, reps: r.reps || 0, done: true }); }));
  const rec = { id: a.id, date: a.date, workoutId: a.workoutId, name: a.name, startedAt: a.startedAt, durationMin: Math.max(1, Math.round((Date.now() - a.startedAt) / 60000)), sets };
  const before = S.workouts.slice();
  S.workouts = before.concat([rec]);
  rec.prs = detectPRs(S, rec);
  S.activeWorkout = null; UI.loggerOpen = false; UI.rest = null;
  save();
  openSheet({ type: 'summary', wid: rec.id });
}
