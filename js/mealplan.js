/* Movla — meal plan generator, grocery list and store hand-off.
   Plans 7 days from the built-in recipe library (plus any connected recipe service), scaling
   servings so each day lands near the user's calorie and protein targets. */

/* Optional services. Leave blank to use links only; see server/README.md to switch them on. */
const SERVICE_CONFIG = {
  // Instacart shopping-list pages come from the Supabase Edge Function server/supabase/functions/instacart-list,
  // which holds the Instacart Developer Platform key (secret INSTACART_API_KEY). The "Send whole list to Instacart"
  // button appears once that key is set. instacartEndpoint overrides the URL if you host the function elsewhere.
  instacartFunction: 'instacart-list',
  instacartEndpoint: '',
  // Affiliate tracking for the per-item store links. Paste the tracking link template from the store's affiliate
  // program (Walmart and Instacart both use Impact) with {url} where the product or search page goes, e.g.
  //   walmart: 'https://goto.walmart.com/c/1234567/123456/9383?u={url}'
  // Leave blank for plain links.
  storeAffiliates: { walmart: '', instacart: '', kroger: '', amazon: '' },
  // URL of your server function that searches a recipe service such as Spoonacular (server/recipes-function.js)
  recipeEndpoint: '',
  // USDA FoodData Central search. The project's key is private: it lives only in the Supabase Edge Function
  // server/supabase/functions/food-search (secret USDA_API_KEY), which the app calls when accounts are set up.
  // Without it (or if the function is down) the app falls back to USDA's shared public DEMO_KEY.
  usdaFunction: 'food-search',
};

const DIETS = [
  ['vegetarian', 'Vegetarian'], ['pescatarian', 'Pescatarian'], ['dairyfree', 'Dairy-free'], ['glutenfree', 'Gluten-free'],
];
const AVOID_OPTIONS = [
  ['e', 'Eggs'], ['n', 'Nuts & peanuts'], ['s', 'Soy'], ['h', 'Shellfish'], ['f', 'Fish'], ['p', 'Pork'], ['b', 'Beef'], ['d', 'Dairy'],
];
const MEAL_SLOTS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', meal4: 'Fourth meal', snack: 'Snack' };

/* ---------- household ----------
   Family members share the same recipes; each gets a portion sized to their own calorie needs.
   Default calories are typical daily needs (U.S. Dietary Guidelines, moderately active), editable per person. */
const HOUSEHOLD_GROUPS = [['adult_m', 'Adult (man)', 2400], ['adult_f', 'Adult (woman)', 1900], ['child', 'Child or teen (under 18)', null]];

/* Children and teens: estimated calories per day from the Dietary Guidelines for Americans 2020–2025
   (Appendix 2), by age, sex and activity: [less active, moderately active, active].
   Age 1 uses the guidelines' 12–23 month range (about 700–1,000 kcal). */
