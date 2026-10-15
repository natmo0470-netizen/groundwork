/* Groundwork — Advanced tools for experienced lifters.
   Advanced view: effort per set (reps in reserve), warm-up and drop sets, supersets,
   weekly sets per muscle, training-day / rest-day carbs, refeeds and diet breaks.
   Standard and Advanced: custom workouts with editable sets/reps/rest, plate calculator,
   strength charts and body measurements. (Progress photos were removed in v1.13; see the cleanup below.) */

function isAdvanced() { return S.onboarded && typeof modeOf === 'function' && modeOf() === 'advanced'; }
function isGuidedView() { return typeof isGuided === 'function' && isGuided(); }

/* ================= logger extras ================= */
const RIR_OPTIONS = ['', '0', '1', '2', '3', '4', '5'];
function setLabel(r, j) { return r.type === 'warm' ? 'W' : r.type === 'drop' ? 'D' : String(j + 1); }
function plateBreakdown(totalKg, barKg, metric) {
  const plates = metric ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5];
  const toU = kg => metric ? kg : kg / KG_PER_LB;
  let side = (toU(totalKg) - toU(barKg)) / 2;
  if (side <= 0) return { side: [], left: 0 };
  const out = [];
  for (const p of plates) { while (side >= p - 1e-6) { out.push(p); side -= p; } }
  return { side: out, left: Math.round(side * 100) / 100 };
}
const BARS = { imperial: [['Olympic bar', 45], ['Women\'s bar', 35], ['Training bar', 15]], metric: [['Olympic bar', 20], ['Women\'s bar', 15], ['Training bar', 10]] };

/* ================= weekly sets per muscle ================= */
const MUSCLE_BUCKETS = [
  ['Chest', /chest/i], ['Back', /lats|upper back|middle back|back|lower traps/i], ['Traps', /traps/i],
  ['Shoulders', /shoulder|delt/i], ['Biceps', /biceps/i], ['Triceps', /triceps/i], ['Forearms', /forearm|grip/i],
  ['Quads', /quads/i], ['Hamstrings', /hamstring/i], ['Glutes', /glute/i], ['Calves', /calves/i],
  ['Core', /abs|core|oblique/i], ['Adductors', /inner thigh|adductor/i],
];
const VOLUME_TARGET = { Chest: [10, 20], Back: [10, 20], Shoulders: [8, 18], Quads: [10, 20], Hamstrings: [8, 16], Glutes: [8, 16], Biceps: [6, 14], Triceps: [6, 14], Calves: [6, 14], Core: [6, 14] };
function bucketOf(m) { const b = MUSCLE_BUCKETS.find(([, re]) => re.test(m)); return b ? b[0] : null; }
function addVolume(acc, ex, n) {
  if (!ex || ex.unit !== 'reps' || ex.pattern === 'cardio') return;
  ex.muscles.forEach((m, i) => { const b = bucketOf(m); if (b) acc[b] = (acc[b] || 0) + n * (i === 0 ? 1 : 0.5); });
}
function weekVolume(state, ws) {
  const we = addDays(ws, 6), done = {}, planned = {};
  state.workouts.filter(w => w.date >= ws && w.date <= we).forEach(w => w.sets.forEach(s => { if (s.done && s.type !== 'warm') addVolume(done, EX_BY_ID[s.exId], 1); }));
  for (let i = 0; i < 7; i++) { const w = workoutForDate(state, addDays(ws, i)); if (w) w.items.forEach(it => addVolume(planned, EX_BY_ID[it.exId], it.sets)); }
  return { done, planned };
}
function volumeCard() {
  const ws = UI.volWeek || weekStart(todayKey());
  const { done, planned } = weekVolume(S, ws);
  const rows = Object.keys(VOLUME_TARGET);
  const max = 24;
  return `<div class="card"><div class="card-head"><span class="eyebrow">Weekly sets per muscle</span><div class="row" style="gap:4px"><button class="icon-btn" data-act="vol-week" data-v="-7" aria-label="Previous week">${icon('chevL', 18)}</button><span class="small faint">${shortDate(ws)}</span><button class="icon-btn" data-act="vol-week" data-v="7" aria-label="Next week" ${ws >= weekStart(todayKey()) ? 'disabled style="opacity:.35"' : ''}>${icon('chevR', 18)}</button></div></div>
    <div class="vol">${rows.map(m => { const v = done[m] || 0, pl = planned[m] || 0, [lo, hi] = VOLUME_TARGET[m]; const st = v >= lo && v <= hi ? 'ok' : v > hi ? 'hi' : 'lo';
      return `<div class="vol-row"><span class="vol-k">${m}</span><span class="vol-bar"><i class="band" style="left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%"></i><i class="fill ${st}" style="width:${Math.min(100, v / max * 100)}%"></i>${pl ? `<i class="plan" style="left:${Math.min(100, pl / max * 100)}%"></i>` : ''}</span><span class="vol-v num">${Math.round(v * 2) / 2}<span class="faint">/${Math.round(pl)}</span></span></div>`; }).join('')}</div>
    <p class="tiny faint" style="margin:0">Hard sets this week (done / planned). Shaded band: a typical productive range. A secondary muscle counts as half a set; warm-ups don't count.</p></div>`;
}

