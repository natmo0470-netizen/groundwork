/* Groundwork — nutrition and progress screens, and all bottom sheets. */

/* ================= nutrition ================= */
function viewFoodLog() {
  const k = UI.foodDate, T = calcTargets(S, k), tot = foodTotals(S, k);
  const items = S.foodLog[k] || [];
  const left = T.calories - tot.kcal;
  const isToday = k === todayKey();
  return `<div class="datenav"><button class="icon-btn" data-act="food-day" data-v="-1" aria-label="Previous day">${icon('chevL', 20)}</button>
      <b>${isToday ? 'Today' : k === addDays(todayKey(), -1) ? 'Yesterday' : prettyDate(k)}</b>
      <button class="icon-btn" data-act="food-day" data-v="1" aria-label="Next day" ${isToday ? 'disabled style="opacity:.35"' : ''}>${icon('chevR', 20)}</button></div>
    <div class="card fuel">
      <div class="ring-wrap"><div class="ring">${ring(tot.kcal, T.calories, 'var(--fuel)')}<div class="c"><span class="mid-num ${left < 0 ? 'over' : ''}">${fmtInt(Math.abs(left))}</span><span class="tiny faint">${left < 0 ? 'kcal over' : 'kcal left'}</span></div></div>
        <div class="kv"><div class="row"><span class="small muted">Target</span><b class="num">${fmtInt(T.calories)}</b></div><div class="row"><span class="small muted">Eaten</span><b class="num">${fmtInt(tot.kcal)}</b></div>
        <button class="link fuel" data-act="open-targets" style="text-align:left">${T.custom ? 'Custom macros' : 'Recommended for ' + GOALS[S.profile.goal].short.toLowerCase()} · Edit</button></div></div>
      ${macroRow(tot, T)}
    </div>
    ${isGuided() ? `<button class="link fuel small" data-act="open-guide" data-id="portions" style="align-self:flex-start">${icon('book', 16)} No food scale? Use your hand</button>` : ''}
    ${MEALS.map(([id, label]) => {
      const list = items.filter(i => i.meal === id);
      const kcal = list.reduce((s, i) => s + i.kcal * i.servings, 0);
      return `<div class="card" style="gap:4px"><div class="meal-head"><span class="h3">${label}</span><span class="small faint num">${list.length ? fmtInt(kcal) + ' kcal' : ''}</span></div>
        ${list.map(i => `<button class="food-row" data-act="edit-food" data-id="${i.id}"><span class="grow" style="min-width:0"><span class="t">${esc(i.name)}</span><br><span class="d">${fmtServ(i.servings)} × ${esc(i.serving)} · <span class="pcf"><b class="p">P ${r0(i.p * i.servings)}</b> <b class="c">C ${r0(i.c * i.servings)}</b> <b class="f">F ${r0(i.f * i.servings)}</b></span></span></span><span class="kcal">${fmtInt(i.kcal * i.servings)}</span></button>`).join('')}
        <button class="link fuel" data-act="add-food" data-meal="${id}" style="align-self:flex-start;padding:8px 0 2px">${icon('plus', 16)} Add food</button></div>`;
    }).join('')}`;
}
function fmtServ(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }

/* ================= progress ================= */
function viewProgress() {
  const lw = lastWeight(S), first = S.weights[0];
  const ci = checkinStatus(S);
  const T = calcTargets(S);
  const today = todayKey();
  const wk = avgWeight(S, addDays(today, -6), today);
  const prs = prBoard(S).slice(0, 8);
  const chart = weightChart(S, UI.chartRange);
  const change = lw && first ? lw.kg - first.kg : 0;
  return `<div class="stack" style="gap:2px"><span class="eyebrow">Progress</span><h1 class="h1">How it's going</h1></div>
    <div class="card">
      <div class="card-head"><span class="eyebrow">Body weight</span><button class="link" data-act="log-weight">Log weight</button></div>
      <div class="stats"><div class="stat"><div class="v">${lw ? kgToDisp(S, lw.kg) : '—'}</div><div class="k">Latest (${wUnit(S)})</div></div>
        <div class="stat"><div class="v">${wk ? kgToDisp(S, wk.avg) : '—'}</div><div class="k">7-day average</div></div>
        <div class="stat"><div class="v">${first && lw ? (change > 0 ? '+' : '') + kgToDisp(S, change) : '—'}</div><div class="k">Since start</div></div></div>
      ${chart ? chart + `<div class="seg">${[[30, '30 days'], [90, '90 days'], [0, 'All']].map(([v, l]) => `<button data-act="chart-range" data-v="${v}" aria-pressed="${UI.chartRange === v}">${l}</button>`).join('')}</div><p class="tiny faint">Dots are daily weigh-ins; the line is the 7-day average, which smooths out water swings.</p>`
        : `<div class="empty">${icon('scale', 28)}<span>Log your weight a few times to see your trend.</span></div>`}
    </div>
    <div class="card">
      <div class="card-head"><span class="eyebrow">Weekly check-in</span>${ci.due ? `<span class="tag fuel">Ready</span>` : `<span class="tag">In ${ci.daysUntil} day${ci.daysUntil === 1 ? '' : 's'}</span>`}</div>
      <p class="small muted">Each week Groundwork compares your average weight with the week before and nudges calories up or down so you keep moving toward your goal.</p>
      ${ci.due ? `<button class="btn train block" data-act="open-checkin">Start check-in</button>` : ''}
      ${S.checkins.length ? `<div class="list">${S.checkins.slice().reverse().slice(0, 5).map(c => `<div class="li"><span class="grow"><span class="t">${shortDate(c.date)}</span><br><span class="d">${c.change != null ? `${c.change > 0 ? '+' : ''}${kgToDisp(S, c.change, 1)} ${wUnit(S)} vs last week` : 'Baseline'}</span></span><span class="r tag ${c.adjust ? 'fuel' : ''}">${c.adjust ? (c.adjust > 0 ? '+' : '') + c.adjust + ' kcal' : 'No change'}</span></div>`).join('')}</div>` : ''}
    </div>
    <div class="card fuel"><div class="card-head"><span class="eyebrow">Calories, last 7 days</span></div>${calorieChart(S, T.calories)}</div>
    <div class="card train">
      <div class="card-head"><span class="eyebrow">Training</span></div>
      <div class="stats"><div class="stat"><div class="v">${weekDoneCount()}/${weekPlannedCount()}</div><div class="k">This week</div></div><div class="stat"><div class="v">${S.workouts.length}</div><div class="k">Workouts</div></div><div class="stat"><div class="v">${S.workouts.reduce((n, w) => n + (w.prs || []).length, 0)}</div><div class="k">${term('prs')}</div></div></div>
    </div>
    <div class="card"><div class="card-head"><span class="eyebrow">Personal records</span>${icon('trophy', 18, 'style="color:var(--fuel)"')}</div>
      ${prs.length ? `<div class="list">${prs.map(r => `<button class="li pr-row" data-act="open-ex" data-id="${r.ex.id}"><span class="medal">${icon('trophy', 18)}</span><span class="grow"><span class="t">${esc(r.ex.name)}</span><br><span class="d">${r.maxW ? `Best: ${kgToDisp(S, r.maxW)} ${wUnit(S)} × ${r.maxWReps}` : `Best: ${r.maxReps} reps`}</span></span>${r.best1 ? `<span class="r"><b class="num">${kgToDisp(S, r.best1, 0)}</b><br><span class="tiny faint">est. 1-rep max</span></span>` : ''}</button>`).join('')}</div>`
        : `<div class="empty">${icon('trophy', 28)}<span>Finish a workout and your best lifts show up here.</span></div>`}
    </div>
    <div class="card"><span class="eyebrow">Workout history</span>
      ${S.workouts.length ? `<div class="list">${S.workouts.slice().reverse().slice(0, 12).map(w => `<button class="li" data-act="history" data-id="${w.id}"><span class="grow"><span class="t">${esc(w.name)}</span><br><span class="d">${prettyDate(w.date)} · ${w.durationMin} min · ${w.sets.length} sets</span></span>${(w.prs || []).length ? `<span class="tag fuel">${w.prs.length} PR</span>` : ''}<span class="chev">${icon('chevR', 18)}</span></button>`).join('')}</div>`
        : `<div class="empty">No workouts yet.</div>`}
    </div>`;
}