const KID_KCAL = {
  girl: { 1: [800, 900, 1000], 2: [1000, 1000, 1000], 3: [1000, 1200, 1400], 4: [1200, 1400, 1400], 5: [1200, 1400, 1600], 6: [1200, 1400, 1600], 7: [1200, 1600, 1800], 8: [1400, 1600, 1800], 9: [1400, 1600, 1800], 10: [1400, 1800, 2000], 11: [1600, 1800, 2000], 12: [1600, 2000, 2200], 13: [1600, 2000, 2200], 14: [1800, 2000, 2400], 15: [1800, 2000, 2400], 16: [1800, 2000, 2400], 17: [1800, 2000, 2400] },
  boy: { 1: [800, 900, 1000], 2: [1000, 1000, 1000], 3: [1000, 1400, 1400], 4: [1200, 1400, 1600], 5: [1200, 1400, 1600], 6: [1400, 1600, 1800], 7: [1400, 1600, 1800], 8: [1400, 1600, 2000], 9: [1600, 1800, 2000], 10: [1600, 1800, 2200], 11: [1800, 2000, 2200], 12: [1800, 2200, 2400], 13: [2000, 2200, 2600], 14: [2000, 2400, 2800], 15: [2200, 2600, 3000], 16: [2400, 2800, 3200], 17: [2400, 2800, 3200] },
};
const KID_ACTIVITY = [['low', 'Less active', 'Mostly sitting, little active play'], ['mod', 'Moderately active', 'Regular play or some sport'], ['high', 'Very active', 'Daily sport or lots of running around']];
const KID_ADJUST_LIMIT = 0.2; // adjustments up to ±20% of the recommendation; bigger changes are a pediatrician conversation
function kidRecommended(m) {
  const age = Math.min(17, Math.max(1, Math.round(m.age || 8)));
  const i = { low: 0, mod: 1, high: 2 }[m.activity] ?? 1;
  const g = KID_KCAL.girl[age][i], b = KID_KCAL.boy[age][i];
  return m.sex === 'girl' ? g : m.sex === 'boy' ? b : Math.round((g + b) / 2 / 50) * 50;
}
function kidAdjustBounds(rec) { const lim = Math.round(rec * KID_ADJUST_LIMIT / 50) * 50; return [-lim, lim]; }
function memberKcal(m) {
  if (m.group !== 'child') return m.kcal || 2000;
  const rec = kidRecommended(m), [lo, hi] = kidAdjustBounds(rec);
  return rec + Math.min(hi, Math.max(lo, m.adjust || 0));
}
/* Members saved by earlier versions used fixed age groups; convert them to the age-based model. */
function migrateMember(m) {
  const legacy = { teen: 15, child_9: 11, child_4: 6, toddler: 2 };
  if (legacy[m.group]) return { ...m, group: 'child', age: legacy[m.group], sex: m.sex || 'any', activity: m.activity || 'mod', adjust: 0 };
  return m;
}
function household(state) { return (state.household || []).map(migrateMember); }
/* Restrictions for shared meals: your own preferences plus every family member's foods to avoid. */
function effectivePrefs(state, prefs) {
  const p = Object.assign(defaultMealPrefs(), prefs || state.mealPrefs || {});
  const flags = new Set(p.avoidFlags || []);
  const words = [p.avoidText || ''];
  household(state).forEach(m => { (m.avoid || []).forEach(f => flags.add(f)); if (m.avoidText) words.push(m.avoidText); });
  return { ...p, avoidFlags: [...flags], avoidText: words.filter(Boolean).join(', ') };
}
function slotShareFor(state, slot) {
  const prefs = state.mealPrefs || defaultMealPrefs();
  const slots = slotList(prefs), shares = slotShares(slots);
  const i = slots.indexOf(slot);
  return i < 0 ? 0.3 : shares[i];
}
function memberPortion(state, member, meal) {
  if (!(member.meals || []).includes(meal.slot)) return 0;
  const r = findRecipe(meal.recipeId, state.extraRecipes); if (!r || !r.kcal) return 0;
  const raw = (memberKcal(member) * slotShareFor(state, meal.slot)) / r.kcal;
  return Math.min(3, Math.max(0.25, Math.round(raw * 4) / 4));
}
function familyServings(state, meal) { return household(state).reduce((s, m) => s + memberPortion(state, m, meal), 0); }
function totalServings(state, meal) { return meal.servings + familyServings(state, meal); }
function householdCost(state, days) {
  return (days || (state.mealPlan ? state.mealPlan.days : [])).reduce((s, d) => s + d.meals.reduce((t, m) => { const r = findRecipe(m.recipeId, state.extraRecipes); return t + (r ? r.cost * totalServings(state, m) : 0); }, 0), 0);
}
/* After household restrictions change, replace only the planned meals that now conflict. */
function replaceConflicts(state) {
  if (!state.mealPlan) return 0;
  const prefs = effectivePrefs(state);
  let n = 0;
  state.mealPlan.days.forEach((d, di) => d.meals.forEach((m, mi) => {
    const r = findRecipe(m.recipeId, state.extraRecipes);
    if (r && !recipeAllowed(r, prefs)) {
      const opt = swapOptions(state, di, mi)[0];
      if (opt) { d.meals[mi] = { slot: m.slot, recipeId: opt.r.id, servings: opt.s }; n++; }
    }
  }));
  return n;
}

function defaultMealPrefs() {
  return { diets: [], avoidFlags: [], avoidText: '', meals: 3, snacks: 1, quick: false, batch: true, budget: false };
}

function recipeAllowed(r, prefs) {
  const fl = r.flags;
  const d = prefs.diets || [];
  if (d.includes('vegetarian') && /[mfhpb]/.test(fl)) return false;
  if (d.includes('pescatarian') && /[mpb]/.test(fl)) return false;
  if (d.includes('dairyfree') && fl.includes('d')) return false;
  if (d.includes('glutenfree') && fl.includes('g')) return false;
  if ((prefs.avoidFlags || []).some(a => fl.includes(a))) return false;
  const words = (prefs.avoidText || '').toLowerCase().split(/[,;]+/).map(w => w.trim()).filter(w => w.length > 2);
  if (words.length) {
    const hay = (r.name + ' ' + r.ingredients.map(([k]) => INGR[k] ? INGR[k].name : k).join(' ')).toLowerCase();
    if (words.some(w => hay.includes(w))) return false;
  }
  return true;
}

