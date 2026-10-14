/* Groundwork — actions, event wiring, sample data and startup. */
UI.stack = [];
function pushSheet(sheet) { if (UI.sheet) UI.stack.push(UI.sheet); UI.sheet = sheet; render(); }
function popSheet() { UI.sheet = UI.stack.pop() || null; render(); }
function closeAll() { UI.stack = []; UI.sheet = null; render(); }
function confirmSheet(title, body, ok, onOk, danger) { pushSheet({ type: 'confirm', title, body, ok, danger, onOk }); }

function rebuildPlan(msg) { S.plan = buildPlan(S, (S.plan && S.plan.block) || 1); save(); if (msg) toast(msg); }
function addRecent(f) {
  S.recentFoods = [f].concat(S.recentFoods.filter(x => x.name !== f.name)).slice(0, 20);
}
function logFood(f, servings, meal, date) {
  date = date || UI.foodDate;
  const k = date;
  (S.foodLog[k] = S.foodLog[k] || []).push({ id: uid(), meal, name: f.name, serving: f.serving, servings, kcal: f.kcal, p: f.p, c: f.c, f: f.f, source: f.source || '' });
  addRecent({ id: 'r_' + f.name, name: f.name, serving: f.serving, kcal: f.kcal, p: f.p, c: f.c, f: f.f, source: f.source || '' });
}
const num = (id) => { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? 0 : v; };
const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

