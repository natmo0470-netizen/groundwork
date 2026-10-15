/* Movla — My meals: build a meal from ingredients for meal prep and home cooking.
   Pick ingredients from the built-in foods, the grocery ingredient catalog, your own foods or the
   online databases; enter amounts in grams, ounces, cups, spoons or servings; set how many servings
   the batch makes (and optionally the cooked weight). Calories and macros are totalled for the
   batch and per serving, and the meal can be logged like any food.
   Meals: S.myMeals = [{ id, name, portions, cookedG, notes, items: [{ id, name, serving, kcal, p, c, f, source, amount, unit, mult }], updatedAt }] */

/* ---------- amounts and units ---------- */
const MASS_G = { g: 1, oz: 28.3495, lb: 453.592, kg: 1000 };
const VOL_ML = { ml: 1, tsp: 4.929, tbsp: 14.787, 'fl oz': 29.574, cup: 236.59, l: 1000 };
const UNIT_ALIASES = { gram: 'g', grams: 'g', gr: 'g', ounce: 'oz', ounces: 'oz', pound: 'lb', pounds: 'lb', lbs: 'lb', kilogram: 'kg', kilograms: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', ml: 'ml', liter: 'l', litre: 'l', liters: 'l', cups: 'cup', c: 'cup', tablespoon: 'tbsp', tablespoons: 'tbsp', tbs: 'tbsp', tbl: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', 'fl. oz': 'fl oz', floz: 'fl oz' };
function parseQty(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d+)\s+(\d+)\/(\d+)/); if (m) return { n: +m[1] + m[2] / m[3], len: m[0].length };
  m = s.match(/^(\d+)\/(\d+)/); if (m) return { n: m[1] / m[2], len: m[0].length };
  m = s.match(/^(\d*\.?\d+)/); if (m) return { n: parseFloat(m[1]), len: m[0].length };
  return { n: 1, len: 0 };
}
/* "4 oz" → {qty:4, unit:'oz'}; "2 tbsp (32 g)" → {qty:2, unit:'tbsp', grams:32}; "1 large" → {qty:1, unit:'large'} */
function parseServing(serving) {
  const s = String(serving || '').toLowerCase();
  const q = parseQty(s), rest = s.slice(q.len).trim();
  let unit = null;
  const fl = rest.match(/^fl\.?\s*oz\b/);
  if (fl) unit = 'fl oz';
  else { const w = (rest.match(/^[a-z]+/) || [''])[0]; unit = UNIT_ALIASES[w] || w || null; }
  const gm = s.match(/(\d*\.?\d+)\s*(g|grams?)\b(?!\w)/), mlm = s.match(/(\d*\.?\d+)\s*ml\b/);
  const out = { qty: q.n || 1, unit };
  if (MASS_G[unit]) out.grams = out.qty * MASS_G[unit];
  else if (gm) out.grams = parseFloat(gm[1]);
  if (VOL_ML[unit]) out.ml = out.qty * VOL_ML[unit];
  else if (mlm) out.ml = parseFloat(mlm[1]);
  return out;
}
/* Units a person can enter for this food, best first. */
function unitOptions(f) {
  const b = parseServing(f.serving), opts = [];
  if (b.grams) opts.push('g', 'oz');
  if (b.grams && b.grams >= 200) opts.push('lb');
  if (b.ml) opts.push(...['cup', 'tbsp', 'tsp', 'ml'].filter(u => !opts.includes(u)));
  if (b.unit && !MASS_G[b.unit] && !VOL_ML[b.unit] && /^[a-z]{2,12}$/.test(b.unit) && !['serving', 'servings', 'container', 'package', 'entry'].includes(b.unit)) opts.unshift(b.unit);
  opts.push('serving');
  return [...new Set(opts)];
}
function defaultAmount(f) {
  const b = parseServing(f.serving), u = unitOptions(f);
  if (b.unit && u.includes(b.unit)) return { amount: b.qty, unit: b.unit };
  return { amount: 1, unit: 'serving' };
}
/* How many of the food's servings this amount is. */
function servingsFor(f, amount, unit) {
  if (!(amount > 0)) return 0;
  if (unit === 'serving') return amount;
  const b = parseServing(f.serving);
  if (MASS_G[unit] && b.grams) return amount * MASS_G[unit] / b.grams;
  if (VOL_ML[unit] && b.ml) return amount * VOL_ML[unit] / b.ml;
  if (unit === b.unit) return amount / (b.qty || 1);
  return amount;
}
const fmtAmt = n => (Math.round(n * 100) / 100).toString();
function amountLabel(it) { return it.unit === 'serving' ? `${fmtAmt(it.amount)} × ${it.serving}` : `${fmtAmt(it.amount)} ${it.unit}`; }

