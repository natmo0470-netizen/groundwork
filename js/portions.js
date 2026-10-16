/* Movla — how much did you eat? Amounts in real units when logging food.
   The "add food" sheet lets you enter grams, ounces, cups, spoons, ml or pieces when the food's serving
   says how much it weighs or holds (e.g. "100 g", "1 cup cooked (158 g)", "2 tbsp (32 g)"); "servings"
   is always there too. Uses the unit maths from the meal builder (meals.js).
   Log entries keep { servings } for totals, plus { amount, unit } so the log reads "150 g", not "1.5 × 100 g". */

const PORTION_STEP = { g: 10, oz: 0.5, lb: 0.25, kg: 0.1, ml: 25, l: 0.1, cup: 0.25, tbsp: 1, tsp: 1, 'fl oz': 1, serving: 0.25 };
const PORTION_CHIPS = { g: [50, 100, 150, 200, 250], oz: [2, 3, 4, 6, 8], lb: [0.25, 0.5, 1], ml: [100, 250, 350, 500], cup: [0.25, 0.5, 1, 1.5, 2], tbsp: [1, 2, 3], tsp: [1, 2], 'fl oz': [4, 8, 12, 16], serving: [0.5, 1, 1.5, 2] };
const roundFor = (u, n) => {
  if (u === 'g' || u === 'ml') return Math.round(n);
  if (u === 'oz' || u === 'fl oz' || u === 'tbsp' || u === 'tsp') return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
};
/* The same amount expressed in another unit (inverse of servingsFor). */
function amountIn(f, servings, unit) {
  if (unit === 'serving') return servings;
  const b = parseServing(f.serving);
  if (MASS_G[unit] && b.grams) return servings * b.grams / MASS_G[unit];
  if (VOL_ML[unit] && b.ml) return servings * b.ml / VOL_ML[unit];
  if (unit === b.unit) return servings * (b.qty || 1);
  return servings;
}
function portionStart(f, entry) {
  const opts = unitOptions(f);
  if (entry && entry.unit && opts.includes(entry.unit)) return { unit: entry.unit, amount: entry.amount };
  if (entry) return { unit: 'serving', amount: entry.servings };
  let { amount, unit } = defaultAmount(f);
  // Weighing in ounces? Use them for "100 g" foods too.
  const pref = S.portionPref && S.portionPref.weight;
  if (MASS_G[unit] && pref && pref !== unit && opts.includes(pref)) { amount = roundFor(pref, amountIn(f, servingsFor(f, amount, unit), pref)); unit = pref; }
  return { unit, amount };
}
/* A helpful equivalent under the numbers: grams for anything not entered in grams. */
function portionEquiv(f, servings, unit) {
  const b = parseServing(f.serving);
  if (unit === 'g') return '';
  if (b.grams) return `${MASS_G[unit] ? '' : '≈ '}${fmtAmt(roundFor('g', servings * b.grams))} g`;
  if (b.ml && unit !== 'ml') return `≈ ${fmtAmt(roundFor('ml', servings * b.ml))} ml`;
  if (unit !== 'serving') return `${fmtServ(Math.round(servings * 100) / 100)} × ${f.serving}`;
  return '';
}
const unitLabel = (f, u) => u === 'serving' ? 'servings' : u;
function portionText(it) {
  if (it.unit && it.unit !== 'serving' && it.amount > 0) return `${fmtAmt(it.amount)} ${it.unit}`;
  return `${fmtServ(it.servings)} × ${it.serving}`;
}

function portionSheet(s) {
  const f = s.food;
  if (s.unit == null) Object.assign(s, portionStart(f, s.entry));
  const opts = unitOptions(f);
  s.servings = servingsFor(f, s.amount, s.unit);
  const equiv = portionEquiv(f, s.servings, s.unit);
  const chips = (PORTION_CHIPS[s.unit] || [1, 2, 3, 4]);
  return sheetHead(esc(f.name), `Nutrition per ${esc(f.serving)}` + (f.source ? ' · ' + esc(f.source) : ''))
    + `<div class="field"><span class="label">How much?</span>
        <div class="stepper"><button data-act="por-step" data-v="-1" aria-label="Less">−</button><input class="input big" id="por-n" inputmode="decimal" value="${fmtAmt(s.amount)}" aria-label="Amount in ${esc(unitLabel(f, s.unit))}"><button data-act="por-step" data-v="1" aria-label="More">+</button></div>
        ${opts.length > 1 ? `<div class="seg por-units" role="group" aria-label="Unit">${opts.map(u => `<button data-act="por-unit" data-v="${esc(u)}" aria-pressed="${s.unit === u}">${esc(unitLabel(f, u))}</button>`).join('')}</div>` : `<div class="small faint">servings of ${esc(f.serving)}</div>`}
      </div>
      <div class="chips">${chips.map(v => `<button class="chip" data-act="por-set" data-v="${v}" aria-pressed="${s.amount === v}">${fmtAmt(v)}${s.unit === 'serving' ? '×' : ' ' + esc(s.unit)}</button>`).join('')}</div>
      <div class="card" style="box-shadow:none" id="serv-preview">${servPreview(f, s.servings)}${equiv ? `<div class="small faint" id="por-eq">${/^[≈]/.test(equiv) ? '' : '= '}${esc(equiv)}</div>` : ''}</div>
      <div class="field"><span class="label">Meal</span><div class="seg">${MEALS.map(([id, l]) => `<button data-act="serv-meal" data-v="${id}" aria-pressed="${s.meal === id}">${l}</button>`).join('')}</div></div>
      <button class="btn fuel block" data-act="serv-save">${s.editId ? 'Save changes' : 'Add to log'}</button>
      ${s.editId ? `<button class="btn danger block" data-act="food-delete" data-id="${s.editId}">${icon('trash', 18)} Remove from log</button>` : ''}`;
}

