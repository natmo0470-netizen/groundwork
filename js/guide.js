/* Groundwork — experience modes, beginner guidance, tips and guides.
   Modes:
   - guided   (beginners): same information, less at once; screen tips, first-week checklist,
              guides, plain-language labels, calories + protein first.
   - standard (intermediate): everything visible, no hand-holding.
   - advanced (serious lifters): standard today; advanced tools are added here next.
   The mode follows the experience level unless the user picks one in Settings. */

const MODES = {
  guided:   { label: 'Guided',   desc: 'Simpler screens, tips and step-by-step guides. Great for your first months.' },
  standard: { label: 'Standard', desc: 'Everything visible: full macros, programs and progress details, no tips.' },
  advanced: { label: 'Advanced', desc: 'For experienced lifters: reps in reserve, warm-up and drop sets, supersets, weekly sets per muscle, carb cycling, refeeds and diet breaks.' },
};
const MODE_FOR_EXP = { beginner: 'guided', intermediate: 'standard', advanced: 'advanced' };

function ensureGuide(st) {
  st = st || S;
  if (!st.guide) st.guide = { tips: {}, done: {}, fwHidden: false, nudge: null };
  return st.guide;
}
function modeOf(st) { st = st || S; return st.mode || MODE_FOR_EXP[st.profile.experience] || 'standard'; }
function isGuided() { return S.onboarded && modeOf() === 'guided'; }
function markGuide(key) { const g = ensureGuide(); if (!g.done[key]) { g.done[key] = todayKey(); save(); } }

/* ---------- plain-language labels ---------- */
function term(k) {
  const g = isGuided();
  return ({
    block: g ? 'Training cycle' : 'Block',
    deload: g ? 'Easy week' : 'Deload week',
    pr: g ? 'personal best' : 'PR',
    prs: g ? 'Personal bests' : 'PRs set',
  })[k] || k;
}

/* ---------- macros: guided shows protein first, carbs and fat on request ---------- */
function macroRow(tot, T) {
  if (!isGuided() || UI.showMacros) return `<div class="macros">${macroBar('p', 'Protein', tot.p, T.protein)}${macroBar('c', 'Carbs', tot.c, T.carbs)}${macroBar('f', 'Fat', tot.f, T.fat)}</div>${isGuided() ? `<button class="link muted small" data-act="toggle-macros" style="align-self:flex-start">Hide carbs and fat</button>` : ''}`;
  return `<div class="macros" style="grid-template-columns:1fr">${macroBar('p', 'Protein', tot.p, T.protein)}</div>
    <div class="row" style="gap:14px;flex-wrap:wrap"><button class="link muted small" data-act="toggle-macros">Show carbs and fat</button><button class="link fuel small" data-act="open-guide" data-id="calories">Why calories and protein?</button></div>`;
}

/* ---------- screen tips (shown once per screen in Guided mode) ---------- */
const SCREEN_TIPS = {
  today: ['Your home base', 'Each day shows your workout and your food target. When you get to the gym, tap Start workout. Everything else can wait.'],
  train: ['Your plan', 'Tap any day to switch what you train. Tap an exercise to watch a demo and read how to do it.'],
  food: ['Two numbers matter most', 'Calories decide whether your weight goes up or down; protein helps you keep and build muscle. Log meals as you go; close enough is good enough.'],
  progress: ['Watch the trend', 'Weigh yourself first thing in the morning a few times a week. Daily weight jumps around; the average line is what counts.'],
  logger: ['Logging a set', 'Type the weight and reps you did, then tap the check. A rest timer starts on its own. Unsure of the weight? Start light; you can change it next set.'],
};
function tipBanner(key) {
  if (!isGuided()) return '';
  const g = ensureGuide(); if (g.tips[key] || !SCREEN_TIPS[key]) return '';
  const [title, body] = SCREEN_TIPS[key];
  return `<div class="nudge guide-tip"><span class="ni">${icon('bulb', 20)}</span><div class="stack grow" style="gap:4px"><b>${esc(title)}</b><span class="small muted">${esc(body)}</span><button class="link" data-act="tip-ok" data-id="${key}" style="align-self:flex-start">Got it</button></div></div>`;
}