function slotList(prefs) {
  const base = { 2: ['lunch', 'dinner'], 3: ['breakfast', 'lunch', 'dinner'], 4: ['breakfast', 'lunch', 'dinner', 'meal4'] }[prefs.meals] || ['breakfast', 'lunch', 'dinner'];
  return base.concat([...Array(prefs.snacks || 0)].map(() => 'snack'));
}
function slotShares(slots) {
  const w = { breakfast: 0.25, lunch: 0.32, dinner: 0.38, meal4: 0.22, snack: 0.1 };
  const tot = slots.reduce((s, x) => s + w[x], 0);
  return slots.map(x => w[x] / tot);
}
const mealTypeFor = slot => slot === 'meal4' ? 'lunch' : slot;

// small seeded random so "New plan" gives a fresh but reproducible mix
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const SERVING_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function fitServings(r, kcalTarget) {
  let best = 1, bestErr = Infinity;
  SERVING_STEPS.forEach(s => { const e = Math.abs(r.kcal * s - kcalTarget); if (e < bestErr) { bestErr = e; best = s; } });
  return best;
}
function scoreRecipe(r, kcalT, protT, ctx) {
  const s = fitServings(r, kcalT);
  let score = Math.abs(r.kcal * s - kcalT) / Math.max(kcalT, 1);
  score += Math.max(0, protT - r.p * s) / Math.max(protT, 1) * 0.8;
  if (ctx.usedToday.has(r.id)) score += 5;
  if (ctx.recent.has(r.id)) score += 1.2;
  if (ctx.prefs.budget) score += r.cost * s * 0.18;
  if (ctx.prefs.quick && r.minutes > 20) score += 3;
  score += ctx.rand() * 0.35;
  return { r, s, score };
}

function candidatesFor(slot, prefs, extra) {
  const type = mealTypeFor(slot);
  return allRecipes(extra).filter(r => r.meals.includes(type) && recipeAllowed(r, prefs));
}
function allRecipes(extra) { return RECIPES.concat(extra || []); }

function generateMealPlan(state, opts) {
  opts = opts || {};
  const prefs = effectivePrefs(state);
  const T = calcTargets(state);
  const slots = slotList(prefs), shares = slotShares(slots);
  const seed = opts.seed || Math.floor(Math.random() * 1e9);
  const rand = rng(seed);
  const start = opts.start || todayKey();
  const old = opts.keepLocked && state.mealPlan ? state.mealPlan : null;
  const extra = state.extraRecipes || [];
  const days = [];
  const history = [];
  for (let d = 0; d < 7; d++) {
    const date = addDays(start, d);
    const oldDay = old && old.days.find(x => x.date === date);
    const usedToday = new Set();
    const recent = new Set(history.slice(-2).flat());
    const meals = [];
    slots.forEach((slot, i) => {
      const locked = oldDay && oldDay.meals.find((m, j) => m.slot === slot && m.locked && j === i);
      if (locked) { meals.push({ ...locked }); usedToday.add(locked.recipeId); return; }
      const kcalT = T.calories * shares[i], protT = T.protein * shares[i];
      // Batch prep: tonight's dinner becomes tomorrow's lunch
      if (prefs.batch && slot === 'lunch' && d > 0) {
        const prevDinner = days[d - 1].meals.find(m => m.slot === 'dinner');
        const pr = prevDinner && findRecipe(prevDinner.recipeId, extra);
        if (pr && pr.batch && pr.meals.includes('lunch') && !usedToday.has(pr.id)) {
          meals.push({ slot, recipeId: pr.id, servings: fitServings(pr, kcalT), leftover: true });
          usedToday.add(pr.id); return;
        }
      }
      let cands = candidatesFor(slot, prefs, extra);
      if (!cands.length) cands = candidatesFor(slot, { ...prefs, quick: false }, extra);
      if (!cands.length) return;
      const ranked = cands.map(r => scoreRecipe(r, kcalT, protT, { usedToday, recent, prefs, rand })).sort((a, b) => a.score - b.score);
      const pick = ranked[0];
      meals.push({ slot, recipeId: pick.r.id, servings: pick.s });
      usedToday.add(pick.r.id);
    });
    history.push([...usedToday]);
    days.push({ date, meals });
  }
  return { created: todayKey(), start, seed, days, targetKcal: T.calories, targetProtein: T.protein };
}