/* ================= strength chart (best estimated 1-rep max per session) ================= */
function strengthSeries(exId) {
  return S.workouts.map(w => { const sets = w.sets.filter(s => s.exId === exId && s.done && s.type !== 'warm' && s.weightKg > 0); if (!sets.length) return null; return [w.date, Math.max(...sets.map(s => e1rm(s.weightKg, s.reps)))]; }).filter(Boolean);
}
function strengthChart(exId) {
  const pts = strengthSeries(exId);
  if (pts.length < 2) return '';
  const W = 340, H = 150, L = 36, R = 12, T = 12, B = 22;
  const vals = pts.map(p => kgToDisp(S, p[1], 1));
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(2, (hi - lo) * 0.15); lo -= pad; hi += pad;
  const span = Math.max(1, daysBetween(pts[0][0], pts[pts.length - 1][0]));
  const X = k => L + daysBetween(pts[0][0], k) / span * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(vals[i]).toFixed(1)}`).join(' ');
  const best = Math.max(...vals), first = vals[0];
  return `<div class="stack" style="gap:6px"><div class="row between"><span class="label">Strength trend</span><span class="small"><b>${Math.round(best)} ${wUnit(S)}</b> <span class="faint">est. 1-rep max${best > first ? ` · +${Math.round(best - first)}` : ''}</span></span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated one-rep max over time">
      ${[lo + (hi - lo) * 0.2, hi - (hi - lo) * 0.2].map(v => `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${Math.round(v)}</text>`).join('')}
      <path class="trend" d="${line}"/>${pts.map((p, i) => `<circle class="raw" cx="${X(p[0]).toFixed(1)}" cy="${Y(vals[i]).toFixed(1)}" r="3"/>`).join('')}
      <circle class="end" cx="${X(pts[pts.length - 1][0]).toFixed(1)}" cy="${Y(vals[vals.length - 1]).toFixed(1)}" r="5"/>
      <text x="${L}" y="${H - 6}">${shortDate(pts[0][0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${shortDate(pts[pts.length - 1][0])}</text>
    </svg></div>`;
}

/* ================= body measurements ================= */
const MEASURES = [['waist', 'Waist'], ['chest', 'Chest'], ['hips', 'Hips'], ['arm', 'Arm'], ['thigh', 'Thigh'], ['neck', 'Neck']];
const lenUnit = () => isMetric(S) ? 'cm' : 'in';
const cmToDisp = cm => cm == null ? '' : isMetric(S) ? Math.round(cm * 10) / 10 : Math.round(cm / 2.54 * 10) / 10;
const dispToCm = v => { const n = parseFloat(v); return isNaN(n) ? null : isMetric(S) ? n : n * 2.54; };
function navyBodyFat(m) {
  if (!m || !m.waist || !m.neck) return null;
  const inch = cm => cm / 2.54, h = inch(S.profile.heightCm);
  let bf;
  if (S.profile.sex === 'female') { if (!m.hips) return null; bf = 163.205 * Math.log10(inch(m.waist + m.hips - m.neck)) - 97.684 * Math.log10(h) - 78.387; }
  else bf = 86.010 * Math.log10(inch(m.waist - m.neck)) - 70.041 * Math.log10(h) + 36.76;
  return bf > 2 && bf < 60 ? Math.round(bf * 10) / 10 : null;
}
function measureCard() {
  const list = S.measurements || [], last = list[list.length - 1], first = list[0];
  const bf = navyBodyFat(last);
  return `<div class="card"><div class="card-head"><span class="eyebrow">Measurements</span><button class="link" data-act="measure-add">Log</button></div>
    ${last ? `<div class="stats">${MEASURES.filter(([k]) => last[k]).slice(0, 3).map(([k, l]) => { const d = first && first !== last && first[k] ? cmToDisp(last[k]) - cmToDisp(first[k]) : 0; return `<div class="stat"><div class="v">${cmToDisp(last[k])}<span class="unit">${lenUnit()}</span></div><div class="k">${l}${d ? ` · ${d > 0 ? '+' : ''}${Math.round(d * 10) / 10}` : ''}</div></div>`; }).join('')}</div>
      <div class="row between"><span class="small faint">Last logged ${shortDate(last.date)}</span>${bf ? `<span class="small">Est. body fat <b>${bf}%</b></span>` : ''}</div>`
      : `<p class="small muted" style="margin:0">Waist and other measurements show changes the scale misses. Log them every 2–4 weeks.</p>`}</div>`;
}

/* Progress photos were removed (v1.13): Groundwork doesn't keep photos of people.
   Earlier versions stored them on the device only; this deletes any that are still there, once. */
(() => {
  try {
    if (localStorage.getItem('groundwork.photosRemoved')) return;
    if (window.indexedDB) indexedDB.deleteDatabase('groundwork-photos');
    localStorage.setItem('groundwork.photosRemoved', '1');
  } catch (e) { /* storage blocked: nothing to clean */ }
})();

/* ================= sheets ================= */
Object.assign(SHEETS, {
  plates(s) {
    const metric = isMetric(S), bars = BARS[metric ? 'metric' : 'imperial'];
    const barKg = dispToKg(S, s.bar != null ? s.bar : bars[0][1]);
    const totalKg = s.kg || barKg;
    const b = plateBreakdown(totalKg, barKg, metric);
    const color = p => ({ 45: '#C8102E', 25: '#C8102E', 35: '#F2C200', 20: '#1F5FBF', 15: '#F2C200', 10: '#2E8B57', 5: '#EEF2F0', 2.5: '#555', 1.25: '#999' })[p] || '#888';
    return sheetHead('Plate calculator', 'Plates to load on each side')
      + `<div class="field"><label for="pl-w">Total weight (${wUnit(S)})</label><input class="input" id="pl-w" inputmode="decimal" data-plates value="${kgToDisp(S, totalKg)}"></div>
      <div class="seg">${bars.map(([l, v]) => `<button data-act="plate-bar" data-v="${v}" aria-pressed="${kgToDisp(S, barKg) === v}">${v} ${wUnit(S)}</button>`).join('')}</div>
      <div class="plates-viz" aria-hidden="true"><span class="bar-end"></span>${b.side.map(p => `<span class="plate" style="background:${color(p)};height:${40 + Math.min(1, p / (metric ? 25 : 45)) * 70}px"></span>`).join('')}<span class="bar-shaft"></span></div>
      <p class="h3" style="margin:0">${b.side.length ? b.side.join(' + ') + ` ${wUnit(S)} per side` : 'Just the bar'}</p>
      ${b.left > 0 ? `<p class="small" style="color:var(--fuel);margin:0">${b.left} ${wUnit(S)} per side can't be made with standard plates; round to the nearest loadable weight.</p>` : ''}
      <p class="tiny faint">Bar: ${kgToDisp(S, barKg)} ${wUnit(S)}. Plates assumed: ${(metric ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]).join(', ')} ${wUnit(S)}.</p>`;
  },
  rx(s) {
    const w = S.plan.workouts.find(x => x.id === s.wid), it = w.items[s.idx], ex = EX_BY_ID[it.exId];
    const u = ex.unit === 'min' ? 'min' : ex.unit === 'sec' ? 's' : 'reps';
    const step = (k, label, v, unit) => `<div class="row between"><span class="small"><b>${label}</b></span><div class="row" style="gap:8px"><button class="icon-btn" data-act="rx-step" data-k="${k}" data-v="-1" aria-label="Less">−</button><span class="num" style="min-width:64px;text-align:center"><b>${v}</b> ${unit}</span><button class="icon-btn" data-act="rx-step" data-k="${k}" data-v="1" aria-label="More">+</button></div></div>`;
    return sheetHead(esc(ex.name), esc(w.name))
      + step('sets', 'Sets', it.sets, '') + step('min', 'Low end', it.min, u) + step('max', 'High end', it.max, u) + (ex.unit === 'min' ? '' : step('rest', 'Rest', it.rest, 's'))
      + `<p class="tiny faint">Applies to this workout from now on. Progression uses the rep range: hit the high end on every set and the logger suggests more weight.</p><button class="btn train block" data-act="close-sheet">Done</button>`;
  },
  measure(s) {
    const last = (S.measurements || []).slice(-1)[0] || {};
    return sheetHead('Log measurements', `In ${lenUnit() === 'in' ? 'inches' : 'centimeters'}. Measure in the morning, tape snug but not tight.`)
      + `<div class="grid2">${MEASURES.map(([k, l]) => `<div class="field"><label for="ms-${k}">${l}</label><input class="input" id="ms-${k}" inputmode="decimal" placeholder="${last[k] ? cmToDisp(last[k]) : ''}"></div>`).join('')}</div>
      <p class="tiny faint">Waist at the navel; hips at the widest point; arm and thigh at the widest point, relaxed; neck just below the Adam's apple. Neck + waist (+ hips for women) give an estimated body-fat percentage.</p>
      <button class="btn train block" data-act="measure-save">Save</button>`;
  },
});

/* Plan preview: adds per-exercise set/rep editing (Standard and Advanced) and custom-workout controls. */
const _preview = SHEETS.preview;
SHEETS.preview = s => {
  const w = S.plan.workouts.find(x => x.id === s.id);
  if (!w) return sheetHead('Workout', '') + '<p class="muted">This workout no longer exists.</p>';
  if (isGuidedView() && !w.custom) return _preview(s);
  const edit = !isGuidedView();
  return sheetHead(esc(w.name), esc(w.focus || (w.custom ? 'Your own workout' : '')))
    + (w.custom ? `<div class="field"><label for="cw-name">Workout name</label><input class="input" id="cw-name" data-cwname="${w.id}" value="${esc(w.name)}"></div>` : '')
    + (w.items.length ? `<div class="list">${w.items.map((it, i) => exRow(it, `data-act="open-ex" data-id="${it.exId}"`, `<span class="row" style="gap:0;flex:none">${edit ? `<span class="icon-btn" role="button" tabindex="0" data-act="rx-open" data-wid="${w.id}" data-idx="${i}" aria-label="Edit sets and reps for ${esc(EX_BY_ID[it.exId].name)}">${icon('sliders', 18)}</span>` : ''}<span class="icon-btn" role="button" tabindex="0" data-act="swap" data-scope="plan" data-wid="${w.id}" data-idx="${i}" aria-label="Swap ${esc(EX_BY_ID[it.exId].name)}">${icon('swap', 18)}</span>${w.items.length > 1 || w.custom ? `<span class="icon-btn" role="button" tabindex="0" data-act="remove-ex" data-scope="plan" data-wid="${w.id}" data-idx="${i}" aria-label="Remove ${esc(EX_BY_ID[it.exId].name)}">${icon('trash', 18)}</span>` : ''}</span>`)).join('')}</div>` : `<div class="empty">No exercises yet. Add the first one.</div>`)
    + `<button class="btn ghost block" data-act="add-ex" data-scope="plan" data-wid="${w.id}">${icon('plus', 18)} Add an exercise</button>`
    + (w.custom ? `<p class="small faint">To put it on your schedule, tap a day under This week and choose <b>${esc(w.name)}</b>.</p><button class="btn danger sm" data-act="cw-delete" data-id="${w.id}" style="align-self:flex-start">Delete this workout</button>` : `<p class="small faint">Changes here apply to this workout from now on. To change just today's session, start the workout and edit it there.</p>`)
    + (w.items.length ? `<button class="btn train block" data-act="start-workout" data-id="${w.id}">${icon('play', 18)} Start this workout</button>` : '');
};

/* Exercise sheet: strength trend + report a demo problem. */
const _exSheet = SHEETS.exercise;
SHEETS.exercise = s => _exSheet(s) + (isGuidedView() ? '' : strengthChart(s.id))
  + `<button class="link muted small" data-act="demo-report" data-id="${s.id}" style="align-self:flex-start">${icon('info', 14)} Something wrong with this demo or its cues?</button>`;

/* Nutrition targets: Advanced nutrition controls. */
const _targets = SHEETS.targets;
SHEETS.targets = s => _targets(s) + (isAdvanced() ? advancedNutritionCard() : '');
function advancedNutritionCard() {
  const T = calcTargets(S), today = todayKey(), brk = S.dietBreak && S.dietBreak.end >= today ? S.dietBreak : null;
  const n = S.schedule.days.length, shift = Math.round(T.calories * 0.1 / 10) * 10, rest = n < 7 ? Math.round(shift * n / (7 - n) / 10) * 10 : 0;
  const maint = Math.round(T.tdee / 10) * 10;
  return `<div class="card" style="box-shadow:none"><span class="eyebrow">Advanced nutrition</span>
    <div class="toggle"><span class="small"><b>More carbs on training days</b><br><span class="faint">${n < 7 ? `Training days +${shift} kcal, rest days −${rest} kcal, all from carbs. Weekly total stays the same.` : 'Needs at least one rest day.'}</span></span><button class="switch" role="switch" aria-checked="${!!S.macros.cycle}" data-act="adv-cycle" aria-label="Carb cycling"></button></div>
    ${T.calories < maint ? `<div class="toggle"><span class="small"><b>Refeed today</b><br><span class="faint">Eat at maintenance (${fmtInt(maint)} kcal) with the extra from carbs. Useful once every 1–2 weeks in a long diet.</span></span><button class="switch" role="switch" aria-checked="${!!(S.refeeds && S.refeeds[today])}" data-act="adv-refeed" aria-label="Refeed day today"></button></div>
    <div class="stack" style="gap:6px"><span class="small"><b>Diet break</b> <span class="faint">${brk ? `on until ${shortDate(brk.end)}: maintenance calories, check-ins paused` : '1–2 weeks at maintenance to recover from a long cut'}</span></span>
      ${brk ? `<button class="btn ghost sm" data-act="adv-break" data-v="0" style="align-self:flex-start">End diet break</button>` : `<div class="row" style="gap:8px"><button class="btn ghost sm" data-act="adv-break" data-v="7">1 week</button><button class="btn ghost sm" data-act="adv-break" data-v="14">2 weeks</button></div>`}</div>` : `<p class="tiny faint">Refeeds and diet breaks appear when you're eating below maintenance.</p>`}
  </div>`;
}
function dayTypeChip(T) {
  if (!T || !T.dayType) return '';
  const lbl = { training: 'Training day', rest: 'Rest day', refeed: 'Refeed day', break: 'Diet break' }[T.dayType];
  return `<span class="tag fuel" style="align-self:flex-start">${lbl}${T.dayDelta ? ` · ${T.dayDelta > 0 ? '+' : '−'}${fmtInt(Math.abs(T.dayDelta))} kcal carbs` : ''}</span>`;
}

/* ================= view hooks ================= */
const _macroRow = macroRow;
macroRow = (tot, T) => dayTypeChip(T) + _macroRow(tot, T);
const _viewProgress = viewProgress;
viewProgress = () => {
  let html = _viewProgress();
  if (isGuidedView()) return html;
  const extra = (isAdvanced() ? volumeCard() : '') + measureCard();
  const marker = '<div class="card"><div class="card-head"><span class="eyebrow">Personal records';
  return html.includes(marker) ? html.replace(marker, extra + marker) : html + extra;
};
const _viewPlan = viewPlan;
viewPlan = () => _viewPlan() + (isGuidedView() ? '' : `<button class="btn ghost block" data-act="cw-new">${icon('plus', 18)} Create your own workout</button>`);

/* Custom workouts survive plan rebuilds and new blocks. */
const _buildPlan = buildPlan;
buildPlan = function (state, block) {
  const P = _buildPlan(state, block);
  (state.customWorkouts || []).forEach(w => { if (!P.workouts.some(x => x.id === w.id)) P.workouts.push(JSON.parse(JSON.stringify(w))); });
  return P;
};
const _saveAdv = save;
save = function () { if (S.plan) S.customWorkouts = S.plan.workouts.filter(w => w.custom).map(w => JSON.parse(JSON.stringify(w))); _saveAdv(); };

/* During a diet break, the weekly check-in holds calories. */
const _computeCheckin = computeCheckin;
computeCheckin = function (state, adherence) {
  const r = _computeCheckin(state, adherence), b = state.dietBreak, today = todayKey();
  if (b && b.end >= addDays(today, -6) && b.start <= today) { r.adjust = 0; r.message = 'Diet break this week, so weight may tick up from extra food and water. Calories stay the same; the check-in resumes after the break.'; }
  return r;
};

/* ================= actions ================= */
Object.assign(ACT, {
  'set-type': t => { const r = S.activeWorkout.items[+t.dataset.i].rows[+t.dataset.j]; r.type = !r.type ? 'warm' : r.type === 'warm' ? 'drop' : undefined; if (!r.type) delete r.type; save(); render(); },
  'add-drop': t => { const it = S.activeWorkout.items[+t.dataset.i]; const last = [...it.rows].reverse().find(r => r.weightKg) || {}; it.rows.push({ weightKg: last.weightKg ? roundLoad(S, last.weightKg * 0.8) : null, reps: null, done: false, type: 'drop' }); save(); render(); },
  'superset': t => { const it = S.activeWorkout.items[+t.dataset.i]; it.superset = !it.superset; save(); render(); toast(it.superset ? 'Superset: rest starts after the next exercise' : 'Superset removed'); },
  'plates': t => { const it = S.activeWorkout && S.activeWorkout.items[+t.dataset.i]; const r = it && ([...it.rows].reverse().find(x => x.weightKg) || {}); pushSheet({ type: 'plates', kg: r && r.weightKg || null }); },
  'plate-bar': t => { UI.sheet.bar = Number(t.dataset.v); render(); },
  'rx-open': t => pushSheet({ type: 'rx', wid: t.dataset.wid, idx: Number(t.dataset.idx) }),
  'rx-step': t => {
    const s = UI.sheet, it = S.plan.workouts.find(x => x.id === s.wid).items[s.idx], k = t.dataset.k, d = Number(t.dataset.v);
    if (k === 'sets') it.sets = Math.min(10, Math.max(1, it.sets + d));
    if (k === 'min') it.min = Math.max(1, Math.min(it.max, it.min + d));
    if (k === 'max') it.max = Math.max(it.min, it.max + d);
    if (k === 'rest') it.rest = Math.min(600, Math.max(0, it.rest + d * 15));
    save(); render();
  },
  'cw-new': () => {
    const w = { id: 'cw_' + uid(), key: 'custom', custom: true, name: 'My workout', focus: 'Custom', items: [] };
    S.plan.workouts.push(w); save(); pushSheet({ type: 'preview', id: w.id, key: w.id });
  },
  'cw-delete': t => confirmSheet('Delete this workout?', 'Days using it become rest days. Your history is kept.', 'Delete', () => {
    const id = t.dataset.id, P = S.plan;
    P.workouts = P.workouts.filter(w => w.id !== id);
    Object.keys(P.dayMap).forEach(d => { if (P.dayMap[d] === id) { delete P.dayMap[d]; S.schedule.days = S.schedule.days.filter(x => x !== Number(d)); } });
    Object.keys(P.overrides || {}).forEach(k => { if (P.overrides[k] === id) delete P.overrides[k]; });
    save(); closeAll(); toast('Workout deleted');
  }, true),
  'vol-week': t => { UI.volWeek = addDays(UI.volWeek || weekStart(todayKey()), Number(t.dataset.v)); if (UI.volWeek > weekStart(todayKey())) UI.volWeek = weekStart(todayKey()); render(); },
  'measure-add': () => pushSheet({ type: 'measure' }),
  'measure-save': () => {
    const m = { date: todayKey() }; let any = false;
    MEASURES.forEach(([k]) => { const el = document.getElementById('ms-' + k); const v = el && dispToCm(el.value); if (v) { m[k] = v; any = true; } });
    if (!any) { toast('Enter at least one measurement'); return; }
    S.measurements = (S.measurements || []).filter(x => x.date !== m.date).concat([m]).sort((a, b) => a.date < b.date ? -1 : 1);
    save(); closeAll(); toast('Measurements saved');
  },
  'adv-cycle': () => { S.macros.cycle = !S.macros.cycle; save(); render(); },
  'adv-refeed': () => { const k = todayKey(); S.refeeds = S.refeeds || {}; if (S.refeeds[k]) delete S.refeeds[k]; else S.refeeds[k] = true; save(); render(); toast(S.refeeds[k] ? 'Refeed day: targets raised to maintenance' : 'Refeed removed'); },
  'adv-break': t => { const n = Number(t.dataset.v); const k = todayKey(); S.dietBreak = n ? { start: k, end: addDays(k, n - 1) } : null; save(); render(); toast(n ? `Diet break until ${shortDate(addDays(k, n - 1))}` : 'Diet break ended'); },
  'demo-report': t => { const ex = EX_BY_ID[t.dataset.id]; pushSheet({ type: 'feedback', draft: { areas: ['Exercise demos'], confusing: `Exercise: ${ex.name} (${ex.id}). What looks wrong: ` } }); },
});
/* Rest timer: inside a superset, rest starts only after the partner exercise. */
const _toggleSet = ACT['toggle-set'];
ACT['toggle-set'] = t => { _toggleSet(t); const it = S.activeWorkout && S.activeWorkout.items[+t.dataset.i]; if (it && it.superset && UI.rest) { UI.rest = null; render(); } };

document.addEventListener('change', async e => {
  const el = e.target; if (!el || !el.dataset) return;
  if (el.dataset.rir != null && S.activeWorkout) { const r = S.activeWorkout.items[+el.dataset.i].rows[+el.dataset.j]; if (el.value === '') delete r.rir; else r.rir = Number(el.value); save(); }
  if (el.dataset.cwname) { const w = S.plan.workouts.find(x => x.id === el.dataset.cwname); if (w) { w.name = el.value.trim() || 'My workout'; save(); render(); } }
  if (el.dataset.plates != null && UI.sheet && UI.sheet.type === 'plates') { UI.sheet.kg = dispToKg(S, el.value); render(); }
});