/* ================= sheets ================= */
function sheetHtml() {
  const s = UI.sheet;
  const fn = SHEETS[s.type];
  const inner = fn ? fn(s) : '';
  return `<div class="sheet ${s.tall ? 'tall' : ''}" role="dialog" aria-modal="true">${inner}</div>`;
}
function sheetHead(title, sub) {
  return `<div class="grab"></div><div class="sheet-head"><div class="grow"><div class="h2">${title}</div>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><button class="icon-btn" data-act="close-sheet" aria-label="Close">${icon('x', 22)}</button></div>`;
}

const SHEETS = {
  exercise(s) {
    const ex = EX_BY_ID[s.id];
    const b = bestsFor(S, ex.id);
    const reqTxt = ex.req.length ? ex.req.map(r => EQUIPMENT.find(e => e.id === r).label).join(' + ') : 'No equipment';
    return sheetHead(esc(ex.name), esc(ex.muscles.join(' · ')))
      + `<div class="demo"><div data-demo="${ex.anim}|${ex.prop}" data-label="${esc(ex.name)} demonstration"></div><button class="btn sm soft demo-ctrl" data-act="demo-toggle"></button></div>
      <div class="chips"><span class="tag train">${esc(ex.group)}</span><span class="tag">${esc(reqTxt)}</span><span class="tag">${['', 'Beginner-friendly', 'Intermediate', 'Advanced'][ex.diff]}</span></div>
      <div class="stack"><span class="eyebrow">How to do it</span><ol class="cues">${ex.cues.map(c => `<li>${esc(c)}</li>`).join('')}</ol></div>
      ${b.maxW || b.maxReps ? `<div class="card" style="box-shadow:none"><span class="eyebrow">Your best</span><div class="row"><span class="mid-num">${b.maxW ? kgToDisp(S, b.maxW) + `<span class="unit">${wUnit(S)}</span> × ${b.maxWReps}` : b.maxReps + '<span class="unit">' + (ex.unit === 'reps' ? 'reps' : ex.unit) + '</span>'}</span></div></div>` : ''}
      ${s.ctx != null && S.activeWorkout ? `<button class="btn ghost block" data-act="swap" data-scope="active" data-idx="${s.ctx}">${icon('swap', 18)} Swap for another exercise</button>` : ''}`;
  },

  pick(s) {
    let sub;
    if (s.mode === 'swap') {
      const cur = EX_BY_ID[pickSource(s).exId];
      sub = `Replacing ${esc(cur.name)}`;
    } else {
      sub = s.scope === 'active' ? 'Adds it to the end of today\'s workout' : `Adds it to ${esc(S.plan.workouts.find(w => w.id === s.wid).name)} from now on`;
    }
    const groups = (s.mode === 'swap' ? ['Similar'] : []).concat(['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio']);
    return sheetHead(s.mode === 'swap' ? 'Swap exercise' : 'Add an exercise', sub)
      + `<div class="input-suffix"><input class="input" id="pick-q" type="text" inputmode="search" placeholder="Search all exercises" value="${esc(s.q || '')}" autocomplete="off" aria-label="Search exercises"><span>${icon('search', 18)}</span></div>
      <div class="chips scroll">${groups.map(g => `<button class="chip" data-act="pick-group" data-v="${g}" aria-pressed="${s.group === g}">${g === 'Similar' ? 'Similar movement' : g}</button>`).join('')}</div>
      <div class="toggle" style="padding:0"><span class="small"><b>Only my equipment</b></span><button class="switch" role="switch" aria-checked="${s.mine}" data-act="pick-mine" aria-label="Only my equipment"></button></div>
      <div class="list" id="pick-list">${pickRows(s)}</div>`;
  },

  preview(s) {
    const w = S.plan.workouts.find(x => x.id === s.id);
    return sheetHead(esc(w.name), esc(w.focus))
      + `<div class="list">${w.items.map((it, i) => exRow(it, `data-act="open-ex" data-id="${it.exId}"`, `<span class="row" style="gap:0;flex:none"><span class="icon-btn" role="button" tabindex="0" data-act="swap" data-scope="plan" data-wid="${w.id}" data-idx="${i}" aria-label="Swap ${esc(EX_BY_ID[it.exId].name)}">${icon('swap', 18)}</span>${w.items.length > 1 ? `<span class="icon-btn" role="button" tabindex="0" data-act="remove-ex" data-scope="plan" data-wid="${w.id}" data-idx="${i}" aria-label="Remove ${esc(EX_BY_ID[it.exId].name)}">${icon('trash', 18)}</span>` : ''}</span>`)).join('')}</div>
      <button class="btn ghost block" data-act="add-ex" data-scope="plan" data-wid="${w.id}">${icon('plus', 18)} Add an exercise</button>
      <p class="small faint">Changes here apply to this workout from now on. To change just today's session, start the workout and edit it there.</p>
      <button class="btn train block" data-act="start-workout" data-id="${w.id}">${icon('play', 18)} Start this workout</button>`;
  },

  daySwap(s) {
    const k = s.date, dow = parseKey(k).getDay(), P = S.plan;
    const cur = workoutForDate(S, k), ws = weekStart(k);
    const once = s.scope === 'once';
    const opt = (id, title, sub, current) => `<button class="li" data-act="day-set" data-id="${id}" ${current ? 'aria-current="true"' : ''}><span class="grow"><span class="t">${esc(title)}</span>${sub ? `<br><span class="d">${esc(sub)}</span>` : ''}</span>${current ? '<span class="tag train">Current</span>' : `<span class="chev">${icon('chevR', 18)}</span>`}</button>`;
    const inPlan = workoutsInUse(S);
    const planKeys = new Set(inPlan.map(w => w.key));
    const extra = P.workouts.filter(w => !inPlan.includes(w));
    const types = SESSION_TYPES.filter(([key]) => !planKeys.has(key) && !extra.some(w => w.key === key));
    return sheetHead(`${DOW_LONG[dow]}, ${shortDate(k)}`, cur ? `Planned: ${esc(cur.name)}` : 'Rest day')
      + `<div class="seg"><button data-act="day-scope" data-v="once" aria-pressed="${once}">Just ${shortDate(k)}</button><button data-act="day-scope" data-v="always" aria-pressed="${!once}">Every ${DOW_LONG[dow]}</button></div>
      ${cur ? `<div class="grid2"><button class="btn ghost sm" data-act="preview-workout" data-id="${cur.id}">Preview</button><button class="btn train sm" data-act="start-workout" data-id="${cur.id}">${icon('play', 16)} Start</button></div>` : ''}
      <span class="label">Switch to</span>
      <div class="list">${inPlan.map(w => opt(w.id, w.name, w.focus, cur && cur.id === w.id)).join('')}
        ${extra.map(w => opt(w.id, w.name, w.focus, cur && cur.id === w.id)).join('')}
        ${types.map(([key, title, sub]) => opt('tpl:' + key, title, sub, false)).join('')}
        ${opt('rest', 'Rest day', 'Recover; a walk counts', !cur)}</div>
      <span class="label">Or trade with another day</span>
      <div class="chips">${[...Array(7)].map((_, i) => addDays(ws, i)).filter(x => x !== k).map(x => { const w = workoutForDate(S, x); return `<button class="chip" data-act="day-trade" data-date="${x}">${DOW[parseKey(x).getDay()]} · ${w ? esc(w.name) : 'Rest'}</button>`; }).join('')}</div>
      <p class="tiny faint">${once ? `Only ${prettyDate(k)} changes; the rest of your plan stays the same.` : `Changes every ${DOW_LONG[dow]} from now on.`}</p>`;
  },

  programs(s) {
    const f = s.filter || 'all', cur = S.plan && S.plan.program;
    const list = PROGRAMS.filter(p => f === 'all' || p.tags.includes(f));
    return sheetHead('Programs', 'Ready-made plans. Exercises adjust to your equipment.')
      + `<div class="chips scroll">${PROGRAM_FILTERS.map(([id, label]) => `<button class="chip" data-act="prog-filter" data-v="${id}" aria-pressed="${f === id}">${label}</button>`).join('')}</div>
      ${cur ? '' : `<div class="card train" style="box-shadow:none;padding:12px 14px"><div class="small"><b>You're on a custom plan</b> built from your goal, days and equipment.</div></div>`}
      <div class="list">${list.map(p => `<button class="li" data-act="open-program" data-id="${p.id}"><span class="grow"><span class="t">${esc(p.name)}</span>${cur === p.id ? ' <span class="tag train" style="font-size:11px;padding:1px 6px">Current</span>' : ''}<br><span class="d">${p.days} days/week · ${p.weeks} weeks · ${p.level[0].toUpperCase() + p.level.slice(1)} · ${esc(p.equip)}</span><br><span class="d">${esc(p.tagline)}</span></span><span class="chev">${icon('chevR', 18)}</span></button>`).join('')}</div>
      ${cur ? `<button class="btn ghost block" data-act="prog-leave">Switch back to a custom plan</button>` : ''}`;
  },

  program(s) {
    const prog = PROGRAM_BY_ID[s.id], d = s.draft, cur = S.plan && S.plan.program === prog.id;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const tmp = Object.assign({}, S, { schedule: { days: d.days, minutes: S.schedule.minutes } });
    const sessions = prog.sessions.map((_, i) => buildProgramSession(prog, i, tmp, equipList(S)));
    const fit = programFits(prog, S);
    const n = d.days.length;
    return sheetHead(esc(prog.name), `${prog.days} days/week · ${prog.weeks} weeks · ${prog.level[0].toUpperCase() + prog.level.slice(1)}`)
      + `<p class="muted">${esc(prog.about)}</p>
      ${fit.missing ? `<p class="small" style="color:var(--fuel)">${fit.missing} of ${fit.total} exercises are swapped for ones that fit your equipment (${esc(equipSummary())}).</p>` : ''}
      <span class="label">Your training days</span>
      <div class="daypick">${order.map(x => `<button data-act="prog-day" data-d="${x}" aria-pressed="${d.days.includes(x)}" aria-label="${DOW_LONG[x]}">${DOW[x].slice(0, 2)}</button>`).join('')}</div>
      <p class="small faint">${n === prog.days ? (prog.cycle ? 'Sessions alternate across your training days.' : 'One session per training day.') : `Written for ${prog.days} days. With ${n}, the ${prog.sessions.length} sessions rotate in order across your days.`}</p>
      ${sessions.map(w => `<div class="card" style="box-shadow:none"><div><div class="h3">${esc(w.name)}</div><div class="small muted">${esc(w.focus)}</div></div><div class="list">${w.items.map(it => exRow(it, `data-act="open-ex" data-id="${it.exId}"`)).join('')}</div></div>`).join('')}
      <button class="btn train block" data-act="prog-start" ${n < 1 ? 'disabled' : ''}>${cur ? 'Restart this program' : 'Start this program'}</button>
      <p class="tiny faint">Starting a program replaces your current plan. Your workout history and records are kept.</p>`;
  },

  summary(s) {
    const w = S.workouts.find(x => x.id === s.wid);
    const vol = w.sets.reduce((v, x) => v + (x.weightKg || 0) * (x.reps || 0), 0);
    return sheetHead('Workout complete', esc(w.name) + ' · ' + prettyDate(w.date))
      + `<div class="stats"><div class="stat"><div class="v">${w.durationMin}<span class="unit">min</span></div><div class="k">Duration</div></div><div class="stat"><div class="v">${w.sets.length}</div><div class="k">Sets</div></div><div class="stat"><div class="v">${vol ? fmtInt(kgToDisp(S, vol, 0)) : '—'}</div><div class="k">Volume (${wUnit(S)})</div></div></div>
      ${w.prs && w.prs.length ? `<div class="card fuel" style="box-shadow:none"><div class="row">${icon('trophy', 22, 'style="color:var(--fuel)"')}<b>${w.prs.length} new personal record${w.prs.length > 1 ? 's' : ''}</b></div><div class="list">${w.prs.map(p => `<div class="li"><span class="grow t">${esc(EX_BY_ID[p.exId].name)}</span><span class="r num"><b>${p.kg ? kgToDisp(S, p.kg) + ' ' + wUnit(S) + ' × ' : ''}${p.reps}</b>${p.kg ? '' : ' reps'}</span></div>`).join('')}</div></div>`
        : `<p class="muted">${w.sets.length ? 'Solid session. Next time the logger will tell you when to add weight.' : 'No sets were logged this time.'}</p>`}
      <button class="btn train block" data-act="close-sheet">Done</button>`;
  },

  history(s) {
    const w = S.workouts.find(x => x.id === s.id);
    const byEx = {};
    w.sets.forEach(x => (byEx[x.exId] = byEx[x.exId] || []).push(x));
    return sheetHead(esc(w.name), prettyDate(w.date) + ' · ' + w.durationMin + ' min')
      + Object.entries(byEx).map(([id, sets]) => { const ex = EX_BY_ID[id]; return `<div class="card" style="box-shadow:none;gap:6px"><b>${esc(ex.name)}</b><div class="small muted num">${sets.map(x => ex.unit !== 'reps' ? `${x.reps}${ex.unit === 'min' ? ' min' : ' s'}` : x.weightKg ? `${kgToDisp(S, x.weightKg)}×${x.reps}` : `${x.reps} reps`).join(' · ')}</div></div>`; }).join('')
      + `<button class="btn danger block" data-act="delete-workout" data-id="${w.id}">${icon('trash', 18)} Delete this workout</button>`;
  },

  foodAdd(s) {
    const F = UI.food;
    return sheetHead('Add food', 'to ' + MEALS.find(m => m[0] === F.meal)[1].toLowerCase())
      + `<div class="seg">${MEALS.map(([id, l]) => `<button data-act="food-meal" data-v="${id}" aria-pressed="${F.meal === id}">${l}</button>`).join('')}</div>
      <div class="input-suffix"><input class="input" id="food-q" type="text" inputmode="search" enterkeyhint="search" placeholder="Search foods, e.g. chicken, oats" value="${esc(F.q)}" autocomplete="off" aria-label="Search foods"><span>${icon('search', 18)}</span></div>
      <div class="row wrap"><button class="btn sm fuel" data-act="scan-open">${icon('barcode', 16)} Scan barcode</button><button class="btn sm soft" data-act="quick-add">${icon('bolt', 16)} Quick add calories</button><button class="btn sm soft" data-act="custom-food">${icon('plus', 16)} Create food</button></div>
      <div id="food-results">${foodResults()}</div>`;
  },

  serving(s) {
    const f = s.food;
    const tot = k => r0(f[k] * s.servings);
    return sheetHead(esc(f.name), esc(f.serving) + (f.source ? ' · ' + esc(f.source) : ''))
      + `<div class="field"><span class="label">Servings</span><div class="stepper"><button data-act="serv-step" data-v="-0.25" aria-label="Less">−</button><input class="input big" id="serv-n" inputmode="decimal" value="${fmtServ(s.servings)}" aria-label="Servings"><button data-act="serv-step" data-v="0.25" aria-label="More">+</button></div></div>
      <div class="chips">${[0.5, 1, 1.5, 2].map(v => `<button class="chip" data-act="serv-set" data-v="${v}" aria-pressed="${s.servings === v}">${v}×</button>`).join('')}</div>
      <div class="card" style="box-shadow:none" id="serv-preview">${servPreview(f, s.servings)}</div>
      <div class="field"><span class="label">Meal</span><div class="seg">${MEALS.map(([id, l]) => `<button data-act="serv-meal" data-v="${id}" aria-pressed="${s.meal === id}">${l}</button>`).join('')}</div></div>
      <button class="btn fuel block" data-act="serv-save">${s.editId ? 'Save changes' : 'Add to log'}</button>
      ${s.editId ? `<button class="btn danger block" data-act="food-delete" data-id="${s.editId}">${icon('trash', 18)} Remove from log</button>` : ''}`;
  },

  scan(s) {
    return sheetHead('Scan a barcode', 'Point your camera at the barcode on the package')
      + `<div class="scanbox"><video id="scan-video" muted playsinline aria-label="Camera preview"></video><div class="scan-frame" aria-hidden="true"></div></div>
      <p class="small muted" id="scan-status" role="status">${esc(s.status || 'Starting camera…')}</p>
      <div id="scan-result">${s.resultHtml || ''}</div>
      <label class="btn ghost block" for="scan-photo">${icon('camera', 18)} Take or choose a photo of the barcode</label>
      <input id="scan-photo" type="file" accept="image/*" capture="environment" hidden>
      <div class="field"><label for="scan-code">Or type the barcode number</label><div class="row"><input class="input grow" id="scan-code" inputmode="numeric" placeholder="e.g. 012345678905" value="${esc(s.code || '')}"><button class="btn fuel" data-act="scan-lookup">Look up</button></div></div>`;
  },

  quick(s) {
    return sheetHead('Quick add', 'For restaurant meals or anything not in the database')
      + `<div class="field"><label for="qa-name">Name</label><input class="input" id="qa-name" placeholder="e.g. Lunch out"></div>
      <div class="field"><label for="qa-kcal">Calories</label><div class="input-suffix"><input class="input" id="qa-kcal" inputmode="numeric"><span>kcal</span></div></div>
      <div class="grid3"><div class="field"><label for="qa-p">Protein</label><div class="input-suffix"><input class="input" id="qa-p" inputmode="decimal"><span>g</span></div></div><div class="field"><label for="qa-c">Carbs</label><div class="input-suffix"><input class="input" id="qa-c" inputmode="decimal"><span>g</span></div></div><div class="field"><label for="qa-f">Fat</label><div class="input-suffix"><input class="input" id="qa-f" inputmode="decimal"><span>g</span></div></div></div>
      <p class="small faint">Leave macros blank if you only know calories.</p>
      <button class="btn fuel block" data-act="quick-save">Add to ${MEALS.find(m => m[0] === UI.food.meal)[1].toLowerCase()}</button>`;
  },

  custom(s) {
    return sheetHead('Create a food', s.barcode ? `Saved with barcode ${esc(s.barcode)}, so scanning it next time finds it instantly` : 'Saved to your foods for next time')
      + `<div class="field"><label for="cf-name">Food name</label><input class="input" id="cf-name" placeholder="e.g. Mom's chili" value="${esc(s.name || '')}"></div>
      <div class="field"><label for="cf-serv">Serving size</label><input class="input" id="cf-serv" placeholder="e.g. 1 bowl (300 g)"></div>
      <div class="grid2"><div class="field"><label for="cf-kcal">Calories</label><input class="input" id="cf-kcal" inputmode="numeric"></div><div class="field"><label for="cf-p">Protein (g)</label><input class="input" id="cf-p" inputmode="decimal"></div><div class="field"><label for="cf-c">Carbs (g)</label><input class="input" id="cf-c" inputmode="decimal"></div><div class="field"><label for="cf-f">Fat (g)</label><input class="input" id="cf-f" inputmode="decimal"></div></div>
      <button class="btn fuel block" data-act="custom-save">Save and add</button>`;
  },

  targets(s) {
    const T = calcTargets(S), R = T.rec;
    const mode = s.mode || (T.custom ? 'custom' : 'auto');
    const c = s.draft || (S.macros.custom ? { ...S.macros.custom } : { protein: R.protein, carbs: R.carbs, fat: R.fat });
    const ckcal = r0(c.protein * 4 + c.carbs * 4 + c.fat * 9);
    const pct = k => ckcal ? r0((c[k] * (k === 'fat' ? 9 : 4) / ckcal) * 100) : 0;
    return sheetHead('Calorie and macro targets', GOALS[S.profile.goal].label)
      + `<div class="card" style="box-shadow:none"><span class="eyebrow">How your target is set</span>
        <div class="math"><span>Resting burn (BMR)</span><b class="num">${fmtInt(T.bmr)}</b>
        <span>× activity (${ACTIVITY[S.profile.activity].label.toLowerCase()}) = maintenance</span><b class="num">${fmtInt(T.tdee)}</b>
        <span>Goal adjustment</span><b class="num">${T.goalAdj > 0 ? '+' : ''}${fmtInt(T.goalAdj)}</b>
        <span>Weekly check-in adjustments</span><b class="num">${T.adjust > 0 ? '+' : ''}${fmtInt(T.adjust)}</b>
        <span class="tot">Recommended daily calories</span><b class="num tot">${fmtInt(R.calories)}</b></div>
        ${T.floorApplied ? `<p class="small muted">Raised to the ${T.floor}-calorie minimum for safety.</p>` : ''}
        <p class="tiny faint">BMR uses the Mifflin-St Jeor equation. Protein is set per kg of body weight for your goal; fat is ${r0(GOALS[S.profile.goal].fatPct * 100)}% of calories; carbs fill the rest.</p></div>
      <div class="seg"><button data-act="tgt-mode" data-v="auto" aria-pressed="${mode === 'auto'}">Recommended</button><button data-act="tgt-mode" data-v="custom" aria-pressed="${mode === 'custom'}">Custom</button></div>
      ${mode === 'auto' ? `<div class="macros">${[['p', 'Protein', R.protein], ['c', 'Carbs', R.carbs], ['f', 'Fat', R.fat]].map(([k, l, v]) => `<div class="macro ${k}"><div class="k">${l}</div><div class="mid-num" style="font-size:24px">${v}<span class="unit">g</span></div></div>`).join('')}</div>
        <button class="btn fuel block" data-act="tgt-save" data-v="auto">Use recommended targets</button>`
        : `<div class="grid3">${[['protein', 'Protein'], ['carbs', 'Carbs'], ['fat', 'Fat']].map(([k, l]) => `<div class="field"><label for="tg-${k}">${l} (g)</label><input class="input" id="tg-${k}" data-tgt="${k}" inputmode="numeric" value="${c[k]}"><span class="tiny faint" id="tg-pct-${k}">${pct(k)}% of calories</span></div>`).join('')}</div>
        <div class="row between"><span class="muted">Total</span><b class="mid-num" id="tg-kcal">${fmtInt(ckcal)}<span class="unit">kcal</span></b></div>
        <p class="small faint">Recommended: ${R.protein} g protein, ${R.carbs} g carbs, ${R.fat} g fat (${fmtInt(R.calories)} kcal). Check-ins adjust custom carbs too.</p>
        <button class="btn fuel block" data-act="tgt-save" data-v="custom">Save custom macros</button>
        <button class="link muted" data-act="tgt-reset">Reset to recommended</button>`}`;
  },

  weight(s) {
    return sheetHead('Log weight', 'Best first thing in the morning')
      + `<div class="field"><label for="w-val">Weight</label><div class="input-suffix"><input class="input big" id="w-val" inputmode="decimal" value="${lastWeight(S) ? kgToDisp(S, lastWeight(S).kg) : ''}"><span>${wUnit(S)}</span></div></div>
      <div class="field"><label for="w-date">Date</label><input class="input" id="w-date" type="date" value="${todayKey()}" max="${todayKey()}"></div>
      <button class="btn train block" data-act="weight-save">Save</button>
      ${S.weights.length ? `<div class="stack"><span class="eyebrow">Recent</span><div class="list">${S.weights.slice().reverse().slice(0, 10).map(w => `<div class="li"><span class="grow">${prettyDate(w.date)}</span><b class="num">${kgToDisp(S, w.kg)} ${wUnit(S)}</b><button class="icon-btn" data-act="weight-del" data-d="${w.date}" aria-label="Delete ${prettyDate(w.date)}">${icon('trash', 18)}</button></div>`).join('')}</div></div>` : ''}`;
  },

  checkin(s) {
    const today = todayKey();
    const a = avgWeight(S, addDays(today, -6), today), b = avgWeight(S, addDays(today, -13), addDays(today, -7));
    if (s.result) {
      const r = s.result;
      const newT = calcTargets(Object.assign({}, S, { calorieAdjust: (S.calorieAdjust || 0) + r.adjust }));
      return sheetHead('Check-in result')
        + `<div class="card ${r.adjust ? 'fuel' : 'train'}" style="box-shadow:none"><div class="h2">${r.adjust ? (r.adjust > 0 ? 'Calories go up' : 'Calories go down') : 'Stay the course'}</div><p class="muted">${esc(r.message)}</p>
          ${r.adjust ? `<div class="row"><span class="mid-num">${fmtInt(calcTargets(S).calories)}</span>${icon('chevR', 18)}<span class="mid-num" style="color:var(--fuel)">${fmtInt(newT.calories)}</span><span class="unit">kcal/day</span></div>` : ''}</div>
        <button class="btn train block" data-act="checkin-apply">${r.adjust ? 'Apply new target' : 'Done'}</button>`;
    }
    return sheetHead('Weekly check-in', 'Takes 30 seconds')
      + `<div class="stats"><div class="stat"><div class="v">${a ? kgToDisp(S, a.avg) : '—'}</div><div class="k">This week avg</div></div><div class="stat"><div class="v">${b ? kgToDisp(S, b.avg) : '—'}</div><div class="k">Last week avg</div></div><div class="stat"><div class="v">${a && b ? ((a.avg - b.avg) > 0 ? '+' : '') + kgToDisp(S, a.avg - b.avg) : '—'}</div><div class="k">Change (${wUnit(S)})</div></div></div>
      <div class="stack"><b>Did you hit your calorie target most days this week?</b><div class="opts">${[['yes', 'Yes, 5 or more days'], ['mostly', 'About half the days'], ['no', 'Not really']].map(([v, l]) => `<button class="opt" data-act="checkin-answer" data-v="${v}"><span class="grow t">${l}</span>${icon('chevR', 18)}</button>`).join('')}</div></div>
      <button class="link muted" data-act="log-weight">Log today's weight first</button>`;
  },

  notifs(s) {
    const list = computeReminders(S);
    return sheetHead('Reminders', list.length ? `${list.length} for today` : 'You\'re all caught up')
      + (list.length ? list.map(nudgeHtml).join('') : `<div class="empty">${icon('check', 28)}<span>Nothing needs your attention right now.</span></div>`)
      + `<button class="btn ghost block" data-act="open-settings" data-key="reminders">Reminder settings</button>`;
  },

  confirm(s) {
    return `<div class="grab"></div><div class="stack" style="padding:6px 0"><div class="h2">${esc(s.title)}</div><p class="muted">${esc(s.body)}</p></div>
      <button class="btn ${s.danger ? 'danger' : 'train'} block" data-act="confirm-ok">${esc(s.ok)}</button><button class="btn ghost block" data-act="close-sheet">Cancel</button>`;
  },

  settings(s) {
    const p = S.profile, d = s.draft;
    const metric = p.units === 'metric';
    const order = [1, 2, 3, 4, 5, 6, 0];
    const groups = {};
    EQUIPMENT.forEach(e => (groups[e.group] = groups[e.group] || []).push(e));
    const h = cmToFtIn(p.heightCm);
    const R = S.reminders;
    const sw = (k, label, sub) => `<div class="toggle"><span class="small"><b>${label}</b>${sub ? `<br><span class="faint">${sub}</span>` : ''}</span><button class="switch" role="switch" aria-checked="${!!R[k]}" data-act="rem-toggle" data-k="${k}" aria-label="${label}"></button></div>`;
    const notifState = !notifySupported() ? 'Not supported here' : (() => { try { return Notification.permission; } catch (e) { return 'blocked'; } })();
    return sheetHead('Settings')
      + `<div class="card" style="box-shadow:none" id="set-mode"><span class="eyebrow">App experience</span>
        <div class="seg">${Object.entries(MODES).map(([k, m]) => `<button data-act="set-mode" data-v="${k}" aria-pressed="${modeOf() === k}">${m.label}</button>`).join('')}</div>
        <p class="small muted" style="margin:0">${esc(MODES[modeOf()].desc)}${S.mode ? '' : ` Set from your experience level (${EXPERIENCE[S.profile.experience].label.toLowerCase()}).`}</p>
        <div class="grid2"><button class="btn ghost sm" data-act="open-guides">${icon('book', 16)} Guides</button><button class="btn ghost sm" data-act="tips-reset">Show tips again</button></div>
      </div>
      <div class="card" style="box-shadow:none" id="set-profile"><span class="eyebrow">Profile</span>
        <div class="seg"><button data-act="set-units" data-v="imperial" aria-pressed="${!metric}">lb · ft/in</button><button data-act="set-units" data-v="metric" aria-pressed="${metric}">kg · cm</button></div>
        <div class="grid2"><div class="field"><label for="st-name">Name</label><input class="input" id="st-name" data-prof="name" value="${esc(p.name)}"></div><div class="field"><label for="st-age">Age</label><input class="input" id="st-age" data-prof="age" inputmode="numeric" value="${p.age}"></div></div>
        <div class="grid2">${metric ? `<div class="field"><label for="st-cm">Height (cm)</label><input class="input" id="st-cm" data-prof="cm" inputmode="numeric" value="${r0(p.heightCm)}"></div>` : `<div class="field"><span class="label">Height</span><div class="grid2"><input class="input" aria-label="Feet" data-prof="ft" inputmode="numeric" value="${h.ft}"><input class="input" aria-label="Inches" data-prof="inch" inputmode="numeric" value="${h.inch}"></div></div>`}
          <div class="field"><span class="label">Sex</span><div class="seg"><button data-act="set-prof" data-k="sex" data-v="male" aria-pressed="${p.sex === 'male'}">M</button><button data-act="set-prof" data-k="sex" data-v="female" aria-pressed="${p.sex === 'female'}">F</button></div></div></div>
        <div class="field"><label for="st-goal">Goal</label><select class="input" id="st-goal" data-prof="goal">${Object.entries(GOALS).map(([k, g]) => `<option value="${k}" ${p.goal === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
        <div class="grid2"><div class="field"><label for="st-exp">Experience</label><select class="input" id="st-exp" data-prof="experience">${Object.entries(EXPERIENCE).map(([k, g]) => `<option value="${k}" ${p.experience === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div>
          <div class="field"><label for="st-act">Daily activity</label><select class="input" id="st-act" data-prof="activity">${Object.entries(ACTIVITY).map(([k, g]) => `<option value="${k}" ${p.activity === k ? 'selected' : ''}>${g.label}</option>`).join('')}</select></div></div>
        <p class="tiny faint">Goal and experience changes rebuild your plan. Log body weight from the Progress tab.</p>
      </div>
      <div class="card" style="box-shadow:none" id="set-training"><span class="eyebrow">Training schedule and equipment</span>
        <div class="daypick">${order.map(x => `<button data-act="set-day" data-d="${x}" aria-pressed="${d.days.includes(x)}" aria-label="${DOW_LONG[x]}">${DOW[x].slice(0, 2)}</button>`).join('')}</div>
        <div class="seg">${[30, 45, 60, 75].map(m => `<button data-act="set-min" data-v="${m}" aria-pressed="${d.minutes === m}">${m} min</button>`).join('')}</div>
        ${d.days.length === 7 ? `<p class="small muted">${DAYS7_NOTE}</p>` : ''}
        ${gymPicker(d, 'set-gym')}
        <button class="opt" data-act="set-fullgym" aria-pressed="${d.fullGym}"><span class="grow"><span class="t">Full gym</span><br><span class="d">Selects everything below</span></span><span class="check">${icon('check', 16)}</span></button>
        ${Object.entries(groups).map(([g, list]) => `<div class="stack"><span class="label">${g}</span><div class="chips">${list.map(e => `<button class="chip" data-act="set-item" data-id="${e.id}" aria-pressed="${d.fullGym || d.items.includes(e.id)}">${e.label}</button>`).join('')}</div></div>`).join('')}<p class="small faint" role="status">${equipStatus(d)}</p>
        <button class="btn train block" data-act="set-rebuild" ${d.days.length < 2 ? 'disabled' : ''}>Save and rebuild plan</button>
        <p class="tiny faint">Rebuilding picks new exercises for your days and equipment. Your workout history and records are kept.</p>
      </div>
      <div class="card" style="box-shadow:none" id="set-reminders"><span class="eyebrow">Reminders</span>
        ${sw('enabled', 'Reminders on', 'Show nudges on the Today screen')}
        ${sw('workout', 'Workout days')}${sw('missed', 'Missed sessions')}${sw('meals', 'Food logging')}${sw('protein', 'Protein check')}${sw('weighin', 'Weigh-ins')}${sw('checkin', 'Weekly check-in')}
        <div class="divider"></div>
        ${typeof Native !== 'undefined' && Native.isNative ? `<div class="toggle"><span class="small"><b>Reminders on this phone</b><br><span class="faint">Arrive even when Groundwork is closed.</span></span><button class="switch" role="switch" aria-checked="${!!R.browser}" data-act="notif-toggle" aria-label="Phone reminders"></button></div>
        ${R.browser ? `<div class="grid2"><div class="field"><label for="rt-w">Workout reminder</label><select class="input" id="rt-w" data-remtime="workoutTime">${['06:00', '07:00', '08:00', '09:00', '12:00', '16:00', '17:00'].map(v => `<option value="${v}" ${(R.workoutTime || '08:00') === v ? 'selected' : ''}>${fmtClock(v)}</option>`).join('')}</select></div>
          <div class="field"><label for="rt-f">Food log reminder</label><select class="input" id="rt-f" data-remtime="foodTime">${['18:00', '19:00', '20:00', '21:00'].map(v => `<option value="${v}" ${(R.foodTime || '20:00') === v ? 'selected' : ''}>${fmtClock(v)}</option>`).join('')}</select></div></div>` : ''}`
        : `<div class="toggle"><span class="small"><b>Phone or desktop notifications</b><br><span class="faint">Status: ${esc(notifState)}. In this version they arrive while Groundwork is open.</span></span><button class="switch" role="switch" aria-checked="${!!R.browser}" data-act="notif-toggle" aria-label="Browser notifications"></button></div>`}
      </div>
      <div class="card" style="box-shadow:none"><span class="eyebrow">App</span>
        ${installRow()}
        <button class="li" data-act="open-feedback"><span class="ni">${icon('chat', 20)}</span><span class="grow"><span class="t">Send feedback</span><br><span class="d">Tell us what's confusing or missing</span></span><span class="chev">${icon('chevR', 18)}</span></button>
        <a class="li" href="https://natmo0470-netizen.github.io/groundwork/privacy.html" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="ni">${icon('info', 20)}</span><span class="grow"><span class="t">Privacy policy</span><br><span class="d">What's stored and where, and your rights</span></span><span class="chev">${icon('external', 18)}</span></a>
        <a class="li" href="https://natmo0470-netizen.github.io/groundwork/terms.html" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="ni">${icon('book', 20)}</span><span class="grow"><span class="t">Terms of use</span><br><span class="d">The rules for using Groundwork and messaging</span></span><span class="chev">${icon('external', 18)}</span></a>
      </div>
      <div class="card" style="box-shadow:none"><span class="eyebrow">Your data</span>
        <p class="small muted">Everything is stored on this device${Store.available() ? '' : ' (browser storage is blocked here, so data lasts only until you close this page)'}${typeof Cloud !== 'undefined' && Cloud.signedIn() ? ', and backed up to your account' : ''}. Back it up to a file to keep your own copy.</p>
        <div class="grid2"><button class="btn ghost sm" data-act="export">${icon('download', 16)} Back up</button><button class="btn ghost sm" data-act="import">Restore</button></div>
        <button class="btn danger sm" data-act="reset-all">Erase all data</button>
      </div>
      <p class="tiny faint">Groundwork v1.14 · General fitness guidance, not medical advice. Exercise demos are simplified illustrations of each movement.</p>`;
  },

  feedback(s) {
    const d = s.draft || {};
    const past = (S.feedback || []).length;
    return sheetHead('Send feedback', 'Groundwork is in testing. Your notes decide what gets fixed first.')
      + `<div class="field"><span class="label">How easy is Groundwork to use?</span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button data-act="fb-rate" data-v="${n}" aria-pressed="${d.rating === n}" aria-label="${n} of 5">${n}</button>`).join('')}</div><div class="row between tiny faint"><span>Confusing</span><span>Very easy</span></div></div>
      <div class="field"><span class="label">Which part are you giving feedback on?</span><div class="chips">${['Setup', 'Workouts', 'Exercise demos', 'Food log', 'Targets', 'Progress', 'Reminders', 'Other'].map(a => `<button class="chip" data-act="fb-area" data-v="${a}" aria-pressed="${(d.areas || []).includes(a)}">${a}</button>`).join('')}</div></div>
      <div class="field"><label for="fb-confusing">What was confusing or got in your way?</label><textarea class="input" id="fb-confusing" rows="3" data-fb="confusing">${esc(d.confusing || '')}</textarea></div>
      <div class="field"><label for="fb-missing">What's missing that you'd want?</label><textarea class="input" id="fb-missing" rows="3" data-fb="missing">${esc(d.missing || '')}</textarea></div>
      <button class="btn train block" data-act="fb-save">Save feedback</button>
      ${past ? `<div class="divider"></div><div class="row between"><span class="small muted">${past} note${past > 1 ? 's' : ''} saved on this device</span><button class="link" data-act="fb-copy">${icon('copy', 16)} Copy all to send</button></div>` : ''}`;
  },

  exportData(s) {
    const json = JSON.stringify(S);
    return sheetHead('Back up your data', 'Use a backup to move to a new phone or computer, or to keep a safe copy')
      + `<button class="btn train block" data-act="download-backup">${icon('download', 18)} Download backup file</button>
      <p class="small muted">Saves a file named groundwork-backup-${todayKey()}.json. Send it to your other device (email, cloud drive, AirDrop), open Groundwork there, then Settings → Restore → choose the file.</p>
      <div class="divider"></div>
      <span class="eyebrow">Or copy it as text</span>
      <textarea class="input" id="exp-text" rows="5" readonly style="font:12px ui-monospace,monospace">${esc(json)}</textarea>
      <button class="btn ghost block" data-act="copy-export">${icon('copy', 18)} Copy backup text</button>`;
  },
  importData(s) {
    return sheetHead('Restore from backup', 'Paste a backup or choose a backup file. This replaces the data on this device.')
      + `<textarea class="input" id="imp-text" rows="7" placeholder="Paste backup text here" style="font:12px ui-monospace,monospace"></textarea>
      <input class="input" id="imp-file" type="file" accept=".json,.txt,application/json,text/plain" aria-label="Backup file">
      <button class="btn train block" data-act="do-import">Restore</button>`;
  },
};

function pickSource(s) {
  return s.scope === 'active' ? S.activeWorkout.items[s.idx] : S.plan.workouts.find(w => w.id === s.wid).items[s.idx];
}
function pickRows(s) {
  const equip = equipList(S);
  const inWorkout = new Set((s.scope === 'active' ? S.activeWorkout.items : S.plan.workouts.find(w => w.id === s.wid).items).map(i => i.exId));
  let pattern = null;
  if (s.mode === 'swap') { const src = pickSource(s); pattern = src.slot === 'finisher' ? 'cardio' : EX_BY_ID[src.exId].pattern; }
  const q = (s.q || '').trim().toLowerCase();
  const list = EXERCISES.filter(e => !inWorkout.has(e.id)
    && (q ? (e.name.toLowerCase().includes(q) || e.muscles.join(' ').toLowerCase().includes(q))
          : s.group === 'Similar' ? e.pattern === pattern : (s.group === 'All' || e.group === s.group))
    && (!s.mine || exerciseAvailable(e, equip)));
  if (!list.length) return `<div class="empty">${s.mine ? 'Nothing here fits your equipment. Turn off "Only my equipment" or try another group.' : 'No exercises match.'}</div>`;
  return list.map(e => {
    const missing = e.req.filter(r => !equip.includes(r));
    return `<button class="li" data-act="pick-ex" data-id="${e.id}"><span class="thumb sm">${Demo.staticSvg(e.anim, e.prop, e.name)}</span><span class="grow"><span class="t">${esc(e.name)}</span><br><span class="d">${esc(e.muscles.join(', '))} · ${['', 'Easy', 'Moderate', 'Advanced'][e.diff]}</span></span>${missing.length ? `<span class="tag">Needs ${esc(EQUIPMENT.find(x => x.id === missing[0]).short)}</span>` : `<span class="tag train">${esc(e.group)}</span>`}</button>`;
  }).join('');
}

function installRow() {
  const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  if (standalone) return `<div class="li"><span class="ni">${icon('check', 20)}</span><span class="grow"><span class="t">Installed</span><br><span class="d">Groundwork is running as an app</span></span></div>`;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const hosted = /^https?:/.test(location.protocol);
  const how = UI.installPrompt ? 'Adds Groundwork to your home screen and works offline'
    : ios ? 'In Safari: tap Share, then Add to Home Screen'
    : hosted ? 'Use your browser menu: Install app, or Add to Home screen'
    : 'Available once Groundwork is hosted on a web address (see README)';
  return `<button class="li" data-act="install" ${UI.installPrompt ? '' : 'aria-disabled="true"'}><span class="ni">${icon('download', 20)}</span><span class="grow"><span class="t">Install on this device</span><br><span class="d">${how}</span></span></button>`;
}

function foodResults() {
  const F = UI.food;
  const q = F.q.trim();
  if (!q) {
    const rec = S.recentFoods.slice(0, 12);
    const custom = S.customFoods.slice(0, 10);
    const popular = ['Chicken breast, cooked', 'Egg, large', 'Greek yogurt, nonfat plain', 'Oats, dry (rolled)', 'Banana', 'White rice, cooked', 'Whey protein powder', 'Peanut butter'].map(n => FOODS.find(f => f.name === n)).filter(Boolean);
    return (rec.length ? `<span class="eyebrow">Recent</span><div class="list">${rec.map(foodPick).join('')}</div>` : '')
      + (custom.length ? `<span class="eyebrow" style="display:block;margin-top:10px">My foods</span><div class="list">${custom.map(foodPick).join('')}</div>` : '')
      + `<span class="eyebrow" style="display:block;margin-top:10px">Popular</span><div class="list">${popular.map(foodPick).join('')}</div>`;
  }
  const local = searchLocalFoods(q, S.customFoods);
  let out = local.length ? `<div class="list">${local.map(foodPick).join('')}</div>` : `<p class="small muted">No match in the built-in list.</p>`;
  out += `<div class="divider" style="margin:10px 0"></div>`;
  if (F.loading) out += `<p class="small muted">Searching Open Food Facts…</p>`;
  else if (F.err) out += `<p class="small muted">${esc(F.err)}</p><button class="btn sm soft" data-act="quick-add">Quick add instead</button>`;
  else if (F.online.length && F.onlineQ === q) out += `<span class="eyebrow">Online · USDA and Open Food Facts</span><div class="list">${F.online.map(foodPick).join('')}</div>`;
  else out += `<button class="btn sm ghost" data-act="food-online">${icon('search', 16)} Search 3M+ branded foods online</button>`;
  return out;
}
function foodPick(f) {
  UI._foodCache = UI._foodCache || {};
  UI._foodCache[f.id] = f;
  return `<button class="food-row" data-act="pick-food" data-id="${esc(f.id)}"><span class="grow" style="min-width:0"><span class="t">${esc(f.name)}</span><br><span class="d">${esc(f.serving)} · <span class="pcf"><b class="p">P ${r0(f.p)}</b> <b class="c">C ${r0(f.c)}</b> <b class="f">F ${r0(f.f)}</b></span></span></span><span class="kcal">${fmtInt(f.kcal)}</span></button>`;
}
function servPreview(f, n) {
  return `<div class="row between"><span class="muted">Calories</span><span class="mid-num">${fmtInt(f.kcal * n)}</span></div>
    <div class="macros">${[['p', 'Protein', 'p'], ['c', 'Carbs', 'c'], ['f', 'Fat', 'f']].map(([c, l, k]) => `<div class="macro ${c}"><div class="k">${l}</div><b class="num">${r0(f[k] * n)} g</b></div>`).join('')}</div>`;
}
