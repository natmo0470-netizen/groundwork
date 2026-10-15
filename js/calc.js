/* Movla — calorie and macro calculator, unit conversion. */
const KG_PER_LB = 0.45359237;

const GOALS = {
  lose:      { label: 'Lose fat',        short: 'Fat loss',  blurb: 'Lose weight while keeping your muscle.', adj: -0.20, protein: 2.0, fatPct: 0.30 },
  muscle:    { label: 'Build muscle',    short: 'Muscle',    blurb: 'Add size with a small calorie surplus.', adj: 0.10, protein: 1.8, fatPct: 0.27 },
  strength:  { label: 'Get stronger',    short: 'Strength',  blurb: 'Lift heavier on the big lifts.',         adj: 0.05, protein: 1.8, fatPct: 0.28 },
  general:   { label: 'General fitness', short: 'Fitness',   blurb: 'Feel better, move better, stay healthy.', adj: 0, protein: 1.6, fatPct: 0.30 },
  endurance: { label: 'Endurance',       short: 'Endurance', blurb: 'Build stamina with cardio plus strength.', adj: 0, protein: 1.4, fatPct: 0.25 },
};
const ACTIVITY = {
  sedentary: { label: 'Mostly sitting',  blurb: 'Desk job, little walking',            mult: 1.2 },
  light:     { label: 'Lightly active',  blurb: 'Some walking, on your feet at times', mult: 1.375 },
  moderate:  { label: 'Active',          blurb: 'On your feet most of the day',        mult: 1.55 },
  very:      { label: 'Very active',     blurb: 'Physical job or lots of walking',     mult: 1.725 },
};
const EXPERIENCE = {
  beginner:     { label: 'Beginner',     blurb: 'New to lifting or back after a long break', maxDiff: 2 },
  intermediate: { label: 'Intermediate', blurb: 'Training consistently for 6+ months',       maxDiff: 3 },
  advanced:     { label: 'Advanced',     blurb: 'Several years of structured training',      maxDiff: 3 },
};

/* Daily targets. Pass a date key to get that day's targets: diet breaks, refeed days and
   training-day / rest-day carb cycling (Advanced nutrition) change individual days while the
   weekly average stays on plan. */
function calcTargets(state, key) {
  const p = state.profile;
  const g = GOALS[p.goal] || GOALS.general;
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'female' ? -161 : 5);
  const tdee = bmr * (ACTIVITY[p.activity] || ACTIVITY.light).mult;
  let goalAdj = tdee * g.adj;
  if (goalAdj < -750) goalAdj = -750;
  // Safety: no deficit during pregnancy or breastfeeding; a gentler cap for under-18s.
  const sf = state.safety || {};
  let safetyNote = '';
  if (sf.pregnant && goalAdj < 0) { goalAdj = 0; safetyNote = 'Pregnant or breastfeeding: targets are set at maintenance, not a deficit.'; }
  if (p.age < 18 && goalAdj < -tdee * 0.1) { goalAdj = -tdee * 0.1; safetyNote = 'Under 18: the deficit is kept small to support growth.'; }
  const floor = p.sex === 'female' ? 1200 : 1500;
  let calories = Math.round((tdee + goalAdj + (state.calorieAdjust || 0)) / 10) * 10;
  let floorApplied = false;
  if (calories < floor) { calories = floor; floorApplied = true; }

  // Protein from bodyweight; for higher body weights use a reference weight (BMI 27) so targets stay realistic.
  const hM = p.heightCm / 100;
  const refKg = Math.min(p.weightKg, 27 * hM * hM);
  const protein = Math.round(refKg * g.protein);
  let fat = Math.round(Math.max(calories * g.fatPct / 9, p.weightKg * 0.6));
  let carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  if (carbs < 50) { carbs = 50; fat = Math.max(30, Math.round((calories - protein * 4 - carbs * 4) / 9)); }
  const rec = { calories, protein, carbs, fat };

  let active = rec, custom = false;
  if (state.macros.mode === 'custom' && state.macros.custom) {
    const c = state.macros.custom;
    active = { protein: c.protein, carbs: c.carbs, fat: c.fat, calories: Math.round(c.protein * 4 + c.carbs * 4 + c.fat * 9) };
    custom = true;
  }
  const out = { bmr: Math.round(bmr), tdee: Math.round(tdee), goalAdj: Math.round(goalAdj), adjust: state.calorieAdjust || 0, floor, floorApplied, rec, ...active, custom, safetyNote, dayType: null, dayDelta: 0 };
  return key ? dayTargets(state, out, key) : out;
}
function dayTargets(state, T, key) {
  const maint = Math.round(T.tdee / 10) * 10;
  const setCal = (cal, type) => {
    const delta = cal - T.calories;
    const carbs = Math.max(50, Math.round(T.carbs + delta / 4));
    return Object.assign({}, T, { calories: Math.round(T.protein * 4 + carbs * 4 + T.fat * 9), carbs, dayType: type, dayDelta: Math.round(delta) });
  };
  const brk = state.dietBreak;
  if (brk && key >= brk.start && key <= brk.end && T.calories < maint) return setCal(maint, 'break');
  if (state.refeeds && state.refeeds[key] && T.calories < maint) return setCal(maint, 'refeed');
  if (state.macros && state.macros.cycle && state.plan && typeof workoutForDate === 'function') {
    const n = state.schedule.days.length;
    if (n > 0 && n < 7) {
      const shift = Math.round(T.calories * 0.1 / 10) * 10;          // training days: +10%, all from carbs
      const restShift = Math.round(shift * n / (7 - n) / 10) * 10;    // rest days give it back
      const w = workoutForDate(state, key);
      return w ? setCal(T.calories + shift, 'training') : setCal(Math.max(T.floor, T.calories - restShift), 'rest');
    }
  }
  return T;
}

/* Expected weekly change as a fraction of body weight, used by the weekly check-in. */
function expectedRate(goal) {
  return { lose: [-0.010, -0.0025], muscle: [0.001, 0.005], strength: [-0.001, 0.004], general: [-0.004, 0.004], endurance: [-0.004, 0.004] }[goal] || [-0.004, 0.004];
}

/* ---------- units ---------- */
function isMetric(state) { return state.profile.units === 'metric'; }
function wUnit(state) { return isMetric(state) ? 'kg' : 'lb'; }
function kgToDisp(state, kg, dp) {
  if (kg == null || kg === '') return '';
  const v = isMetric(state) ? kg : kg / KG_PER_LB;
  const d = dp == null ? 1 : dp;
  const r = Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
  return r;
}
function dispToKg(state, v) {
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return isMetric(state) ? n : n * KG_PER_LB;
}
function fmtWeight(state, kg, dp) { return kg == null ? '—' : `${kgToDisp(state, kg, dp == null ? 1 : dp)} ${wUnit(state)}`; }
function cmToFtIn(cm) { const totalIn = cm / 2.54; let ft = Math.floor(totalIn / 12); let inch = Math.round(totalIn - ft * 12); if (inch === 12) { ft += 1; inch = 0; } return { ft, inch }; }
function ftInToCm(ft, inch) { return (Number(ft) * 12 + Number(inch)) * 2.54; }
function fmtHeight(state, cm) { if (isMetric(state)) return `${Math.round(cm)} cm`; const h = cmToFtIn(cm); return `${h.ft}′ ${h.inch}″`; }
