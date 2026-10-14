/* Groundwork — meal plan generator, grocery list and store hand-off.
   Plans 7 days from the built-in recipe library (plus any connected recipe service), scaling
   servings so each day lands near the user's calorie and protein targets. */

/* Optional services. Leave blank to use links only; see server/README.md to switch them on. */
const SERVICE_CONFIG = {
  // URL of your server function that creates an Instacart shopping-list page (server/instacart-function.js)
  instacartEndpoint: '',
  // URL of your server function that searches a recipe service such as Spoonacular (server/recipes-function.js)
  recipeEndpoint: '',
};

const DIETS = [
  ['vegetarian', 'Vegetarian'], ['pescatarian', 'Pescatarian'], ['dairyfree', 'Dairy-free'], ['glutenfree', 'Gluten-free'],
];
const AVOID_OPTIONS = [
  ['e', 'Eggs'], ['n', 'Nuts & peanuts'], ['s', 'Soy'], ['h', 'Shellfish'], ['f', 'Fish'], ['p', 'Pork'], ['b', 'Beef'], ['d', 'Dairy'],
];
const MEAL_SLOTS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', meal4: 'Fourth meal', snack: 'Snack' };

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
  const prefs = state.mealPrefs || defaultMealPrefs();
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
      if (!cands.length) cands = candidatesFor(slot, { ...prefs, quick: false, avoidText: '' }, extra);
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
  const plan = state.mealPlan, prefs = state.mealPrefs || defaultMealPrefs();
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
    r.ingredients.forEach(([k, q]) => { totals[k] = (totals[k] || 0) + q * m.servings; });
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

async function sendToInstacart(list, title) {
  if (!SERVICE_CONFIG.instacartEndpoint) throw new Error('not-configured');
  const line_items = list.map(i => ({ name: i.q || i.name, display_text: i.name, quantity: Math.max(1, Math.round(i.qty * 100) / 100), unit: i.unit || 'each' }));
  const res = await fetch(SERVICE_CONFIG.instacartEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, line_items }) });
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