/* ---------- totals ---------- */
function mealTotals(m) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  (m.items || []).forEach(it => { ['kcal', 'p', 'c', 'f'].forEach(k => { t[k] += (it[k] || 0) * it.mult; }); });
  return t;
}
function perServing(m) { const t = mealTotals(m), n = Math.max(1, m.portions || 1); return { kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n }; }
function portionGrams(m) { return m.cookedG > 0 ? m.cookedG / Math.max(1, m.portions || 1) : null; }
/* A saved meal as a loggable food: one serving = one portion. */
function mealAsFood(m) {
  const s = perServing(m), g = portionGrams(m);
  return { id: 'meal_' + m.id, mealId: m.id, name: m.name, serving: `1 serving${g ? ` (${Math.round(g)} g cooked)` : ''} · makes ${fmtAmt(m.portions)}`,
    kcal: Math.round(s.kcal), p: Math.round(s.p * 10) / 10, c: Math.round(s.c * 10) / 10, f: Math.round(s.f * 10) / 10, cat: 'My meals', source: 'My meal' };
}
const myMeals = () => (S.myMeals = S.myMeals || []);
const pcf = t => `<span class="pcf"><b class="p">P ${r0(t.p)}</b> <b class="c">C ${r0(t.c)}</b> <b class="f">F ${r0(t.f)}</b></span>`;

/* Ingredient search pool: grocery catalog (per oz / cup / each), built-in foods and your own foods. */
let _ingPool = null;
function ingredientPool() {
  if (!_ingPool) {
    const seen = new Set(), pool = [];
    const add = f => { const k = f.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); pool.push(f); } };
    if (typeof INGR !== 'undefined') Object.values(INGR).forEach(g => add({ id: 'ing_' + g.key, name: g.name, serving: `1 ${g.unit}`, kcal: g.kcal, p: g.p, c: g.c, f: g.f, cat: g.aisle, source: 'built-in' }));
    FOODS.filter(f => f.cat !== 'Meals').forEach(add);
    _ingPool = pool;
  }
  return (S.customFoods || []).concat(_ingPool);
}

