// Takes the app-store screenshots from the built app in www/ (run after `npm run build:web`,
// so the bundled fonts are used). Output: store/out/{play,ios}/NN-name.png and the Play feature graphic.
// Usage: node store/shoot.js
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..');
const page = 'file://' + path.join(root, 'www', 'index.html');
const SIZES = {
  play: { width: 390, height: 693, scale: 1080 / 390 },   // 1080 × 1920
  ios: { width: 440, height: 956, scale: 3 },             // 1320 × 2868 (6.9-inch iPhone)
};
const SHOTS = [
  ['01-today', async p => { await p.evaluate(() => { UI.tab = 'today'; render(); }); }],
  ['02-plan', async p => { await p.evaluate(() => { UI.tab = 'train'; UI.trainSeg = 'plan'; render(); }); }],
  ['03-demo', async p => { await p.evaluate(() => { UI.tab = 'train'; UI.trainSeg = 'lib'; render(); pushSheet({ type: 'exercise', id: 'goblet_squat', key: 'goblet_squat', ctx: null }); }); await p.waitForTimeout(1300); }],
  ['04-logger', async p => { await p.evaluate(() => {
    UI.sheet = null; UI.stack = [];
    const w = workoutForDate(S, todayKey()) || S.plan.workouts[0];
    startWorkout(w.id);
    const it = S.activeWorkout.items[0]; const sug = suggestion(S, it);
    it.rows.slice(0, 2).forEach(r => { r.weightKg = r.weightKg || sug.weightKg || 40; r.reps = r.reps || it.max; r.done = true; });
    UI.rest = null; render();
  }); }],
  ['05-meals', async p => { await p.evaluate(() => { S.activeWorkout = null; UI.loggerOpen = false; UI.tab = 'food'; UI.foodSeg = 'plan'; if (!S.mealPlan) rebuildMealPlan(false); render(); }); }],
  ['06-programs', async p => { await p.evaluate(() => { UI.tab = 'train'; UI.trainSeg = 'plan'; render(); ACT['open-programs'](); }); await p.waitForTimeout(700); }],
  ['07-progress', async p => { await p.evaluate(() => { closeAll(); UI.tab = 'progress'; render(); }); }],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, sz] of Object.entries(SIZES)) {
    const dir = path.join(__dirname, 'out', name); fs.mkdirSync(dir, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: sz.scale, colorScheme: 'light' });
    const p = await ctx.newPage();
    await p.clock.install({ time: new Date('2026-10-16T09:30:00') });
    await p.goto(page); await p.waitForTimeout(500);
    await p.evaluate(() => { seedDemo(); S.demo = false; S.mode = 'standard'; S.dismissed = {}; save(); UI.toast = null; render(); });
    await p.evaluate(() => { for (const id of ['workout', 'weighin', 'meals', 'protein', 'missed', 'checkin', 'over']) S.dismissed[id] = todayKey(); save(); });
    for (const [shot, fn] of SHOTS) {
      await fn(p); await p.waitForTimeout(500);
      await p.evaluate(() => { UI.toast = null; const t = document.querySelector('.toast'); if (t) t.remove(); window.scrollTo(0, 0); });
      await p.screenshot({ path: path.join(dir, shot + '.png') });
    }
    await ctx.close();
  }
  // Google Play feature graphic, 1024 × 500.
  const ctx = await b.newContext({ viewport: { width: 1024, height: 500 } });
  const p = await ctx.newPage();
  await p.goto('file://' + path.join(__dirname, 'feature.html')); await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(__dirname, 'out', 'play-feature-graphic.png') });
  await b.close();
  console.log('Screenshots written to store/out');
})();