const ACT = {
  // navigation
  'tab': t => { UI.tab = t.dataset.id; UI.sheet = null; UI.stack = []; render(); window.scrollTo(0, 0); },
  'tab-train': () => { UI.tab = 'train'; UI.trainSeg = 'plan'; closeAll(); window.scrollTo(0, 0); },
  'tab-food': () => { UI.tab = 'food'; UI.foodDate = todayKey(); closeAll(); window.scrollTo(0, 0); },
  'close-sheet': () => popSheet(),
  'open-notifs': () => pushSheet({ type: 'notifs' }),
  'dismiss': t => { S.dismissed[t.dataset.id] = todayKey(); save(); render(); },
  'open-settings': t => {
    const d = { days: S.schedule.days.slice(), minutes: S.schedule.minutes, fullGym: S.equipment.fullGym, items: S.equipment.items.slice(), gym: S.equipment.gym || null };
    UI.stack = []; UI.sheet = { type: 'settings', draft: d, tall: true }; render();
    if (t.dataset.key) { const el = document.getElementById('set-' + t.dataset.key); if (el) el.scrollIntoView({ block: 'start' }); }
  },

  // onboarding
  'ob-next': () => { if (UI.obStep === 0 || obValid(UI.obStep)) { UI.obStep++; render(); window.scrollTo(0, 0); } },
  'ob-back': () => { UI.obStep = Math.max(0, UI.obStep - 1); render(); },
  'ob-set': t => {
    const o = obDraft(), k = t.dataset.k; let v = t.dataset.v;
    if (k === 'minutes') v = Number(v);
    if (k === 'units' && v !== o.units) {
      if (v === 'metric') { if (o.weight) o.weight = String(Math.round(Number(o.weight) * KG_PER_LB)); o.cm = String(Math.round(ftInToCm(o.ft || 0, o.inch || 0))); }
      else { if (o.weight) o.weight = String(Math.round(Number(o.weight) / KG_PER_LB)); const h = cmToFtIn(Number(o.cm) || 175); o.ft = String(h.ft); o.inch = String(h.inch); }
    }
    o[k] = v; render();
  },
  'ob-day': t => {
    const o = obDraft(), d = Number(t.dataset.d);
    if (o.days.includes(d)) o.days = o.days.filter(x => x !== d);
    else o.days.push(d);
    render();
  },
  'ob-fullgym': () => { equipToggleAll(obDraft()); render(); },
  'ob-item': t => { equipToggleItem(obDraft(), t.dataset.id); render(); },
  'ob-gym': t => { equipSetGym(obDraft(), t.dataset.id); render(); },
  'ob-finish': () => {
    S = obToState(UI.ob);
    S.onboarded = true; S.startDate = todayKey();
    S.weights = [{ date: todayKey(), kg: Math.round(S.profile.weightKg * 10) / 10 }];
    S.plan = buildPlan(S);
    save(); UI.tab = 'today'; UI.ob = null; UI.obStep = 0;
    toast('Your plan is ready'); window.scrollTo(0, 0);
  },
  'seed-demo': () => { seedDemo(); UI.tab = 'today'; render(); toast('Loaded sample data'); },
  'end-demo': () => confirmSheet('Start fresh?', 'This clears the sample data and takes you to setup.', 'Clear and set up', () => { Store.clear(); S = defaultState(); UI.ob = null; UI.obStep = 0; UI.loggerOpen = false; closeAll(); }, true),

  // training
  'train-seg': t => { UI.trainSeg = t.dataset.v; render(); },
  'new-block': () => { const n = ((S.plan && S.plan.block) || 1) + 1; S.plan = buildPlan(S, n); save(); closeAll(); toast(S.plan.program ? `Round ${n} started. Keep adding weight where you can.` : `Block ${n} started. Main lifts stay; accessories are new.`); },

  // quick day changes
  'day-swap': t => pushSheet({ type: 'daySwap', date: t.dataset.date, scope: t.dataset.scope || 'once', tall: true }),
  'day-scope': t => { UI.sheet.scope = t.dataset.v; render(); },
  'day-set': t => {
    const s = UI.sheet, k = s.date;
    let id = t.dataset.id;
    if (id.startsWith('tpl:')) id = ensureSession(S, id.slice(4)).id;
    setDaySession(S, k, id, s.scope);
    save(); closeAll();
    const w = id === 'rest' ? null : S.plan.workouts.find(x => x.id === id);
    toast(`${s.scope === 'once' ? (k === todayKey() ? 'Today' : prettyDate(k)) : 'Every ' + DOW_LONG[parseKey(k).getDay()]} is now ${w ? w.name : 'a rest day'}`);
  },
  'day-trade': t => {
    const s = UI.sheet, a = s.date, b = t.dataset.date;
    tradeDays(S, a, b, s.scope); save(); closeAll();
    toast(`Swapped ${DOW[parseKey(a).getDay()]} and ${DOW[parseKey(b).getDay()]}${s.scope === 'once' ? ' this week' : ''}`);
  },

  // programs
  'open-programs': () => pushSheet({ type: 'programs', filter: 'all', tall: true }),
  'prog-filter': t => { UI.sheet.filter = t.dataset.v; render(); },
  'open-program': t => {
    const prog = PROGRAM_BY_ID[t.dataset.id];
    const days = S.schedule.days.length === prog.days ? S.schedule.days.slice() : RECOMMENDED_DAYS[prog.days].slice();
    pushSheet({ type: 'program', id: prog.id, draft: { days }, tall: true });
  },
  'prog-day': t => { const d = UI.sheet.draft, x = Number(t.dataset.d); d.days = d.days.includes(x) ? d.days.filter(y => y !== x) : d.days.concat([x]); render(); },
  'prog-start': () => {
    const s = UI.sheet, prog = PROGRAM_BY_ID[s.id];
    S.program = prog.id; S.schedule.days = s.draft.days.slice();
    S.plan = buildPlan(S, 1); save(); closeAll();
    UI.tab = 'train'; UI.trainSeg = 'plan'; render(); window.scrollTo(0, 0);
    toast(`${prog.name} started`);
  },
  'prog-leave': () => { S.program = null; S.plan = buildPlan(S, 1); save(); closeAll(); toast('Back on your custom plan'); },
  'lib-group': t => { UI.libGroup = t.dataset.v; render(); },
  'lib-mine': () => { UI.libMine = !UI.libMine; render(); },
  'open-ex': t => pushSheet({ type: 'exercise', id: t.dataset.id, ctx: t.dataset.ctx != null ? Number(t.dataset.ctx) : null, key: t.dataset.id }),
  'demo-toggle': t => { if (t._ctl) { const on = t._ctl.toggle(); t.innerHTML = icon(on ? 'pause' : 'play', 18) + `<span>${on ? 'Pause' : 'Play'}</span>`; } },
  'preview-workout': t => pushSheet({ type: 'preview', id: t.dataset.id, key: t.dataset.id }),
  'start-workout': t => startWorkout(t.dataset.id),
  'start-today': () => { const w = workoutForDate(S, todayKey()); if (w) startWorkout(w.id); },
  'open-logger': () => { UI.loggerOpen = true; UI.sheet = null; UI.stack = []; render(); },
  'min-logger': () => { UI.loggerOpen = false; render(); toast('Workout still running. Resume from Today.'); },
  'swap': t => pushSheet({ type: 'pick', mode: 'swap', scope: t.dataset.scope, idx: Number(t.dataset.idx), wid: t.dataset.wid, group: 'Similar', q: '', mine: true, tall: true }),
  'add-ex': t => pushSheet({ type: 'pick', mode: 'add', scope: t.dataset.scope, wid: t.dataset.wid, group: 'All', q: '', mine: true, tall: true }),
  'pick-group': t => { UI.sheet.group = t.dataset.v; UI.sheet.q = ''; render(); },
  'pick-mine': () => { UI.sheet.mine = !UI.sheet.mine; render(); },
  'pick-ex': t => {
    const s = UI.sheet, ex = EX_BY_ID[t.dataset.id];
    const fresh = isMain => ({ exId: ex.id, slot: ex.pattern, ...prescribe(S.profile.goal, S.profile.experience, ex, isMain, S.schedule.minutes) });
    const rowsFor = it => { const sug = suggestion(S, it); return [...Array(it.sets)].map(() => ({ weightKg: sug.weightKg, reps: null, done: false, _auto: true })); };
    if (s.scope === 'active') {
      const items = S.activeWorkout.items;
      if (s.mode === 'add') {
        const it = fresh(false); it.rows = rowsFor(it); items.push(it);
        save(); closeAll(); toast(`Added ${ex.name}`);
        setTimeout(() => { const el = document.getElementById('ex-' + (items.length - 1)); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
        return;
      }
      const old = items[s.idx], oldEx = EX_BY_ID[old.exId];
      const same = oldEx.pattern === ex.pattern && oldEx.unit === ex.unit;
      const it = same ? { ...old, exId: ex.id } : { ...fresh(s.idx < 2 && COMPOUND.includes(ex.pattern)), slot: old.slot === 'finisher' ? 'finisher' : ex.pattern, note: old.note };
      it.rows = rowsFor(it);
      const doneRows = old.rows.filter(r => r.done);
      if (doneRows.length) { old.rows = doneRows; items.splice(s.idx + 1, 0, it); }  // keep the sets already logged
      else items[s.idx] = it;
      save(); closeAll(); toast(`Swapped to ${ex.name}${doneRows.length ? '. Logged sets kept.' : ''}`);
      return;
    }
    const w = S.plan.workouts.find(x => x.id === s.wid);
    if (s.mode === 'add') w.items.push(fresh(false));
    else {
      const old = w.items[s.idx], oldEx = EX_BY_ID[old.exId];
      if (oldEx.pattern === ex.pattern && oldEx.unit === ex.unit) old.exId = ex.id;
      else w.items[s.idx] = { ...fresh(s.idx < 2 && COMPOUND.includes(ex.pattern)), slot: old.slot === 'finisher' ? 'finisher' : ex.pattern, note: old.note };
    }
    w.focus = [...new Set(w.items.filter(i => i.slot !== 'finisher').map(i => EX_BY_ID[i.exId].group))].slice(0, 4).join(' · ');
    save(); popSheet(); toast(s.mode === 'add' ? `Added ${ex.name} to ${w.name}` : 'Plan updated');
  },
  'remove-ex': t => {
    const idx = Number(t.dataset.idx);
    if (t.dataset.scope === 'active') {
      const it = S.activeWorkout.items[idx];
      const doit = () => { S.activeWorkout.items.splice(idx, 1); save(); };
      if (it.rows.some(r => r.done)) confirmSheet(`Remove ${EX_BY_ID[it.exId].name}?`, 'Sets you already logged for it will be deleted.', 'Remove', doit, true);
      else { doit(); render(); toast('Exercise removed'); }
      return;
    }
    const w = S.plan.workouts.find(x => x.id === t.dataset.wid);
    if (w.items.length <= 1) return;
    const name = EX_BY_ID[w.items[idx].exId].name;
    w.items.splice(idx, 1); save(); render(); toast(`Removed ${name} from ${w.name}`);
  },
  'toggle-set': t => {
    const it = S.activeWorkout.items[Number(t.dataset.i)], r = it.rows[Number(t.dataset.j)];
    const ex = EX_BY_ID[it.exId];
    r.done = !r.done;
    if (r.done) {
      const sug = suggestion(S, it);
      if (r.reps == null) r.reps = ex.unit === 'reps' ? (sug.reps || it.min) : it.max;
      const j = Number(t.dataset.j);
      const prevW = it.rows.slice(0, j).reverse().find(x => x.weightKg != null);
      if (r.weightKg == null) r.weightKg = prevW ? prevW.weightKg : sug.weightKg;
      if (it.rest) UI.rest = { end: Date.now() + it.rest * 1000, total: it.rest };
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* ignore */ }
    }
    save(); render();
  },
  'add-set': t => { const it = S.activeWorkout.items[Number(t.dataset.i)]; const last = it.rows[it.rows.length - 1]; it.rows.push({ weightKg: last ? last.weightKg : null, reps: null, done: false }); save(); render(); },
  'remove-set': t => { const it = S.activeWorkout.items[Number(t.dataset.i)]; if (it.rows.length > 1) it.rows.pop(); save(); render(); },
  'rest-add': t => { if (!UI.rest) return; UI.rest.end += Number(t.dataset.v) * 1000; UI.rest.total = Math.max(UI.rest.total, Math.ceil((UI.rest.end - Date.now()) / 1000)); tickRest(); },
  'rest-skip': () => { UI.rest = null; render(); },
  'finish-workout': () => {
    const any = S.activeWorkout.items.some(it => it.rows.some(r => r.done));
    if (!any) { confirmSheet('No sets checked off', 'Tick the check box on each set you complete. Finish anyway and discard this workout?', 'Discard workout', () => { S.activeWorkout = null; UI.loggerOpen = false; UI.rest = null; save(); closeAll(); }, true); return; }
    finishWorkout();
  },
  'cancel-workout': () => confirmSheet('Discard this workout?', 'Sets you logged in this session will be lost.', 'Discard', () => { S.activeWorkout = null; UI.loggerOpen = false; UI.rest = null; save(); closeAll(); }, true),
  'history': t => pushSheet({ type: 'history', id: t.dataset.id }),
  'delete-workout': t => confirmSheet('Delete this workout?', 'It will be removed from your history and records.', 'Delete', () => { S.workouts = S.workouts.filter(w => w.id !== t.dataset.id); save(); closeAll(); toast('Workout deleted'); }, true),

  // nutrition
  'food-day': t => { const n = addDays(UI.foodDate, Number(t.dataset.v)); if (n <= todayKey()) { UI.foodDate = n; render(); } },
  'add-food': t => { UI.food.meal = t.dataset.meal || mealForNow(); UI.food.q = ''; UI.food.err = ''; UI.food.online = []; if (UI.tab !== 'food') UI.foodDate = todayKey(); pushSheet({ type: 'foodAdd', tall: true }); setTimeout(() => { const q = document.getElementById('food-q'); if (q) q.focus(); }, 60); },
  'food-meal': t => { UI.food.meal = t.dataset.v; render(); },
  'food-online': async () => {
    const q = UI.food.q.trim(); if (!q) return;
    UI.food.loading = true; UI.food.err = ''; refreshFoodResults();
    try {
      const res = await searchOnlineFoods(q);
      UI.food.online = res.slice(0, 20); UI.food.onlineQ = q;
      if (!res.length) UI.food.err = 'No online results. Try a simpler search, or use Quick add.';
    } catch (e) {
      UI.food.err = 'Online search isn\'t reachable from here. The built-in foods and Quick add still work.';
    }
    UI.food.loading = false; refreshFoodResults();
  },
  'pick-food': t => { const f = (UI._foodCache || {})[t.dataset.id]; if (f) pushSheet({ type: 'serving', food: f, servings: 1, meal: UI.food.meal }); },
  'edit-food': t => {
    const it = (S.foodLog[UI.foodDate] || []).find(x => x.id === t.dataset.id); if (!it) return;
    pushSheet({ type: 'serving', food: { name: it.name, serving: it.serving, kcal: it.kcal, p: it.p, c: it.c, f: it.f, source: it.source }, servings: it.servings, meal: it.meal, editId: it.id });
  },
  'serv-step': t => { const s = UI.sheet; s.servings = Math.max(0.25, Math.round((s.servings + Number(t.dataset.v)) * 100) / 100); render(); },
  'serv-set': t => { UI.sheet.servings = Number(t.dataset.v); render(); },
  'serv-meal': t => { UI.sheet.meal = t.dataset.v; render(); },
  'serv-save': () => {
    const s = UI.sheet; if (!(s.servings > 0)) { toast('Enter how many servings'); return; }
    if (s.editId) { const it = (S.foodLog[UI.foodDate] || []).find(x => x.id === s.editId); if (it) { it.servings = s.servings; it.meal = s.meal; } }
    else logFood(s.food, s.servings, s.meal);
    save(); closeAll(); toast(s.editId ? 'Updated' : `Added ${s.food.name.split(',')[0]}`);
  },
  'food-delete': t => { S.foodLog[UI.foodDate] = (S.foodLog[UI.foodDate] || []).filter(x => x.id !== t.dataset.id); save(); closeAll(); toast('Removed'); },
  'scan-open': () => pushSheet({ type: 'scan' }),
  'scan-lookup': () => { const v = val('scan-code'); if (!Scanner.valid(v)) { setScanStatus('Barcodes are 8, 12, 13 or 14 digits. Check the number and try again.'); return; } handleBarcode(v); },
  'scan-create': () => { const s = UI.sheet; UI.sheet = { type: 'custom', barcode: s.code, name: s.partial || '' }; render(); },
  'quick-add': () => pushSheet({ type: 'quick' }),
  'quick-save': () => {
    const kcal = num('qa-kcal'); if (!kcal) { toast('Enter calories'); return; }
    logFood({ name: val('qa-name') || 'Quick add', serving: 'entry', kcal, p: num('qa-p'), c: num('qa-c'), f: num('qa-f'), source: 'Quick add' }, 1, UI.food.meal);
    save(); closeAll(); toast('Added');
  },
  'custom-food': () => pushSheet({ type: 'custom' }),
  'custom-save': () => {
    const name = val('cf-name'), kcal = num('cf-kcal');
    if (!name || !kcal) { toast('Add a name and calories'); return; }
    const f = { id: 'c_' + uid(), name, serving: val('cf-serv') || '1 serving', kcal, p: num('cf-p'), c: num('cf-c'), f: num('cf-f'), cat: 'Mine', source: 'My food', barcode: UI.sheet.barcode || '' };
    S.customFoods.unshift(f); logFood(f, 1, UI.food.meal); save(); closeAll(); toast('Saved and added');
  },
  'open-targets': () => pushSheet({ type: 'targets', tall: true }),
  'tgt-mode': t => { UI.sheet.mode = t.dataset.v; render(); },
  'tgt-save': t => {
    if (t.dataset.v === 'auto') { S.macros.mode = 'auto'; }
    else {
      const c = { protein: Math.max(0, Math.round(num('tg-protein'))), carbs: Math.max(0, Math.round(num('tg-carbs'))), fat: Math.max(0, Math.round(num('tg-fat'))) };
      if (c.protein * 4 + c.carbs * 4 + c.fat * 9 < 800) { toast('That\'s under 800 kcal. Please check the numbers.'); return; }
      S.macros = { mode: 'custom', custom: c };
    }
    save(); closeAll(); toast('Targets saved');
  },
  'tgt-reset': () => { S.macros = { mode: 'auto', custom: null }; save(); closeAll(); toast('Back to recommended targets'); },

  // weight & check-in
  'log-weight': () => pushSheet({ type: 'weight' }),
  'weight-save': () => {
    const v = num('w-val'), d = val('w-date') || todayKey();
    const kg = dispToKg(S, v);
    if (!kg || kg < 25 || kg > 320) { toast('Enter a valid weight'); return; }
    S.weights = S.weights.filter(w => w.date !== d).concat([{ date: d, kg: Math.round(kg * 100) / 100 }]).sort((a, b) => a.date < b.date ? -1 : 1);
    S.profile.weightKg = S.weights[S.weights.length - 1].kg;
    save(); popSheet(); toast('Weight logged');
  },
  'weight-del': t => { S.weights = S.weights.filter(w => w.date !== t.dataset.d); save(); render(); },
  'open-checkin': () => pushSheet({ type: 'checkin' }),
  'checkin-answer': t => { UI.sheet.result = computeCheckin(S, t.dataset.v); render(); },
  'checkin-apply': () => {
    const r = UI.sheet.result;
    S.checkins.push({ date: r.date, change: r.change, adjust: r.adjust, thisAvg: r.thisAvg, lastAvg: r.lastAvg, adherence: r.adherence });
    if (r.adjust) {
      S.calorieAdjust = (S.calorieAdjust || 0) + r.adjust;
      if (S.macros.mode === 'custom' && S.macros.custom) S.macros.custom.carbs = Math.max(50, S.macros.custom.carbs + Math.round(r.adjust / 4));
    }
    delete S.dismissed.checkin;
    save(); closeAll(); toast(r.adjust ? 'New calorie target set' : 'Check-in saved');
  },

  // confirm
  'confirm-ok': () => { const fn = UI.sheet.onOk; UI.stack = []; UI.sheet = null; fn && fn(); render(); },

  // settings
  'set-units': t => { S.profile.units = t.dataset.v; save(); render(); },
  'set-prof': t => { S.profile[t.dataset.k] = t.dataset.v; save(); render(); },
  'set-day': t => {
    const d = UI.sheet.draft, x = Number(t.dataset.d);
    if (d.days.includes(x)) d.days = d.days.filter(y => y !== x); else d.days.push(x);
    render();
  },
  'set-min': t => { UI.sheet.draft.minutes = Number(t.dataset.v); render(); },
  'set-fullgym': () => { equipToggleAll(UI.sheet.draft); render(); },
  'set-item': t => { equipToggleItem(UI.sheet.draft, t.dataset.id); render(); },
  'set-gym': t => { equipSetGym(UI.sheet.draft, t.dataset.id); render(); },
  'set-rebuild': () => {
    const d = UI.sheet.draft;
    S.schedule = { days: d.days.slice(), minutes: d.minutes };
    S.equipment = { fullGym: d.fullGym, items: d.items.slice(), gym: d.gym || null };
    rebuildPlan(); closeAll(); toast('Plan rebuilt');
  },
  'rem-toggle': t => { const k = t.dataset.k; S.reminders[k] = !S.reminders[k]; save(); render(); },
  'notif-toggle': () => {
    if (S.reminders.browser) { S.reminders.browser = false; save(); render(); return; }
    if (!notifySupported()) { toast('This browser doesn\'t support notifications here. In-app reminders still work.'); return; }
    try {
      const p = Notification.requestPermission();
      const done = perm => { S.reminders.browser = perm === 'granted'; save(); render(); toast(perm === 'granted' ? 'Notifications on' : 'Notifications were blocked. In-app reminders still work.'); };
      if (p && p.then) p.then(done, () => done('denied')); else done(Notification.permission);
    } catch (e) { toast('Notifications aren\'t available here. In-app reminders still work.'); }
  },
  'install': async () => {
    if (!UI.installPrompt) return;
    try { UI.installPrompt.prompt(); const r = await UI.installPrompt.userChoice; UI.installPrompt = null; render(); if (r && r.outcome === 'accepted') toast('Installed. Open Groundwork from your home screen.'); } catch (e) { /* ignore */ }
  },
  'open-feedback': () => pushSheet({ type: 'feedback', draft: {} }),
  'fb-rate': t => { UI.sheet.draft.rating = Number(t.dataset.v); render(); },
  'fb-area': t => { const d = UI.sheet.draft; d.areas = d.areas || []; d.areas = d.areas.includes(t.dataset.v) ? d.areas.filter(a => a !== t.dataset.v) : d.areas.concat([t.dataset.v]); render(); },
  'fb-save': () => {
    const d = UI.sheet.draft;
    if (!d.rating && !d.confusing && !d.missing) { toast('Add a rating or a note first'); return; }
    S.feedback = (S.feedback || []).concat([{ date: todayKey(), rating: d.rating || null, areas: d.areas || [], confusing: (d.confusing || '').trim(), missing: (d.missing || '').trim(), app: 'v1.1', goal: S.profile.goal, experience: S.profile.experience, workouts: S.workouts.length }]);
    save(); UI.sheet.draft = {}; render(); toast('Thanks! Saved. Use Copy all to send it to the developer.');
  },
  'fb-copy': () => {
    const txt = (S.feedback || []).map(f => `${f.date} · ease ${f.rating || '–'}/5 · ${f.areas.join(', ') || 'general'}\nConfusing: ${f.confusing || '–'}\nMissing: ${f.missing || '–'}\n(${f.goal}, ${f.experience}, ${f.workouts} workouts, ${f.app})`).join('\n\n');
    try { navigator.clipboard.writeText('Groundwork feedback\n\n' + txt).then(() => toast('Copied. Paste it into a text or email.'), () => toast('Copy isn\'t available here')); } catch (e) { toast('Copy isn\'t available here'); }
  },
  'export': () => pushSheet({ type: 'exportData' }),
  'copy-export': () => {
    const ta = document.getElementById('exp-text');
    const ok = () => toast('Backup copied');
    const fallback = () => { ta.focus(); ta.select(); toast('Text selected. Copy it with your device\'s copy command.'); };
    try { navigator.clipboard.writeText(JSON.stringify(S)).then(ok, fallback); } catch (e) { fallback(); }
  },
  'download-backup': () => {
    try {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `groundwork-backup-${todayKey()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      S.lastBackup = todayKey(); save();
      toast('Backup file saved. If nothing downloaded, use Copy backup text.');
    } catch (e) { toast('Download isn\'t available here. Use Copy backup text instead.'); }
  },
  'import': () => pushSheet({ type: 'importData' }),
  'do-import': () => {
    const apply = text => {
      try {
        const data = JSON.parse(text);
        if (!data || !data.profile || !data.version) throw new Error('bad');
        S = Object.assign(defaultState(), data); UI.loggerOpen = false; save(); closeAll(); toast('Data restored');
      } catch (e) { toast('That doesn\'t look like a Groundwork backup'); }
    };
    const file = document.getElementById('imp-file').files[0];
    if (file) { const rd = new FileReader(); rd.onload = () => apply(rd.result); rd.readAsText(file); }
    else if (val('imp-text')) apply(val('imp-text'));
    else toast('Paste a backup or choose a file');
  },
  'reset-all': () => confirmSheet('Erase all data?', 'This removes your profile, plan, logs and records from this device. It can\'t be undone.', 'Erase everything', () => { Store.clear(); S = defaultState(); UI.ob = null; UI.obStep = 0; UI.loggerOpen = false; UI.tab = 'today'; }, true),
  'chart-range': t => { UI.chartRange = Number(t.dataset.v); render(); },
};

/* ---------- barcode scanning ---------- */
function setScanStatus(msg, resultHtml) {
  if (!UI.sheet || UI.sheet.type !== 'scan') return;
  UI.sheet.status = msg; if (resultHtml != null) UI.sheet.resultHtml = resultHtml;
  const el = document.getElementById('scan-status'); if (el) el.textContent = msg;
  const r = document.getElementById('scan-result'); if (r && resultHtml != null) r.innerHTML = resultHtml;
}
function startScan() {
  const s = UI.sheet, video = document.getElementById('scan-video');
  if (!video || s.busy) return;
  Scanner.start(video, code => { Scanner.stop(); handleBarcode(code); })
    .then(mode => { if (mode !== 'cancelled' && !s.busy) setScanStatus('Line the barcode up inside the box. It scans automatically.'); })
    .catch(e => {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      setScanStatus(denied ? 'Camera access is blocked here. Take a photo of the barcode or type the number below.' : 'Live scanning isn\'t available on this device. Take a photo of the barcode or type the number below.');
    });
}
async function handleBarcode(code) {
  const s = UI.sheet; if (!s || s.type !== 'scan') return;
  code = String(code).replace(/\D/g, '');
  s.busy = true; s.code = code; Scanner.stop();
  const input = document.getElementById('scan-code'); if (input) input.value = code;
  setScanStatus(`Found ${code}. Looking it up…`, '');
  try {
    const r = await lookupBarcode(code, S.customFoods);
    if (UI.sheet !== s) return;
    if (r.food) { UI.sheet = { type: 'serving', food: r.food, servings: 1, meal: UI.food.meal }; render(); return; }
    s.partial = r.partial || '';
    setScanStatus(`No nutrition data for ${code} yet.`, `<button class="btn fuel block" data-act="scan-create">${icon('plus', 18)} Add it as your own food</button><p class="tiny faint" style="margin-top:6px">Copy the calories and macros from the label. Next time this barcode scans instantly.</p>`);
  } catch (e) {
    if (UI.sheet !== s) return;
    setScanStatus('Couldn\'t reach the food database from here.', `<button class="btn fuel block" data-act="scan-create">${icon('plus', 18)} Add it from the label</button><button class="btn ghost block" data-act="quick-add" style="margin-top:8px">Quick add calories</button>`);
  }
  s.busy = false;
}

function refreshFoodResults() { const el = document.getElementById('food-results'); if (el) el.innerHTML = foodResults(); }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act];
  if (fn) { e.preventDefault(); fn(t, e); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && UI.sheet) { popSheet(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('span[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.ob) {
    obDraft()[t.dataset.ob] = t.value;
    const b = document.querySelector('.ob-foot .btn'); if (b) b.disabled = !obValid(UI.obStep);
  } else if (t.id === 'lib-q') {
    UI.libQuery = t.value; const el = document.getElementById('lib-list'); if (el) el.innerHTML = libraryRows(equipList(S));
  } else if (t.id === 'food-q') {
    UI.food.q = t.value; UI.food.err = '';
    clearTimeout(refreshFoodResults._t); refreshFoodResults._t = setTimeout(refreshFoodResults, 120);
  } else if (t.id === 'pick-q' && UI.sheet) {
    UI.sheet.q = t.value; const el = document.getElementById('pick-list'); if (el) el.innerHTML = pickRows(UI.sheet);
  } else if (t.dataset.fb && UI.sheet && UI.sheet.draft) {
    UI.sheet.draft[t.dataset.fb] = t.value;
  } else if (t.id === 'serv-n') {
    const v = parseFloat(t.value); if (v > 0) { UI.sheet.servings = v; const p = document.getElementById('serv-preview'); if (p) p.innerHTML = servPreview(UI.sheet.food, v); }
  } else if (t.dataset.tgt) {
    const c = { protein: num('tg-protein'), carbs: num('tg-carbs'), fat: num('tg-fat') };
    UI.sheet.draft = c;
    const kcal = c.protein * 4 + c.carbs * 4 + c.fat * 9;
    const k = document.getElementById('tg-kcal'); if (k) k.innerHTML = `${fmtInt(kcal)}<span class="unit">kcal</span>`;
    ['protein', 'carbs', 'fat'].forEach(m => { const el = document.getElementById('tg-pct-' + m); if (el) el.textContent = (kcal ? Math.round(c[m] * (m === 'fat' ? 9 : 4) / kcal * 100) : 0) + '% of calories'; });
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'scan-photo' && t.files && t.files[0]) {
    Scanner.stop(); setScanStatus('Reading the photo…');
    Scanner.fromImage(t.files[0]).then(code => handleBarcode(code), () => setScanStatus('Couldn\'t find a barcode in that photo. Try again closer and in good light, or type the number.'));
    return;
  }
  if (t.dataset.set && S.activeWorkout) {
    const r = S.activeWorkout.items[Number(t.dataset.i)].rows[Number(t.dataset.j)];
    const v = t.value.trim();
    if (t.dataset.set === 'w') {
      r.weightKg = v === '' ? null : dispToKg(S, v); r._auto = false;
      const it = S.activeWorkout.items[Number(t.dataset.i)];
      it.rows.forEach((row, k) => {
        if (k > Number(t.dataset.j) && !row.done && (row.weightKg == null || row._auto)) {
          row.weightKg = r.weightKg; row._auto = true;
          const inp = document.querySelector(`input[data-set="w"][data-i="${t.dataset.i}"][data-j="${k}"]`);
          if (inp) inp.value = r.weightKg == null ? '' : kgToDisp(S, r.weightKg);
        }
      });
    }
    else r.reps = v === '' ? null : Math.max(0, Math.round(parseFloat(v)) || 0);
    save();
  } else if (t.dataset.prof) {
    const k = t.dataset.prof, p = S.profile;
    if (k === 'name') p.name = t.value.trim();
    else if (k === 'age') { const a = parseInt(t.value, 10); if (a >= 16 && a <= 90) p.age = a; }
    else if (k === 'cm') { const c = parseFloat(t.value); if (c >= 120 && c <= 230) p.heightCm = c; }
    else if (k === 'ft' || k === 'inch') {
      const ft = document.querySelector('[data-prof="ft"]').value, inch = document.querySelector('[data-prof="inch"]').value;
      const c = ftInToCm(ft || 0, inch || 0); if (c >= 120 && c <= 230) p.heightCm = c;
    } else if (k === 'goal' || k === 'experience') { p[k] = t.value; rebuildPlan(k === 'goal' ? 'Plan and targets updated for ' + GOALS[p.goal].label.toLowerCase() : 'Plan rebuilt for your experience'); }
    else if (k === 'activity') { p.activity = t.value; toast('Calorie target updated'); }
    save();
  }
});

/* ---------- timers ---------- */
function tickRest() {
  if (!UI.rest) return;
  const left = Math.max(0, Math.ceil((UI.rest.end - Date.now()) / 1000));
  const el = document.getElementById('rest-t');
  if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const pr = document.getElementById('rest-prog'); if (pr) pr.style.width = ((1 - left / UI.rest.total) * 100) + '%';
  if (left <= 0) {
    UI.rest = null;
    if (navigator.vibrate) try { navigator.vibrate([120, 80, 120]); } catch (e) { /* ignore */ }
    toast('Rest is up. Next set.');
  }
}
setInterval(() => {
  if (S.activeWorkout) { const el = document.getElementById('elapsed'); if (el) el.textContent = elapsedText(S.activeWorkout.startedAt); }
  tickRest();
}, 1000);
setInterval(() => {
  if (!S.onboarded) return;
  const list = computeReminders(S);
  if (maybeNotify(S, list)) save();
  const busy = UI.sheet || UI.loggerOpen || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  if (!busy) render();
}, 60000);

/* ---------- sample data ---------- */
function seedDemo() {
  const st = defaultState();
  const today = todayKey();
  st.demo = true; st.onboarded = true; st.startDate = addDays(today, -27);
  st.profile = { name: 'Alex', sex: 'male', age: 34, heightCm: 178, weightKg: 88, goal: 'lose', experience: 'intermediate', activity: 'light', units: 'imperial' };
  st.schedule = { days: [1, 3, 5, 6], minutes: 60 };
  st.equipment = { fullGym: true, items: [] };
  st.plan = buildPlan(st); st.plan.createdAt = st.startDate;
  for (let i = 27; i >= 0; i--) {
    if (i % 4 === 2) continue;
    const kg = 88.4 - (27 - i) * 0.08 + Math.sin(i * 1.9) * 0.35;
    st.weights.push({ date: addDays(today, -i), kg: Math.round(kg * 10) / 10 });
  }
  st.profile.weightKg = st.weights[st.weights.length - 1].kg;
  const base = { barbell: 60, dumbbell: 15, cable: 32, machines: 60, smith: 50, kettlebell: 16, bands: 0 };
  const fac = { squat: 1.5, hinge: 1.7, glute: 1.6, lunge: 0.8, hpush: 1.15, vpush: 0.7, hpull: 1.0, vpull: 1.0, quad_iso: 0.9, ham_iso: 0.75, calf: 1.3, chest_iso: 0.5, side_delt: 0.4, rear_delt: 0.45, biceps: 0.45, triceps: 0.55, core: 0.6 };
  const roundLb = kg => Math.round(kg / KG_PER_LB / 5) * 5 * KG_PER_LB;
  for (let i = 27; i >= 1; i--) {
    const k = addDays(today, -i), w = workoutForDate(st, k);
    if (!w || i === 4) continue;
    const wk = Math.floor((27 - i) / 7);
    const sets = [];
    w.items.forEach(it => {
      const ex = EX_BY_ID[it.exId];
      const b = ex.req.length ? (base[ex.req[0]] || 30) * (fac[ex.pattern] || 0.8) : 0;
      for (let s = 1; s <= it.sets; s++) {
        if (ex.unit === 'min') { sets.push({ exId: ex.id, set: s, weightKg: 0, reps: it.max, done: true }); continue; }
        if (ex.unit === 'sec') { sets.push({ exId: ex.id, set: s, weightKg: 0, reps: it.min + 10 + wk * 5, done: true }); continue; }
        const kg = b ? roundLb(b + wk * (ex.lower ? 4.5 : 2.27)) : 0;
        sets.push({ exId: ex.id, set: s, weightKg: kg, reps: Math.min(it.max, it.min + ((wk + s) % 3) + (s === 1 ? 1 : 0)), done: true });
      }
    });
    const rec = { id: uid(), date: k, workoutId: w.id, name: w.name, startedAt: parseKey(k).getTime() + 17.5 * 36e5, durationMin: 52 + (i * 7) % 11, sets };
    st.workouts.push(rec); rec.prs = detectPRs(st, rec);
  }
  const F = n => FOODS.find(f => f.name === n);
  const days = [
    [['breakfast', 'Oats, dry (rolled)', 1], ['breakfast', 'Whey protein powder', 1], ['breakfast', 'Banana', 1], ['lunch', 'Chicken & rice meal prep', 1], ['lunch', 'Apple', 1], ['dinner', 'Salmon, rice & veggies', 1], ['snacks', 'Greek yogurt, nonfat plain', 1], ['snacks', 'Almonds', 1]],
    [['breakfast', 'Scrambled eggs (3) with toast', 1], ['breakfast', 'Coffee, black', 1], ['lunch', 'Turkey sandwich', 1], ['lunch', 'Baby carrots', 1], ['dinner', 'Sirloin steak, cooked', 1.5], ['dinner', 'Potato, baked with skin', 1], ['dinner', 'Broccoli, cooked', 1], ['snacks', 'Protein bar (typical)', 1]],
    [['breakfast', 'Greek yogurt parfait', 1], ['lunch', 'Burrito bowl, chicken', 1], ['dinner', 'Pizza, pepperoni', 3], ['snacks', 'Beer, light', 2]],
  ];
  for (let i = 6; i >= 1; i--) {
    const k = addDays(today, -i);
    days[i % 3].forEach(([meal, n, sv]) => { const f = F(n); if (f) (st.foodLog[k] = st.foodLog[k] || []).push({ id: uid(), meal, name: f.name, serving: f.serving, servings: sv, kcal: f.kcal, p: f.p, c: f.c, f: f.f, source: 'built-in' }); });
  }
  [['breakfast', 'Oats, dry (rolled)', 1], ['breakfast', 'Whey protein powder', 1], ['breakfast', 'Blueberries', 1], ['lunch', 'Chicken & rice meal prep', 1]].forEach(([meal, n, sv]) => { const f = F(n); (st.foodLog[today] = st.foodLog[today] || []).push({ id: uid(), meal, name: f.name, serving: f.serving, servings: sv, kcal: f.kcal, p: f.p, c: f.c, f: f.f, source: 'built-in' }); });
  ['Chicken & rice meal prep', 'Whey protein powder', 'Oats, dry (rolled)', 'Greek yogurt, nonfat plain', 'Banana', 'Almonds'].forEach(n => { const f = F(n); st.recentFoods.push({ id: 'r_' + f.name, name: f.name, serving: f.serving, kcal: f.kcal, p: f.p, c: f.c, f: f.f, source: 'built-in' }); });
  st.checkins = [
    { date: addDays(today, -14), change: null, adjust: 0, adherence: 'yes' },
    { date: addDays(today, -7), change: -0.45, adjust: 0, adherence: 'mostly' },
  ];
  S = st; save();
}

/* ---------- start ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); UI.installPrompt = e; });
window.addEventListener('appinstalled', () => { UI.installPrompt = null; });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline mode unavailable here */ });
}

// Start once every script (including add-on screens loaded after this file) is ready.
function init() {
  if (S.activeWorkout) UI.loggerOpen = false;
  render();
  if (S.onboarded) { const list = computeReminders(S); if (maybeNotify(S, list)) save(); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else setTimeout(init, 0);
