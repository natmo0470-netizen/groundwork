/* Groundwork — plan builder, progression and personal records. */

const TEMPLATES = {
  fbA:    { name: 'Full Body A', slots: ['squat', 'hpush', 'hpull', 'glute', 'vpush', 'biceps', 'core', 'calf'] },
  fbB:    { name: 'Full Body B', slots: ['hinge', 'vpush', 'vpull', 'lunge', 'hpush', 'triceps', 'core', 'side_delt'] },
  fbC:    { name: 'Full Body C', slots: ['lunge', 'hpush', 'hpull', 'hinge', 'side_delt', 'biceps', 'triceps', 'core'] },
  upA:    { name: 'Upper A', slots: ['hpush', 'hpull', 'vpush', 'vpull', 'side_delt', 'biceps', 'triceps', 'rear_delt'] },
  loA:    { name: 'Lower A', slots: ['squat', 'hinge', 'lunge', 'quad_iso', 'ham_iso', 'calf', 'core'] },
  upB:    { name: 'Upper B', slots: ['vpush', 'vpull', 'hpush', 'hpull', 'chest_iso', 'triceps', 'biceps', 'side_delt'] },
  loB:    { name: 'Lower B', slots: ['hinge', 'squat', 'glute', 'ham_iso', 'quad_iso', 'calf', 'core'] },
  push:   { name: 'Push', slots: ['hpush', 'vpush', 'hpush', 'chest_iso', 'side_delt', 'triceps', 'triceps'] },
  pull:   { name: 'Pull', slots: ['vpull', 'hpull', 'hpull', 'rear_delt', 'biceps', 'biceps', 'core'] },
  legs:   { name: 'Legs', slots: ['squat', 'hinge', 'lunge', 'quad_iso', 'ham_iso', 'calf', 'core'] },
  cardio: { name: 'Cardio + Core', slots: ['cardio', 'core', 'core'], cardio: true },
};

const SLOT_LABEL = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Single leg', hpush: 'Chest press', vpush: 'Overhead press', hpull: 'Row',
  vpull: 'Pull-down', glute: 'Glutes', quad_iso: 'Quads', ham_iso: 'Hamstrings', calf: 'Calves', chest_iso: 'Chest fly',
  side_delt: 'Side delts', rear_delt: 'Rear delts', biceps: 'Biceps', triceps: 'Triceps', core: 'Core', cardio: 'Cardio', shrug: 'Traps', forearm: 'Forearms', adductor: 'Inner thighs',
};
const COMPOUND = ['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull', 'glute'];

function splitFor(days, goal) {
  if (goal === 'endurance') {
    const m = { 2: ['fbA', 'cardio'], 3: ['fbA', 'cardio', 'fbB'], 4: ['fbA', 'cardio', 'fbB', 'cardio'], 5: ['fbA', 'cardio', 'fbB', 'cardio', 'fbC'], 6: ['fbA', 'cardio', 'fbB', 'cardio', 'fbC', 'cardio'], 7: ['fbA', 'cardio', 'fbB', 'cardio', 'fbC', 'cardio', 'cardio'] };
    return { name: 'Strength + cardio', keys: m[days] || m[3] };
  }
  const m = {
    2: { name: 'Full body, 2 days', keys: ['fbA', 'fbB'] },
    3: { name: 'Full body, 3 days', keys: ['fbA', 'fbB', 'fbC'] },
    4: { name: 'Upper / Lower', keys: ['upA', 'loA', 'upB', 'loB'] },
    5: { name: 'Upper / Lower + Push / Pull / Legs', keys: ['upA', 'loA', 'push', 'pull', 'legs'] },
    6: { name: 'Push / Pull / Legs, twice a week', keys: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] },
    7: { name: 'Push / Pull / Legs + Upper / Lower, with 2 lighter days', keys: ['push', 'pull', 'legs', 'cardio', 'upA', 'loA', 'cardio'] },
  };
  return m[days] || m[3];
}