/* ---------- first-week checklist ---------- */
const FIRST_WEEK = [
  ['plan', 'Look over your plan', 'Open the Train tab', 'tab-train'],
  ['demo', 'Watch an exercise demo', 'Tap any exercise', 'tab-train'],
  ['workout', 'Finish your first workout', 'Log it as you go', 'tab-train'],
  ['food', 'Log a day of food', 'Even a rough log helps', 'tab-food'],
  ['weight', 'Do a morning weigh-in', 'Before breakfast', 'log-weight'],
  ['guide', 'Read a beginner guide', 'Two-minute reads', 'open-guides'],
];
function firstWeekDone(key) {
  const g = ensureGuide();
  if (key === 'workout') return S.workouts.length > 0;
  if (key === 'food') return Object.values(S.foodLog).some(l => l && l.length);
  if (key === 'weight') return S.weights.length > 1 || S.weights.some(w => w.date !== S.startDate);
  return !!g.done[key];
}
function firstWeekCard() {
  const g = ensureGuide();
  if (g.fwHidden) return '';
  const n = FIRST_WEEK.filter(([k]) => firstWeekDone(k)).length;
  if (n === FIRST_WEEK.length) return `<div class="card train"><div class="card-head"><span class="eyebrow">Your first week</span><span class="tag train">${icon('check', 14)} Complete</span></div><p class="small muted">You've covered the basics. Keep showing up; consistency is what builds results.</p><button class="link muted" data-act="fw-hide" style="align-self:flex-start">Hide this</button></div>`;
  return `<div class="card"><div class="card-head"><span class="eyebrow">Your first week</span><span class="small faint">${n} of ${FIRST_WEEK.length}</span></div>
    <div class="progress" style="height:6px"><i style="width:${n / FIRST_WEEK.length * 100}%"></i></div>
    <div class="list">${FIRST_WEEK.map(([k, title, sub, act]) => { const done = firstWeekDone(k); return `<button class="li fw-item ${done ? 'done' : ''}" ${done ? 'disabled' : `data-act="${act}"`}><span class="fw-check">${done ? icon('check', 14) : ''}</span><span class="grow"><span class="t">${esc(title)}</span><br><span class="d">${esc(sub)}</span></span>${done ? '' : `<span class="chev">${icon('chevR', 18)}</span>`}</button>`; }).join('')}</div>
    <button class="link muted small" data-act="fw-hide" style="align-self:flex-start">Hide checklist</button></div>`;
}