function findRecipe(id, extra) { return RECIPE_BY_ID[id] || (extra || []).find(r => r.id === id) || null; }
function mealMacros(m, extra) {
  const r = findRecipe(m.recipeId, extra);
  if (!r) return { kcal: 0, p: 0, c: 0, f: 0, cost: 0 };
  return { kcal: r.kcal * m.servings, p: r.p * m.servings, c: r.c * m.servings, f: r.f * m.servings, cost: r.cost * m.servings };
}
function dayTotals(day, extra) {
  return day.meals.reduce((t, m) => { const x = mealMacros(m, extra); return { kcal: t.kcal + x.kcal, p: t.p + x.p, c: t.c + x.c, f: t.f + x.f, cost: t.cost + x.cost }; }, { kcal: 0, p: 0, c: 0, f: 0, cost: 0 });
}
function swapOptions(state, dayIdx, mealIdx) {
  const plan = state.mealPlan, prefs = effectivePrefs(state);
  const day = plan.days[dayIdx], m = day.meals[mealIdx];
  const slots = day.meals.map(x => x.slot), shares = slotShares(slotList(prefs));
  const T = calcTargets(state);
  const share = shares[mealIdx] || 0.3;
  const usedToday = new Set(day.meals.map(x => x.recipeId));
  const ctx = { usedToday, recent: new Set(), prefs, rand: () => 0.5 };
  return candidatesFor(m.slot, prefs, state.extraRecipes)
    .filter(r => r.id !== m.recipeId)
    .map(r => scoreRecipe(r, T.calories * share, T.protein * share, ctx))
    .sort((a, b) => a.score - b.score);
}

/* ---------- grocery list ---------- */
function groceryList(state, fromDate) {
  const plan = state.mealPlan; if (!plan) return { items: [], cost: 0 };
  const extra = state.extraRecipes || [];
  const totals = {};
  plan.days.filter(d => !fromDate || d.date >= fromDate).forEach(d => d.meals.forEach(m => {
    const r = findRecipe(m.recipeId, extra); if (!r) return;
    const sv = totalServings(state, m);
    r.ingredients.forEach(([k, q]) => { totals[k] = (totals[k] || 0) + q * sv; });
  }));
  const items = Object.entries(totals).map(([k, qty]) => {
    const g = INGR[k] || { key: k, name: k, aisle: 'Other', unit: '', price: 0, q: k, pantry: false };
    return { key: k, name: g.name, aisle: g.aisle, qty, unit: g.unit, amount: shopAmount(g, qty), pantry: g.pantry, cost: g.price * qty, q: g.q };
  });
  (state.grocery && state.grocery.extra || []).forEach(x => items.push({ key: 'x_' + x.id, name: x.name, aisle: 'Added by you', amount: '', qty: 1, unit: '', pantry: false, cost: 0, q: x.name, custom: true, id: x.id }));
  const order = ['Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery', 'Grains & Pasta', 'Canned & Jarred', 'Frozen', 'Snacks', 'Protein & Supplements', 'Condiments & Spices', 'Added by you', 'Other'];
  items.sort((a, b) => (order.indexOf(a.aisle) - order.indexOf(b.aisle)) || a.name.localeCompare(b.name));
  return { items, cost: items.filter(i => !i.pantry).reduce((s, i) => s + i.cost, 0) };
}
function niceQty(x) {
  const whole = Math.floor(x + 1e-6), frac = x - whole;
  const fr = [[0, ''], [0.25, '¼'], [0.33, '⅓'], [0.5, '½'], [0.67, '⅔'], [0.75, '¾'], [1, '']];
  let best = fr[0]; fr.forEach(f => { if (Math.abs(frac - f[0]) < Math.abs(frac - best[0])) best = f; });
  const w = best[0] === 1 ? whole + 1 : whole;
  return (w ? String(w) : '') + best[1] || '0';
}
const PLURAL = { egg: 'eggs', slice: 'slices', link: 'links', can: 'cans', scoop: 'scoops', bar: 'bars', tortilla: 'tortillas', muffin: 'muffins', pita: 'pitas', cake: 'cakes', banana: 'bananas', apple: 'apples', orange: 'oranges', pepper: 'peppers', onion: 'onions', clove: 'cloves', tomato: 'tomatoes', cucumber: 'cucumbers', carrot: 'carrots', zucchini: 'zucchini', avocado: 'avocados', lemon: 'lemons', lime: 'limes', bunch: 'bunches', potato: 'potatoes', 'sweet potato': 'sweet potatoes', stick: 'sticks', cup: 'cups' };
function shopAmount(g, qty) {
  if (g.unit === 'oz') return qty >= 16 ? `${(Math.ceil(qty / 4) / 4).toFixed(2).replace(/\.?0+$/, '')} lb` : `${Math.ceil(qty)} oz`;
  const countable = !['cup', 'tbsp', 'tsp'].includes(g.unit);
  if (countable) { const n = Math.ceil(qty - 0.05); return `${n} ${n === 1 ? g.unit : (PLURAL[g.unit] || g.unit + 's')}`; }
  if (g.key === 'rice' || g.key === 'brown_rice' || g.key === 'quinoa') return `${niceQty(qty)} ${qty > 1.1 ? 'cups' : 'cup'} cooked (about ${niceQty(qty / 3)} cup dry)`;
  if (g.key === 'lentils') return `${niceQty(qty)} ${qty > 1.1 ? 'cups' : 'cup'} cooked (about ${niceQty(qty / 2.5)} cup dry)`;
  const u = g.unit === 'cup' ? (qty > 1 ? 'cups' : 'cup') : g.unit;
  return `${niceQty(qty)} ${u}`;
}