function equipList(state) {
  return state.equipment.fullGym ? FULL_GYM.slice() : state.equipment.items.slice();
}

function candidates(pattern, equip, experience) {
  const maxDiff = (EXPERIENCE[experience] || EXPERIENCE.beginner).maxDiff;
  const list = EXERCISES.filter(e => e.pattern === pattern && exerciseAvailable(e, equip));
  const ok = list.filter(e => e.diff <= maxDiff), hard = list.filter(e => e.diff > maxDiff);
  if (experience === 'beginner') ok.sort((a, b) => a.diff - b.diff);
  return ok.concat(hard);
}

function prescribe(goal, experience, ex, isMain, minutes) {
  if (ex.unit === 'min') {
    const base = Math.max(15, minutes - 15);
    return { sets: 1, min: base - 5, max: base, rest: 0 };
  }
  if (ex.unit === 'sec') {
    return experience === 'beginner' ? { sets: 3, min: 20, max: 40, rest: 45 } : { sets: 3, min: 30, max: 60, rest: 45 };
  }
  const T = {
    strength:  isMain ? [4, 4, 6, 180] : [3, 8, 10, 90],
    muscle:    isMain ? [3, 6, 10, 120] : [3, 10, 15, 75],
    lose:      isMain ? [3, 8, 12, 90] : [3, 12, 15, 60],
    general:   isMain ? [3, 8, 12, 90] : [2, 10, 15, 60],
    endurance: isMain ? [3, 10, 15, 60] : [2, 15, 20, 45],
  }[goal] || [3, 8, 12, 90];
  let sets = T[0];
  if (experience === 'beginner') sets = Math.min(sets, 3);
  if (experience === 'advanced' && isMain && goal !== 'endurance') sets += 1;
  if (ex.pattern === 'core' && ex.unit === 'reps') return { sets: 3, min: 10, max: 15, rest: 45 };
  return { sets, min: T[1], max: T[2], rest: T[3] };
}

function buildWorkout(key, variant, state, equip, block) {
  const rot = Math.max(0, (block || 1) - 1);
  const p = state.profile, minutes = state.schedule.minutes;
  const T = TEMPLATES[key];
  let count = { 30: 4, 45: 5, 60: 6, 75: 7 }[minutes] || 5;
  if (p.goal === 'strength') count = Math.max(3, count - 1);
  const used = new Set();
  const items = [];
  for (let i = 0; i < T.slots.length && items.length < (T.cardio ? 3 : count); i++) {
    const slot = T.slots[i];
    const c = candidates(slot, equip, p.experience).filter(e => !used.has(e.id));
    if (!c.length) continue;
    // Main lifts stay put so progress is comparable; accessories rotate each new block.
    const pick = items.length < 2 ? Math.min(variant, c.length - 1) : (variant + rot) % c.length;
    const ex = c[pick] || c[0];
    used.add(ex.id);
    const isMain = items.length < 2 && COMPOUND.includes(slot);
    items.push({ exId: ex.id, slot, ...prescribe(p.goal, p.experience, ex, isMain, minutes) });
  }
  // Fat-loss finisher: short intervals on whatever cardio option is available.
  if (p.goal === 'lose' && !T.cardio && minutes >= 45) {
    const pick = ['bike', 'rower', 'jump_rope', 'incline_walk', 'elliptical', 'stair_climber', 'mountain_climber', 'jump_squat']
      .map(id => EX_BY_ID[id]).find(e => e && exerciseAvailable(e, equip) && !used.has(e.id));
    if (pick) items.push({ exId: pick.id, slot: 'finisher', sets: pick.unit === 'min' ? 1 : 4, min: pick.unit === 'min' ? 8 : 20, max: pick.unit === 'min' ? 10 : 30, rest: pick.unit === 'min' ? 0 : 40, note: 'Finisher: 30 s hard, 30 s easy' });
  }
  const groups = [...new Set(items.filter(i => i.slot !== 'finisher').map(i => EX_BY_ID[i.exId].group))];
  return { id: key + (variant ? '_' + variant : ''), key, name: T.name + (variant ? ' (variation)' : ''), focus: groups.slice(0, 4).join(' · '), cardio: !!T.cardio, items };
}