/* ---------- daily tip ---------- */
const DAILY_TIPS = [
  'Showing up matters more than a perfect workout. A short session still counts.',
  'Leave 1–3 reps "in the tank" on most sets. You don\'t need to go to failure to grow.',
  'Protein at each meal makes your daily target much easier to hit.',
  'Sore the next day is normal in the first few weeks. It fades as your body adapts.',
  'Aim for 7–9 hours of sleep. Recovery is when muscles actually get stronger.',
  'Weigh yourself under the same conditions: morning, after the bathroom, before eating.',
  'Lower the weight slowly. The lowering part of a rep builds a lot of strength.',
  'Drink water through the day; a glass with each meal is an easy habit.',
  'If an exercise feels wrong, swap it. There\'s always another way to train the same muscle.',
  'Fruit, vegetables and lean protein fill you up for fewer calories.',
  'Write down your sets. Beating last week by one rep is real progress.',
  'Walking counts. A daily walk helps recovery and burns extra calories.',
  'Warm up with a couple of light sets before your first heavy exercise.',
  'Weekends count too: logging a rough estimate beats skipping the day.',
  'Breathe out as you push or pull, and in as you lower.',
  'Progress isn\'t a straight line. Look at the last month, not the last day.',
  'Pre-cut vegetables and pre-cooked protein make healthy meals faster than takeout.',
  'Rest days are part of the plan, not a break from it.',
];
function dailyTip() {
  const d = daysBetween('2026-01-01', todayKey());
  return DAILY_TIPS[((d % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length];
}
function guidedTodayExtras() {
  if (!isGuided()) return moveUpCard();
  const picks = ['start-weight', 'first-gym', 'calories'];
  return `${firstWeekCard()}
    <div class="card"><div class="card-head"><span class="eyebrow">Tip of the day</span>${icon('bulb', 18, 'style="color:var(--train)"')}</div><p class="small" style="margin:0">${esc(dailyTip())}</p></div>
    <div class="card"><div class="card-head"><span class="eyebrow">Beginner guides</span><button class="link" data-act="open-guides">See all</button></div>
      <div class="list">${picks.map(id => guideRow(GUIDE_BY_ID[id])).join('')}</div></div>
    ${moveUpCard()}`;
}
/* After a few consistent weeks in Guided mode, offer Standard. */
function moveUpCard() {
  if (modeOf() !== 'guided') return '';
  const g = ensureGuide();
  if (g.nudge === 'no' || S.workouts.length < 8 || daysBetween(S.startDate, todayKey()) < 21) return '';
  return `<div class="card train"><div class="card-head"><span class="eyebrow">Ready for more?</span></div>
    <p class="small muted" style="margin:0">You've logged ${S.workouts.length} workouts. Standard view shows your full macros and progress details and drops the beginner tips. You can switch back anytime.</p>
    <div class="grid2"><button class="btn train sm" data-act="set-mode" data-v="standard">Switch to Standard</button><button class="btn ghost sm" data-act="mode-later">Keep Guided</button></div></div>`;
}

/* ---------- why each exercise is in the workout (Guided logger) ---------- */
const SLOT_WHY = {
  squat: 'Builds your legs and core. A foundation for everyday strength.',
  hinge: 'Strengthens your hamstrings, glutes and back. Teaches you to lift safely from the floor.',
  lunge: 'Trains one leg at a time for balance and evens out left-right differences.',
  hpush: 'Builds your chest, shoulders and triceps.',
  vpush: 'Builds your shoulders and arms for pressing overhead.',
  hpull: 'Strengthens your upper back for better posture.',
  vpull: 'Builds your lats, the big back muscles that give a V-shape.',
  glute: 'Strengthens your glutes, which power walking, climbing and lifting.',
  quad_iso: 'Extra work for the front of your thighs.',
  ham_iso: 'Extra work for the back of your thighs; helps protect your knees.',
  calf: 'Strengthens your calves and ankles.',
  chest_iso: 'Extra chest work with a big stretch.',
  side_delt: 'Shapes your shoulders from the side.',
  rear_delt: 'Balances your shoulders and helps posture.',
  biceps: 'Builds the front of your upper arms.',
  triceps: 'Builds the back of your upper arms; helps every pressing move.',
  core: 'Strengthens your midsection to protect your back.',
  cardio: 'Heart and lung fitness. Keep it at a pace you can sustain.',
  finisher: 'A short burst to burn extra calories at the end.',
  shrug: 'Builds your upper traps.',
  forearm: 'Builds grip strength, which helps every pulling exercise.',
  adductor: 'Strengthens your inner thighs and hips.',
};
function loggerHelp(it, ex, i) {
  if (!isGuided()) return '';
  const why = SLOT_WHY[it.slot] || SLOT_WHY[ex.pattern] || '';
  // Show "How heavy?" once: on the first weighted exercise the user hasn't done before.
  const isNew = x => { const e = EX_BY_ID[x.exId]; return e.unit === 'reps' && e.req.length > 0 && !lastSessionFor(S, e.id); };
  const firstNew = S.activeWorkout ? S.activeWorkout.items.findIndex(isNew) : -1;
  const weighted = i === firstNew;
  return `<div class="tiny muted" style="display:flex;gap:10px;flex-wrap:wrap;align-items:baseline"><span>${esc(why)}</span>${weighted ? `<button class="link small" data-act="open-guide" data-id="start-weight">How heavy should I go?</button>` : ''}</div>`;
}

/* ---------- guides ---------- */
const GUIDES = [
  { id: 'start-weight', cat: 'Training', title: 'How heavy should I go?', mins: 2, body: [
    ['Start lighter than you think', 'Pick a weight you could lift for 2–3 more reps than the plan asks for. If the plan says 8–12 reps, choose something you could do about 14 times.'],
    ['Use the first set to test', 'If the first set felt easy, go up a little for the next one. If your form broke down, go lighter. Groundwork remembers what you did.'],
    ['Then let the app guide you', 'Once you hit the top of the rep range on every set, the logger suggests adding a small amount of weight next time. That\'s the whole system.'],
    ['Signs it\'s too heavy', 'Your back rounds, you bounce or swing, or the last reps are a grind with ugly form. Drop the weight; good reps build more muscle than bad ones.'],
  ] },
  { id: 'warmup', cat: 'Training', title: 'Warming up', mins: 2, body: [
    ['5 minutes of easy movement', 'A brisk walk, bike or rower. You want to feel warm, not tired.'],
    ['Ramp up on your first exercise', 'Do 1–2 light sets before your working weight: about half the weight for 8 reps, then about three-quarters for 4 reps.'],
    ['Later exercises', 'The rest of the workout usually needs no extra warm-up; your body is already warm.'],
  ] },
  { id: 'reps-sets', cat: 'Training', title: 'Sets, reps and rest explained', mins: 2, body: [
    ['Reps', 'One rep is one full movement: down and back up. "8–12 reps" means do at least 8 and stop at 12.'],
    ['Sets', 'A set is a group of reps done back to back. "3 sets" means do your reps, rest, and repeat three times.'],
    ['Rest', 'Rest between sets lets you recover. Big lifts get 2–3 minutes, smaller ones about 1 minute. The timer starts on its own when you tick a set.'],
    ['How hard?', 'Most sets should end with 1–3 reps left in the tank: hard, but with clean form.'],
  ] },
  { id: 'first-gym', cat: 'Getting started', title: 'Your first gym visit', mins: 3, body: [
    ['Before you go', 'Open today\'s workout and watch the demos so you know what to look for. Bring water and a small towel.'],
    ['Finding equipment', 'Free weights are usually in one area, machines in another. Staff are happy to show you where things are; asking is normal.'],
    ['Etiquette', 'Wipe down benches and machines after use, put weights back where they belong, and if someone\'s using what you need, ask "how many sets do you have left?" or work in.'],
    ['Nobody is watching you', 'Everyone started somewhere and most people are focused on their own workout.'],
  ] },
  { id: 'machines', cat: 'Getting started', title: 'Using machines and cables', mins: 2, body: [
    ['Adjust the seat first', 'Most machines have a seat or pad adjustment. Line the machine\'s pivot (usually a colored dot) up with the joint that moves, like your knee for leg extensions.'],
    ['Pick the weight with the pin', 'Slide the pin fully into the weight stack. Start near the top of the stack and work down.'],
    ['Cables', 'Clip the handle you need to the pulley, set the pulley height, then pick your weight. Move slowly both ways; don\'t let the stack slam.'],
  ] },
  { id: 'progress', cat: 'Training', title: 'How your plan gets you stronger', mins: 3, body: [
    ['Add reps, then weight', 'Each exercise has a rep range. Add a rep or two each week; when you reach the top of the range on every set, add a little weight and start again at the bottom.'],
    ['Training cycles', 'Your plan runs in cycles of 6–8 weeks. The last week is an easy week with fewer, lighter sets so your body can catch up.'],
    ['New cycle, fresh exercises', 'When a cycle ends, your main lifts stay and some smaller exercises change to keep things fresh.'],
  ] },
  { id: 'recovery', cat: 'Training', title: 'Sleep, soreness and rest days', mins: 2, body: [
    ['Soreness is normal at first', 'Muscles often feel sore 1–2 days after a new workout. Light movement like walking helps. It fades within a few weeks.'],
    ['Sleep is training', 'Aim for 7–9 hours. Strength and muscle are built while you recover.'],
    ['Pain is different', 'Sharp, pinching or joint pain is a sign to stop that exercise. Swap it for another one, and see a professional if it doesn\'t go away.'],
  ] },
  { id: 'calories', cat: 'Nutrition', title: 'Calories and protein, simply', mins: 3, body: [
    ['Calories control weight', 'Eat fewer calories than you burn (a deficit) and you lose weight. Eat more (a surplus) and you gain. Your daily target already accounts for your goal.'],
    ['Protein protects muscle', 'Protein helps you build muscle and keep it while losing fat. It also keeps you full. Your protein target is the second number to watch.'],
    ['Carbs and fat', 'They matter less for beginners. Hit calories and protein most days and the rest tends to sort itself out.'],
    ['Weekly check-ins', 'Each week Groundwork compares your weight trend with your goal and nudges your calories up or down if needed.'],
  ] },
  { id: 'protein', cat: 'Nutrition', title: 'Easy ways to get protein', mins: 2, body: [
    ['Build meals around it', 'Start each meal by choosing a protein: chicken, fish, eggs, Greek yogurt, cottage cheese, tofu, beans or lean beef.'],
    ['Handy options', 'Greek yogurt cups, string cheese, tuna packets, jerky, protein shakes and hard-boiled eggs are quick wins.'],
    ['Spread it out', 'Getting some at every meal is easier than one huge serving at dinner.'],
  ] },
  { id: 'portions', cat: 'Nutrition', title: 'Portions without a scale', mins: 2, body: [
    ['Use your hand', 'A palm-sized portion of protein, a fist of vegetables, a cupped hand of carbs (rice, pasta, potatoes, fruit), and a thumb of fats (oil, butter, nut butter).'],
    ['Per meal', 'Most men start with two of each per meal; most women with one of each. Adjust based on your weight trend.'],
    ['Logging it', 'Pick the closest serving size when you log. A reasonable estimate every day beats a perfect log once a week.'],
  ] },
  { id: 'logging', cat: 'Nutrition', title: 'Logging food the easy way', mins: 2, body: [
    ['Log as you go', 'Logging right after you eat takes seconds; trying to remember at night is harder.'],
    ['Use shortcuts', 'Recent foods appear first. Scan barcodes on packaged food. Use Quick add when you only know the calories.'],
    ['Eating out', 'Pick the closest match and move on. Close enough is fine.'],
  ] },
];
const GUIDE_BY_ID = Object.fromEntries(GUIDES.map(g => [g.id, g]));
function guideRow(g) {
  const read = ensureGuide().done['g_' + g.id];
  return `<button class="li" data-act="open-guide" data-id="${g.id}"><span class="ni" style="width:36px;height:36px;border-radius:10px;display:grid;place-items:center;background:var(--surface-2);color:var(--train);flex:none">${icon('book', 18)}</span><span class="grow"><span class="t">${esc(g.title)}</span><br><span class="d">${g.cat} · ${g.mins} min read${read ? ' · Read' : ''}</span></span><span class="chev">${icon('chevR', 18)}</span></button>`;
}

Object.assign(SHEETS, {
  guides() {
    const cats = [...new Set(GUIDES.map(g => g.cat))];
    return sheetHead('Guides', 'Short reads to help you get started')
      + cats.map(c => `<span class="label">${c}</span><div class="list">${GUIDES.filter(g => g.cat === c).map(guideRow).join('')}</div>`).join('');
  },
  guide(s) {
    const g = GUIDE_BY_ID[s.id];
    return sheetHead(esc(g.title), `${g.cat} · ${g.mins} min read`)
      + g.body.map(([h, p]) => `<div class="stack" style="gap:4px"><div class="h3">${esc(h)}</div><p class="muted" style="margin:0">${esc(p)}</p></div>`).join('')
      + `<button class="btn train block" data-act="close-sheet">Got it</button>`;
  },
});

Object.assign(ACT, {
  'tip-ok': t => { ensureGuide().tips[t.dataset.id] = true; save(); render(); },
  'toggle-macros': () => { UI.showMacros = !UI.showMacros; render(); },
  'fw-hide': () => { ensureGuide().fwHidden = true; save(); render(); },
  'open-guides': () => { pushSheet({ type: 'guides', tall: true }); },
  'open-guide': t => { const g = ensureGuide(); g.done['g_' + t.dataset.id] = todayKey(); g.done.guide = g.done.guide || todayKey(); save(); pushSheet({ type: 'guide', id: t.dataset.id, tall: true }); },
  'set-mode': t => { S.mode = t.dataset.v; save(); if (UI.sheet && UI.sheet.type !== 'settings') closeAll(); else render(); toast(`${MODES[S.mode].label} view on`); },
  'mode-later': () => { ensureGuide().nudge = 'no'; save(); render(); },
  'tips-reset': () => { const g = ensureGuide(); g.tips = {}; g.fwHidden = false; save(); render(); toast('Tips will show again'); },
});
/* Track first-week steps from existing actions. */
(() => {
  const wrap = (name, key) => { const orig = ACT[name]; if (orig) ACT[name] = t => { if (S.onboarded) markGuide(key); return orig(t); }; };
  wrap('open-ex', 'demo');
  const tab = ACT.tab; ACT.tab = t => { if (S.onboarded && t.dataset.id === 'train') markGuide('plan'); return tab(t); };
  wrap('tab-train', 'plan');
})();