/* Store search links work everywhere with no account. Instacart's full-list hand-off needs SERVICE_CONFIG.instacartEndpoint. */
const STORES = [
  { id: 'instacart', name: 'Instacart', url: q => 'https://www.instacart.com/store/s?k=' + encodeURIComponent(q) },
  { id: 'walmart', name: 'Walmart', url: q => 'https://www.walmart.com/search?q=' + encodeURIComponent(q) },
  { id: 'kroger', name: 'Kroger', url: q => 'https://www.kroger.com/search?query=' + encodeURIComponent(q) },
  { id: 'amazon', name: 'Amazon Fresh', url: q => 'https://www.amazon.com/s?k=' + encodeURIComponent(q) + '&i=amazonfresh' },
];

function storeLink(store, q) {
  const url = store.url(q), t = (SERVICE_CONFIG.storeAffiliates || {})[store.id];
  return t && t.includes('{url}') ? t.replace('{url}', encodeURIComponent(url)) : url;
}
function instacartEndpoint() {
  if (SERVICE_CONFIG.instacartEndpoint) return SERVICE_CONFIG.instacartEndpoint;
  return typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG.url && SERVICE_CONFIG.instacartFunction ? `${CLOUD_CONFIG.url}/functions/v1/${SERVICE_CONFIG.instacartFunction}` : '';
}
const instacartHeaders = () => (typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG.anonKey ? { apikey: CLOUD_CONFIG.anonKey } : {});
/* Is whole-list ordering switched on? Asks the function once per session; re-renders when the answer arrives. */
let instacartState = null;   // null = not asked, 'asking', true, false
function instacartReady() {
  if (instacartState === null) {
    const ep = instacartEndpoint();
    if (!ep) { instacartState = false; return false; }
    instacartState = 'asking';
    fetch(ep, { headers: instacartHeaders(), signal: AbortSignal.timeout ? AbortSignal.timeout(6000) : undefined })
      .then(r => r.ok ? r.json() : { ready: false }).then(d => { instacartState = !!(d && d.ready); }, () => { instacartState = false; })
      .then(() => { if (instacartState) render(); });
  }
  return instacartState === true;
}

async function sendToInstacart(list, title) {
  const ep = instacartEndpoint();
  if (!ep) throw new Error('not-configured');
  const line_items = list.map(i => ({ name: i.q || i.name, display_text: i.name, quantity: Math.max(1, Math.round(i.qty * 100) / 100), unit: i.unit || 'each' }));
  const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', ...instacartHeaders() }, body: JSON.stringify({ title, line_items }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (!data.url) throw new Error('no-url');
  return data.url;
}

/* Optional recipe service (e.g. Spoonacular) through your own server function. Returns recipes in the
   same shape as the built-in library so the planner can use them. */
async function searchRecipeService(query, prefs) {
  if (!SERVICE_CONFIG.recipeEndpoint) throw new Error('not-configured');
  const res = await fetch(SERVICE_CONFIG.recipeEndpoint + '?q=' + encodeURIComponent(query) + '&diets=' + encodeURIComponent((prefs.diets || []).join(',')));
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return (data.recipes || []).map(r => ({ ...r, source: r.source || 'Recipe service', ingredients: r.ingredients || [], steps: r.steps || [], flags: r.flags || '', meals: r.meals || ['lunch', 'dinner'] }));
}