function buildPlan(state, block) {
  block = block || 1;
  const prog = state.program && typeof PROGRAM_BY_ID !== 'undefined' && PROGRAM_BY_ID[state.program];
  if (prog) return buildProgramPlan(state, prog, block);
  const days = state.schedule.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const split = splitFor(days.length, state.profile.goal);
  const equip = equipList(state);
  const seen = {};
  const workouts = split.keys.map(k => { seen[k] = (seen[k] || 0); const w = buildWorkout(k, seen[k], state, equip, block); seen[k]++; return w; });
  const dayMap = {};
  days.forEach((d, i) => { dayMap[d] = workouts[i % workouts.length].id; });
  return { split: split.name, createdAt: todayKey(), workouts, dayMap, week: 1, block, overrides: {}, pinned: {} };
}

/* ---------- training blocks and deloads ----------
   Beginners run 8-week blocks, everyone else 6. The last week of each block is a deload:
   fewer sets at about 90% of working weight, so fatigue clears before the next block. */
function blockInfo(state, key) {
  const P = state.plan;
  if (!P) return null;
  const len = P.weeks || (state.profile.experience === 'beginner' ? 8 : 6);
  const week = Math.floor(daysBetween(P.createdAt, key || todayKey()) / 7) + 1;
  return { len, week: Math.min(week, len), rawWeek: week, deload: week === len, done: week > len, block: P.block || 1 };
}
function roundLoad(state, kg) {
  if (!kg) return kg;
  const step = isMetric(state) ? 2.5 : 5;
  return dispToKg(state, Math.round(kgToDisp(state, kg, 2) / step) * step);
}

/* What's planned on a date. Order of precedence:
   1. a one-off change for that date (overrides)  2. a weekday the user pinned to a session
   3. a rotating program (cycle) across training days  4. the weekly dayMap. */
function workoutForDate(state, key) {
  const P = state.plan;
  if (!P) return null;
  const find = id => P.workouts.find(w => w.id === id) || null;
  const ov = P.overrides && P.overrides[key];
  if (ov === 'rest') return null;
  if (ov && find(ov)) return find(ov);
  return naturalWorkout(state, key);
}
function naturalWorkout(state, key) {
  const P = state.plan, dow = parseKey(key).getDay();
  const find = id => P.workouts.find(w => w.id === id) || null;
  const pinned = P.pinned || {};
  if (P.cycle && P.cycle.length && !pinned[dow]) {
    const order = state.schedule.days.filter(d => !pinned[d]).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    const pos = order.indexOf(dow);
    if (pos < 0) return null;
    const weeks = Math.floor(daysBetween(weekStart(P.createdAt), weekStart(key)) / 7);
    const n = P.cycle.length, i = (((weeks * order.length + pos) % n) + n) % n;
    return find(P.cycle[i]);
  }
  const id = P.dayMap[dow];
  return id ? find(id) : null;
}