function porUpdate() {   // after typing: refresh numbers without redrawing the input
  const s = UI.sheet, f = s.food;
  s.servings = servingsFor(f, s.amount, s.unit);
  const p = document.getElementById('serv-preview'); if (!p) return;
  const equiv = portionEquiv(f, s.servings, s.unit);
  p.innerHTML = servPreview(f, s.servings) + (equiv ? `<div class="small faint" id="por-eq">${/^[≈]/.test(equiv) ? '' : '= '}${esc(equiv)}</div>` : '');
  document.querySelectorAll('[data-act="por-set"]').forEach(c => c.setAttribute('aria-pressed', String(Number(c.dataset.v) === s.amount)));
}

Object.assign(ACT, {
  'por-step': t => {
    const s = UI.sheet, st = PORTION_STEP[s.unit] || 1;
    s.amount = Math.max(st, roundFor(s.unit, (Math.round(s.amount / st) + Number(t.dataset.v)) * st));
    render();
  },
  'por-set': t => { UI.sheet.amount = Number(t.dataset.v); render(); },
  'por-unit': t => {
    const s = UI.sheet, u = t.dataset.v; if (u === s.unit) return;
    const sv = servingsFor(s.food, s.amount, s.unit);
    s.unit = u; s.amount = roundFor(u, amountIn(s.food, sv, u)) || PORTION_STEP[u] || 1;
    if (MASS_G[u]) S.portionPref = Object.assign(S.portionPref || {}, { weight: u });
    render();
  },
  'edit-food': t => {
    const it = (S.foodLog[UI.foodDate] || []).find(x => x.id === t.dataset.id); if (!it) return;
    pushSheet({ type: 'serving', food: { name: it.name, serving: it.serving, kcal: it.kcal, p: it.p, c: it.c, f: it.f, source: it.source }, entry: it, meal: it.meal, editId: it.id });
  },
  'serv-save': () => {
    const s = UI.sheet, sv = servingsFor(s.food, s.amount, s.unit);
    if (!(sv > 0)) { toast('Enter how much you had'); return; }
    const portion = s.unit && s.unit !== 'serving' ? { amount: s.amount, unit: s.unit } : { amount: undefined, unit: undefined };
    if (s.editId) {
      const it = (S.foodLog[UI.foodDate] || []).find(x => x.id === s.editId);
      if (it) { it.servings = Math.round(sv * 1000) / 1000; it.meal = s.meal; it.amount = portion.amount; it.unit = portion.unit; if (it.amount == null) { delete it.amount; delete it.unit; } }
    } else {
      logFood(s.food, Math.round(sv * 1000) / 1000, s.meal);
      const list = S.foodLog[UI.foodDate], it = list && list[list.length - 1];
      if (it && portion.unit) { it.amount = portion.amount; it.unit = portion.unit; }
    }
    save(); closeAll(); toast(s.editId ? 'Updated' : `Added ${s.food.name.split(',')[0]}`);
  },
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t && t.id === 'por-n' && UI.sheet && UI.sheet.type === 'serving') { const v = parseFloat(t.value); if (v > 0) { UI.sheet.amount = v; porUpdate(); } }
});

/* The food log shows "150 g" for amounts entered in units. */
{
  const view = viewFood;
  viewFood = (...a) => {
    let html = view(...a);
    (S.foodLog[UI.foodDate] || []).forEach(i => {
      if (!i.unit || i.unit === 'serving') return;
      html = html.replace(`data-id="${i.id}"><span class="grow" style="min-width:0"><span class="t">${esc(i.name)}</span><br><span class="d">${fmtServ(i.servings)} × ${esc(i.serving)}`,
        `data-id="${i.id}"><span class="grow" style="min-width:0"><span class="t">${esc(i.name)}</span><br><span class="d">${esc(portionText(i))}`);
    });
    return html;
  };
}