/* ================= Nutrition tab: My meals ================= */
function viewMyMeals() {
  const list = myMeals().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return `<div class="card fuel"><div class="stack" style="gap:4px"><span class="h3">Build your own meals</span>
      <span class="small muted">Add the ingredients you cook with and how many servings it makes. You get calories and macros for the whole batch and for each serving, ready to log.</span></div>
      <button class="btn fuel" data-act="meal-new" style="align-self:flex-start">${icon('plus', 18)} Create a meal</button></div>
    ${list.length ? list.map(m => { const s = perServing(m), g = portionGrams(m);
      return `<div class="card meal-card"><button class="meal-open" data-act="meal-edit" data-id="${m.id}"><span class="row between" style="gap:8px"><span class="h3" style="min-width:0;overflow-wrap:anywhere">${esc(m.name)}</span><span class="kcal num">${fmtInt(s.kcal)}<span class="small faint"> kcal</span></span></span>
          <span class="small muted">Per serving · ${pcf(s)}${g ? ` · ${Math.round(g)} g` : ''}</span>
          <span class="tiny faint">${(m.items || []).length} ingredient${(m.items || []).length === 1 ? '' : 's'} · makes ${fmtAmt(m.portions)} serving${m.portions === 1 ? '' : 's'}</span></button>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn fuel sm" data-act="meal-log" data-id="${m.id}">${icon('plus', 16)} Log a serving</button><button class="btn ghost sm" data-act="meal-edit" data-id="${m.id}">Edit</button><button class="btn ghost sm" data-act="meal-dup" data-id="${m.id}">${icon('copy', 16)} Duplicate</button></div></div>`; }).join('')
      : `<div class="card"><div class="empty">${icon('fork', 28)}<span>No meals yet. Try your go-to meal prep: chicken, rice and broccoli for the week, or tonight's dinner.</span></div></div>`}`;
}

/* ================= sheets ================= */
Object.assign(SHEETS, {
  mealBuilder() {
    const m = UI.mb, t = mealTotals(m), n = Math.max(1, m.portions || 1), g = portionGrams(m);
    const per = { kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n };
    const cal = x => fmtInt(x);
    return sheetHead(m.existing ? 'Edit meal' : 'Create a meal', 'Add ingredients and we\'ll total it up')
      + `<div class="field"><label for="mb-name">Meal name</label><input class="input" id="mb-name" data-mb="name" placeholder="e.g. Chicken, rice and broccoli" value="${esc(m.name || '')}" maxlength="80"></div>
      <div class="field"><span class="label">Makes</span><div class="stepper"><button data-act="mb-portions" data-v="-1" aria-label="Fewer servings">−</button><input class="input big" id="mb-portions" data-mb="portions" inputmode="decimal" value="${fmtAmt(m.portions)}" aria-label="Servings this makes"><button data-act="mb-portions" data-v="1" aria-label="More servings">+</button></div><span class="tiny faint">servings. Meal prepping 5 lunches? Enter 5.</span></div>
      <div class="stack" style="gap:6px"><div class="row between"><span class="label">Ingredients</span>${m.items.length ? `<span class="small faint">${m.items.length}</span>` : ''}</div>
        ${m.items.length ? `<div class="list">${m.items.map((it, i) => `<div class="ing-row"><button class="grow ing-main" data-act="mb-ing-edit" data-i="${i}"><span class="t">${esc(it.name)}</span><br><span class="d">${esc(amountLabel(it))} · ${pcf({ p: it.p * it.mult, c: it.c * it.mult, f: it.f * it.mult })}</span></button><span class="kcal num">${cal(it.kcal * it.mult)}</span><button class="icon-btn sm" data-act="mb-ing-remove" data-i="${i}" aria-label="Remove ${esc(it.name)}">${icon('x', 16)}</button></div>`).join('')}</div>`
          : `<p class="small muted" style="margin:0">Add each ingredient with the amount you use: raw weights for meat and grains are most accurate.</p>`}
        <button class="btn ghost block" data-act="mb-add">${icon('plus', 18)} Add ingredient</button></div>
      <div class="card fuel mb-totals" id="mb-totals" style="box-shadow:none">${totalsHtml(t, per, n, g)}</div>
      <div class="field"><label for="mb-cooked">Cooked weight of the whole batch <span class="faint">(optional)</span></label><div class="input-suffix"><input class="input" id="mb-cooked" data-mb="cookedG" inputmode="decimal" placeholder="Weigh the pot or container, minus the dish" value="${m.cookedG ? fmtAmt(S.profile.units === 'metric' ? m.cookedG : m.cookedG / 28.3495) : ''}"><span>${S.profile.units === 'metric' ? 'g' : 'oz'}</span></div><span class="tiny faint">Lets us tell you how much to portion out per serving.</span></div>
      <div class="field"><label for="mb-notes">Notes <span class="faint">(optional)</span></label><textarea class="input" id="mb-notes" data-mb="notes" rows="2" placeholder="e.g. Bake chicken 425°F for 22 min">${esc(m.notes || '')}</textarea></div>
      <button class="btn fuel block" data-act="mb-save">${m.existing ? 'Save changes' : 'Save meal'}</button>
      <button class="btn ghost block" data-act="mb-save-log">Save and log a serving</button>
      ${m.existing ? `<button class="btn danger block" data-act="mb-delete">${icon('trash', 18)} Delete meal</button>` : ''}`;
  },
  ingPick(s) {
    return sheetHead('Add ingredient', `to ${esc(UI.mb.name || 'your meal')}`)
      + `<div class="input-suffix"><input class="input" id="ing-q" type="text" inputmode="search" enterkeyhint="search" placeholder="Search, e.g. chicken breast, rice, olive oil" value="${esc(s.q || '')}" autocomplete="off" aria-label="Search ingredients"><span>${icon('search', 18)}</span></div>
      <div class="row wrap"><button class="btn sm soft" data-act="ing-custom">${icon('plus', 16)} Enter nutrition yourself</button></div>
      <div id="ing-results">${ingResults(s)}</div>`;
  },
  ingAmount(s) {
    const f = s.food, opts = unitOptions(f), mult = servingsFor(f, s.amount, s.unit);
    return sheetHead(esc(f.name), `Nutrition per ${esc(f.serving)}${f.source && f.source !== 'built-in' ? ' · ' + esc(f.source) : ''}`)
      + `<div class="field"><label for="ing-amt">Amount</label><input class="input big" id="ing-amt" inputmode="decimal" value="${fmtAmt(s.amount)}" aria-label="Amount"></div>
      <div class="chips" role="group" aria-label="Unit">${opts.map(u => `<button class="chip" data-act="ing-unit" data-v="${esc(u)}" aria-pressed="${s.unit === u}">${u === 'serving' ? `× ${esc(f.serving)}` : esc(u)}</button>`).join('')}</div>
      <div class="card" style="box-shadow:none" id="ing-preview">${servPreview(f, mult)}</div>
      <button class="btn fuel block" data-act="ing-save">${s.index != null ? 'Update ingredient' : 'Add to meal'}</button>`;
  },
  ingCustom() {
    return sheetHead('Enter nutrition', 'From the package label, per serving')
      + `<div class="field"><label for="ic-name">Ingredient</label><input class="input" id="ic-name" placeholder="e.g. Homemade salsa"></div>
      <div class="field"><label for="ic-serv">Serving size</label><input class="input" id="ic-serv" placeholder="e.g. 2 tbsp (30 g)"></div>
      <div class="grid2"><div class="field"><label for="ic-kcal">Calories</label><input class="input" id="ic-kcal" inputmode="decimal"></div><div class="field"><label for="ic-p">Protein (g)</label><input class="input" id="ic-p" inputmode="decimal"></div><div class="field"><label for="ic-c">Carbs (g)</label><input class="input" id="ic-c" inputmode="decimal"></div><div class="field"><label for="ic-f">Fat (g)</label><input class="input" id="ic-f" inputmode="decimal"></div></div>
      <label class="toggle"><span class="small"><b>Save to My foods</b><br><span class="faint">So you can find it next time</span></span><input type="checkbox" id="ic-save" checked style="width:22px;height:22px"></label>
      <button class="btn fuel block" data-act="ing-custom-save">Next: amount</button>`;
  },
});
function totalsHtml(t, per, n, g) {
  const unitW = S.profile.units === 'metric' ? `${Math.round(g || 0)} g` : `${fmtAmt((g || 0) / 28.3495)} oz (${Math.round(g || 0)} g)`;
  return `<div class="mb-cols"><div><span class="eyebrow">Per serving</span><div class="mid-num">${fmtInt(per.kcal)}<span class="unit"> kcal</span></div>${pcf(per)}</div>
      <div><span class="eyebrow">Whole batch${n !== 1 ? ` · ${fmtAmt(n)} servings` : ''}</span><div class="mid-num" style="color:var(--ink-2)">${fmtInt(t.kcal)}<span class="unit"> kcal</span></div>${pcf(t)}</div></div>
    ${per.kcal ? `<div class="tiny muted">${['p', 'c', 'f'].map(k => `${{ p: 'Protein', c: 'Carbs', f: 'Fat' }[k]} ${Math.round(per[k] * (k === 'f' ? 9 : 4) / Math.max(1, per.kcal) * 100)}%`).join(' · ')} of calories</div>` : ''}
    ${g ? `<div class="banner" style="background:var(--surface)">${icon('scale', 18)}<span>Portion out about <b>${unitW}</b> cooked per serving.</span></div>` : ''}`;
}
function ingResults(s) {
  const q = (s.q || '').trim();
  const row = f => foodPick(f).replace('data-act="pick-food"', 'data-act="ing-pick"');
  if (!q) {
    const used = []; const seen = new Set();
    myMeals().forEach(m => (m.items || []).forEach(it => { if (!seen.has(it.name)) { seen.add(it.name); used.push({ id: 'used_' + used.length, name: it.name, serving: it.serving, kcal: it.kcal, p: it.p, c: it.c, f: it.f, source: it.source }); } }));
    const staples = ['chicken_breast', 'ground_turkey', 'salmon', 'egg', 'rice', 'brown_rice', 'oats', 'pasta', 'sweet_potato', 'broccoli', 'olive_oil', 'greek_yogurt'].map(k => INGR[k]).filter(Boolean)
      .map(g => ingredientPool().find(f => f.id === 'ing_' + g.key)).filter(Boolean);
    return (used.length ? `<span class="eyebrow">Used in your meals</span><div class="list">${used.slice(0, 10).map(row).join('')}</div>` : '')
      + `<span class="eyebrow" style="display:block;margin-top:10px">Common ingredients</span><div class="list">${staples.map(row).join('')}</div>`;
  }
  const local = searchLocalFoods(q, ingredientPool().filter(f => !FOODS.includes(f))).filter((f, i, a) => a.findIndex(x => x.name.toLowerCase() === f.name.toLowerCase()) === i);
  let out = local.length ? `<div class="list">${local.slice(0, 30).map(row).join('')}</div>` : `<p class="small muted">No match in the built-in list.</p>`;
  out += `<div class="divider" style="margin:10px 0"></div>`;
  if (s.loading) out += `<p class="small muted">Searching USDA and Open Food Facts…</p>`;
  else if (s.err) out += `<p class="small muted">${esc(s.err)}</p>`;
  else if (s.online && s.online.length && s.onlineQ === q) out += `<span class="eyebrow">Online · USDA and Open Food Facts</span><div class="list">${s.online.map(row).join('')}</div>`;
  else out += `<button class="btn sm ghost" data-act="ing-online">${icon('search', 16)} Search brands and more online</button>`;
  return out;
}
function refreshIng() { const el = document.getElementById('ing-results'); if (el && UI.sheet && UI.sheet.type === 'ingPick') el.innerHTML = ingResults(UI.sheet); }
function refreshMbTotals() {
  const el = document.getElementById('mb-totals'); if (!el || !UI.mb) return;
  const t = mealTotals(UI.mb), n = Math.max(1, UI.mb.portions || 1);
  el.innerHTML = totalsHtml(t, { kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n }, n, portionGrams(UI.mb));
}

/* ================= actions ================= */
function openBuilder(m) {
  UI.mb = m ? Object.assign(JSON.parse(JSON.stringify(m)), { existing: true }) : { id: uid(), name: '', portions: 1, cookedG: null, notes: '', items: [] };
  pushSheet({ type: 'mealBuilder', tall: true });
}
function saveMeal() {
  const m = UI.mb;
  if (!m.name || !m.name.trim()) { toast('Give your meal a name'); const el = document.getElementById('mb-name'); if (el) el.focus(); return null; }
  if (!m.items.length) { toast('Add at least one ingredient'); return null; }
  if (!(m.portions > 0)) m.portions = 1;
  const rec = { id: m.id, name: m.name.trim(), portions: m.portions, cookedG: m.cookedG > 0 ? m.cookedG : null, notes: (m.notes || '').trim(), items: m.items, updatedAt: Date.now() };
  const list = myMeals(), i = list.findIndex(x => x.id === rec.id);
  if (i >= 0) list[i] = rec; else list.unshift(rec);
  save();
  return rec;
}
Object.assign(ACT, {
  'meal-new': () => openBuilder(null),
  'meal-edit': t => { const m = myMeals().find(x => x.id === t.dataset.id); if (m) { if (UI.sheet && UI.sheet.type === 'serving') { UI.stack = []; UI.sheet = null; } openBuilder(m); } },
  'meal-dup': t => { const m = myMeals().find(x => x.id === t.dataset.id); if (!m) return; const c = JSON.parse(JSON.stringify(m)); c.id = uid(); c.name = m.name + ' (copy)'; c.updatedAt = Date.now(); myMeals().unshift(c); save(); render(); toast('Duplicated. Tap Edit to change it.'); },
  'meal-log': t => {
    const m = myMeals().find(x => x.id === t.dataset.id); if (!m) return;
    if (UI.tab !== 'food' || UI.foodSeg !== 'log') UI.foodDate = todayKey();
    UI.food.meal = mealForNow();
    pushSheet({ type: 'serving', food: mealAsFood(m), servings: 1, meal: UI.food.meal });
  },
  'mb-portions': t => { const m = UI.mb; m.portions = Math.max(1, Math.round(((m.portions || 1) + Number(t.dataset.v)) * 4) / 4); render(); },
  'mb-add': () => pushSheet({ type: 'ingPick', q: '', tall: true }),
  'mb-ing-edit': t => { const i = Number(t.dataset.i), it = UI.mb.items[i]; pushSheet({ type: 'ingAmount', food: it, amount: it.amount, unit: it.unit, index: i }); },
  'mb-ing-remove': t => { UI.mb.items.splice(Number(t.dataset.i), 1); render(); },
  'mb-save': () => { const r = saveMeal(); if (!r) return; closeAll(); UI.tab = 'food'; UI.foodSeg = 'meals'; render(); toast(`Saved ${r.name}`); },
  'mb-save-log': () => { const r = saveMeal(); if (!r) return; UI.stack = []; UI.sheet = null; UI.food.meal = mealForNow(); if (UI.tab !== 'food' || UI.foodSeg !== 'log') UI.foodDate = todayKey(); pushSheet({ type: 'serving', food: mealAsFood(r), servings: 1, meal: UI.food.meal }); },
  'mb-delete': () => { const id = UI.mb.id; confirmSheet('Delete this meal?', 'Anything you already logged stays in your food log.', 'Delete', () => { S.myMeals = myMeals().filter(x => x.id !== id); save(); UI.mb = null; toast('Meal deleted'); }, true); },
  'ing-pick': t => { const f = (UI._foodCache || {})[t.dataset.id]; if (!f) return; const d = defaultAmount(f); pushSheet({ type: 'ingAmount', food: f, amount: d.amount, unit: d.unit }); },
  'ing-unit': t => {
    const s = UI.sheet, f = s.food, from = s.unit, to = t.dataset.v;
    const mult = servingsFor(f, s.amount, from);   // keep the same quantity when switching units
    const per1 = servingsFor(f, 1, to);
    const raw = per1 > 0 && mult > 0 ? mult / per1 : s.amount, step = ['g', 'ml'].includes(to) ? 1 : ['oz', 'tbsp', 'tsp', 'fl oz'].includes(to) ? 0.1 : 0.05;
    s.unit = to; s.amount = Math.max(step, Math.round(raw / step) * step); s.amount = Math.round(s.amount * 100) / 100;
    render();
  },
  'ing-save': () => {
    const s = UI.sheet, f = s.food, amount = parseFloat(String(s.amount).replace(',', '.'));
    if (!(amount > 0)) { toast('Enter an amount'); return; }
    const it = { id: f.id && s.index != null ? f.id : uid(), name: f.name, serving: f.serving, kcal: +f.kcal || 0, p: +f.p || 0, c: +f.c || 0, f: +f.f || 0, source: f.source || '', amount, unit: s.unit, mult: servingsFor(f, amount, s.unit) };
    if (s.index != null) UI.mb.items[s.index] = it; else UI.mb.items.push(it);
    // back to the builder, skipping the search sheet
    UI.stack = UI.stack.filter(x => x.type === 'mealBuilder' || !['ingPick', 'ingCustom'].includes(x.type));
    UI.sheet = UI.stack.pop() || { type: 'mealBuilder', tall: true };
    render(); toast(s.index != null ? 'Updated' : `Added ${f.name.split(',')[0]}`);
  },
  'ing-online': async () => {
    const s = UI.sheet, q = (s.q || '').trim(); if (!q) return;
    s.loading = true; s.err = ''; refreshIng();
    try { const res = await searchOnlineFoods(q); s.online = res.slice(0, 20); s.onlineQ = q; if (!res.length) s.err = 'No online results. Try a simpler search, or enter the nutrition yourself.'; }
    catch (e) { s.err = 'Online search isn\'t reachable right now. The built-in list still works, or enter the nutrition yourself.'; }
    s.loading = false; refreshIng();
  },
  'ing-custom': () => pushSheet({ type: 'ingCustom' }),
  'ing-custom-save': () => {
    const name = val('ic-name'), kcal = num('ic-kcal');
    if (!name) { toast('Name the ingredient'); return; }
    if (!(kcal >= 0) || (!kcal && !num('ic-p') && !num('ic-c') && !num('ic-f'))) { toast('Enter the calories per serving'); return; }
    const f = { id: 'c_' + uid(), name, serving: val('ic-serv') || '1 serving', kcal, p: num('ic-p'), c: num('ic-c'), f: num('ic-f'), cat: 'My foods', source: 'My food' };
    if (document.getElementById('ic-save').checked) { S.customFoods.unshift(f); save(); }
    const d = defaultAmount(f);
    UI.sheet = { type: 'ingAmount', food: f, amount: d.amount, unit: d.unit }; render();
  },
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.mb && UI.mb) {
    const k = el.dataset.mb;
    if (k === 'portions') { const v = parseFloat(el.value); if (v > 0) { UI.mb.portions = v; refreshMbTotals(); } }
    else if (k === 'cookedG') { const v = parseFloat(el.value); UI.mb.cookedG = v > 0 ? (S.profile.units === 'metric' ? v : v * 28.3495) : null; refreshMbTotals(); }
    else UI.mb[k] = el.value;
  } else if (el.id === 'ing-q' && UI.sheet && UI.sheet.type === 'ingPick') {
    UI.sheet.q = el.value; UI.sheet.err = ''; clearTimeout(refreshIng._t); refreshIng._t = setTimeout(refreshIng, 120);
  } else if (el.id === 'ing-amt' && UI.sheet && UI.sheet.type === 'ingAmount') {
    UI.sheet.amount = el.value; const p = document.getElementById('ing-preview');
    if (p) p.innerHTML = servPreview(UI.sheet.food, servingsFor(UI.sheet.food, parseFloat(String(el.value).replace(',', '.')) || 0, UI.sheet.unit));
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'ing-q') { e.preventDefault(); ACT['ing-online'](); } });

/* ================= hooks ================= */
// Nutrition tab: a My meals view beside Log, Meal plan and Grocery.
const _viewFoodMeals = viewFood;
viewFood = function () {
  const html = _viewFoodMeals();
  const seg = '<button data-act="food-seg" data-v="plan"';
  let out = html.replace(seg, `<button data-act="food-seg" data-v="meals" aria-pressed="${UI.foodSeg === 'meals'}">My meals</button>${seg}`);
  if (UI.foodSeg === 'meals') {
    const i = out.indexOf('</div>', out.indexOf('<div class="seg">')) + 6;
    out = out.slice(0, i).replace(/<h1 class="h1">[^<]*<\/h1>/, '<h1 class="h1">My meals</h1>') + viewMyMeals();
  }
  return out;
};
// Add food: your meals first, and a Create meal button.
const _foodResultsMeals = foodResults;
foodResults = function () {
  const q = (UI.food.q || '').trim().toLowerCase();
  const meals = myMeals().filter(m => !q || m.name.toLowerCase().includes(q)).slice(0, q ? 6 : 5).map(mealAsFood);
  // a saved meal shows once, under My meals, not again under Recent
  const names = new Set(meals.map(m => m.name)), recent = S.recentFoods;
  S.recentFoods = recent.filter(f => !names.has(f.name));
  try { return (meals.length ? `<span class="eyebrow">My meals</span><div class="list" style="margin-bottom:10px">${meals.map(foodPick).join('')}</div>` : '') + _foodResultsMeals(); }
  finally { S.recentFoods = recent; }
};
const _foodAddSheetMeals = SHEETS.foodAdd;
SHEETS.foodAdd = s => _foodAddSheetMeals(s).replace(`data-act="custom-food">${icon('plus', 16)} Create food</button>`, `data-act="custom-food">${icon('plus', 16)} Create food</button><button class="btn sm soft" data-act="meal-new">${icon('fork', 16)} Create meal</button>`);
// Logging a saved meal: a quick way back to edit it.
const _servingSheetMeals = SHEETS.serving;
SHEETS.serving = s => _servingSheetMeals(s) + (s.food && s.food.mealId && !s.editId ? `<button class="link fuel" data-act="meal-edit" data-id="${s.food.mealId}" style="align-self:center">Edit this meal</button>` : '');
// Meal plan recipes can be saved as your own meal to tweak.
if (SHEETS.recipe) {
  const _recipeSheetMeals = SHEETS.recipe;
  SHEETS.recipe = s => {
    const html = _recipeSheetMeals(s);
    const ref = s.d != null && S.mealPlan ? S.mealPlan.days[s.d].meals[s.m] : null, id = ref ? ref.recipeId : s.id;
    return html + `<button class="btn ghost block" data-act="meal-from-recipe" data-id="${esc(id)}">${icon('fork', 18)} Save to My meals</button>`;
  };
  ACT['meal-from-recipe'] = t => {
    const r = findRecipe(t.dataset.id, S.extraRecipes); if (!r) return;
    const items = r.ingredients.map(([k, q]) => { const g = INGR[k]; if (!g) return null; const f = { name: g.name, serving: `1 ${g.unit}`, kcal: g.kcal, p: g.p, c: g.c, f: g.f, source: 'built-in' }; return Object.assign({ id: uid(), amount: q, unit: g.unit, mult: q }, f); }).filter(Boolean);
    const m = { id: uid(), name: r.name, portions: 1, cookedG: null, notes: (r.steps || []).join(' '), items, updatedAt: Date.now() };
    myMeals().unshift(m); save(); UI.stack = []; UI.sheet = null; UI.tab = 'food'; UI.foodSeg = 'meals'; openBuilder(m); toast('Saved to My meals. Adjust it however you like.');
  };
}