/* ---------- quick day changes ---------- */
const SESSION_TYPES = [
  ['upA', 'Upper body', 'Chest, back, shoulders, arms'],
  ['loA', 'Lower body', 'Quads, hamstrings, glutes, calves'],
  ['push', 'Push', 'Chest, shoulders, triceps'],
  ['pull', 'Pull', 'Back, biceps, rear delts'],
  ['legs', 'Legs', 'Squats, hinges, calves'],
  ['fbA', 'Full body', 'A bit of everything'],
  ['cardio', 'Cardio + core', 'Lighter day'],
];
/* Find a session of this template type in the plan, or build one with the user's equipment. */
function ensureSession(state, key) {
  const P = state.plan;
  const have = P.workouts.find(w => w.key === key && !w.program);
  if (have) return have;
  const w = buildWorkout(key, 0, state, equipList(state), P.block || 1);
  if (P.workouts.some(x => x.id === w.id)) w.id = w.id + '_' + uid().slice(0, 4);
  P.workouts.push(w);
  return w;
}
/* id: a workout id or 'rest'. scope: 'once' (this date) or 'always' (every week on that weekday). */
function setDaySession(state, key, id, scope) {
  const P = state.plan, dow = parseKey(key).getDay();
  P.overrides = P.overrides || {}; P.pinned = P.pinned || {};
  if (scope === 'once') {
    const nat = naturalWorkout(state, key);
    if ((id === 'rest' && !nat) || (nat && nat.id === id)) delete P.overrides[key];
    else P.overrides[key] = id;
    return;
  }
  delete P.overrides[key];
  if (id === 'rest') {
    delete P.dayMap[dow]; delete P.pinned[dow];
    state.schedule.days = state.schedule.days.filter(d => d !== dow);
  } else {
    P.dayMap[dow] = id;
    if (!state.schedule.days.includes(dow)) state.schedule.days.push(dow);
    if (P.cycle) P.pinned[dow] = true;
  }
}
function tradeDays(state, a, b, scope) {
  const wa = workoutForDate(state, a), wb = workoutForDate(state, b);
  setDaySession(state, a, wb ? wb.id : 'rest', scope);
  setDaySession(state, b, wa ? wa.id : 'rest', scope);
}
/* Workouts the schedule actually uses (so extra sessions don't clutter the plan screen). */
function workoutsInUse(state) {
  const P = state.plan, ids = new Set(Object.values(P.dayMap));
  (P.cycle || []).forEach(id => ids.add(id));
  const today = todayKey();
  Object.entries(P.overrides || {}).forEach(([k, id]) => { if (k >= today && id !== 'rest') ids.add(id); });
  return P.workouts.filter(w => ids.has(w.id));
}
function workoutDoneOn(state, key) { return state.workouts.find(w => w.date === key); }

/* ---------- progression (double progression) ---------- */
function lastSessionFor(state, exId) {
  for (let i = state.workouts.length - 1; i >= 0; i--) {
    const sets = state.workouts[i].sets.filter(s => s.exId === exId && s.done);
    if (sets.length) return { date: state.workouts[i].date, sets };
  }
  return null;
}
function increment(state, ex) {
  const metric = isMetric(state);
  const dumbbellish = ex.req.includes('dumbbell') || ex.req.includes('kettlebell');
  if (metric) return ex.lower && !dumbbellish ? 5 : (dumbbellish ? 2 : 2.5);
  return ex.lower && !dumbbellish ? 10 : 5;
}
function suggestion(state, item) {
  const ex = EX_BY_ID[item.exId];
  if (ex.unit !== 'reps') {
    const last = lastSessionFor(state, ex.id);
    const best = last ? Math.max(...last.sets.map(s => s.reps || 0)) : 0;
    const u = ex.unit === 'min' ? 'min' : 's';
    return { weightKg: null, reps: null, text: last ? `Last time: best ${best} ${u}. Go a little longer today.` : `Aim for ${item.min}–${item.max} ${u}${item.sets > 1 ? ' per round' : ''}.` };
  }
  const last = lastSessionFor(state, ex.id);
  if (!last) {
    const rr = item.min === item.max ? `${item.min}` : `${item.min}–${item.max}`;
    return { weightKg: null, reps: item.min, text: ex.req.length ? `First time: pick a weight you could lift for ${item.max + 2}–${item.max + 3} reps, then do ${rr}.` : `Do ${rr} controlled reps.` };
  }
  const weighted = last.sets.some(s => s.weightKg > 0);
  if (!weighted) {
    const allTop = last.sets.every(s => s.reps >= item.max);
    return { weightKg: null, reps: Math.max(...last.sets.map(s => s.reps)), text: allTop ? `You hit ${item.max} on every set. Slow the lowering to 3 seconds, or pick a harder variation.` : `Last time: ${last.sets.map(s => s.reps).join(', ')} reps. Add one rep per set.` };
  }
  const top = Math.max(...last.sets.map(s => s.weightKg || 0));
  const atTop = last.sets.filter(s => Math.abs((s.weightKg || 0) - top) < 0.01);
  const allHit = atTop.length >= item.sets && atTop.every(s => s.reps >= item.max);
  const anyLow = atTop.some(s => s.reps < item.min);
  const incDisp = increment(state, ex);
  const lastTxt = `${kgToDisp(state, top)} ${wUnit(state)} × ${atTop.map(s => s.reps).join(', ')}`;
  if (allHit) {
    const nextKg = dispToKg(state, kgToDisp(state, top) + incDisp);
    return { weightKg: nextKg, reps: item.min, text: `Last: ${lastTxt}. You hit the top of the range, so add ${incDisp} ${wUnit(state)}.` };
  }
  if (anyLow) return { weightKg: top, reps: item.min, text: `Last: ${lastTxt}. Stay at this weight and aim for ${item.min}+ reps on every set.` };
  return { weightKg: top, reps: Math.min(item.max, Math.max(...atTop.map(s => s.reps)) + 1), text: `Last: ${lastTxt}. Same weight, beat it by one rep.` };
}

/* ---------- personal records ---------- */
const e1rm = (kg, reps) => kg * (1 + reps / 30);
function bestsFor(state, exId, excludeWorkoutId) {
  let maxW = 0, maxWReps = 0, best1 = 0, maxReps = 0;
  state.workouts.forEach(w => {
    if (w.id === excludeWorkoutId) return;
    w.sets.forEach(s => {
      if (s.exId !== exId || !s.done) return;
      const kg = s.weightKg || 0;
      if (kg > maxW || (kg === maxW && s.reps > maxWReps)) { maxW = kg; maxWReps = s.reps; }
      if (kg > 0) best1 = Math.max(best1, e1rm(kg, s.reps));
      maxReps = Math.max(maxReps, s.reps || 0);
    });
  });
  return { maxW, maxWReps, best1, maxReps };
}
function detectPRs(state, workout) {
  const prs = [];
  const ids = [...new Set(workout.sets.filter(s => s.done).map(s => s.exId))];
  ids.forEach(id => {
    const before = bestsFor(state, id, workout.id);
    const hadHistory = state.workouts.some(w => w.id !== workout.id && w.sets.some(s => s.exId === id && s.done));
    if (!hadHistory) return;
    const sets = workout.sets.filter(s => s.exId === id && s.done);
    const ex = EX_BY_ID[id];
    let best = null;
    sets.forEach(s => {
      const kg = s.weightKg || 0;
      if (kg > 0 && kg > before.maxW) best = { type: 'weight', exId: id, kg, reps: s.reps };
      else if (kg > 0 && !best && e1rm(kg, s.reps) > before.best1 + 0.01) best = { type: 'e1rm', exId: id, kg, reps: s.reps };
      else if (kg === 0 && ex.unit === 'reps' && s.reps > before.maxReps && !best) best = { type: 'reps', exId: id, kg: 0, reps: s.reps };
    });
    if (best) prs.push(best);
  });
  return prs;
}
function prBoard(state) {
  const ids = [...new Set(state.workouts.flatMap(w => w.sets.filter(s => s.done).map(s => s.exId)))];
  return ids.map(id => ({ ex: EX_BY_ID[id], ...bestsFor(state, id) }))
    .filter(r => r.ex && r.ex.unit === 'reps')
    .sort((a, b) => b.best1 - a.best1 || b.maxReps - a.maxReps);
}
