/* Groundwork — meal plan and grocery list screens, sheets and actions. */
UI.foodSeg = 'log';
UI.planDay = null;
const SLOT_TO_LOG = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', meal4: 'snacks', snack: 'snacks' };
const fmtServings = s => s === 1 ? '1 serving' : `${niceQty(s)} servings`;
const money = n => '$' + (Math.round(n * 100) / 100).toFixed(2);

function ensureGrocery() { S.grocery = Object.assign({ checked: {}, extra: [], store: 'instacart', range: 'week' }, S.grocery || {}); return S.grocery; }
function planIsCurrent() { const p = S.mealPlan; return p && p.days[p.days.length - 1].date >= todayKey(); }
function planDayIndex() {
  const p = S.mealPlan; if (!p) return 0;
  if (UI.planDay != null && p.days[UI.planDay]) return UI.planDay;
  const i = p.days.findIndex(d => d.date === todayKey());
  return i < 0 ? 0 : i;
}

/* ================= nutrition tab with three views ================= */
function viewFood() {
  const head = `<div class="stack" style="gap:2px"><span class="eyebrow">Nutrition</span><h1 class="h1">${{ log: 'Food log', plan: 'Meal plan', grocery: 'Grocery list' }[UI.foodSeg]}</h1></div>
    <div class="seg"><button data-act="food-seg" data-v="log" aria-pressed="${UI.foodSeg === 'log'}">Log</button><button data-act="food-seg" data-v="plan" aria-pressed="${UI.foodSeg === 'plan'}">Meal plan</button><button data-act="food-seg" data-v="grocery" aria-pressed="${UI.foodSeg === 'grocery'}">Groceries</button></div>`;
  if (UI.foodSeg === 'plan') return head + viewMealPlan();
  if (UI.foodSeg === 'grocery') return head + viewGrocery();
  return head + viewFoodLog();
}

function prefsSummary() {
  const p = S.mealPrefs || defaultMealPrefs();
  const bits = [];
  const hh = household(S);
  if (hh.length) bits.push(`For you + ${hh.length} (${hh.map(m => m.name).join(', ')})`);
  bits.push(p.diets.length ? p.diets.map(d => DIETS.find(x => x[0] === d)[1]).join(', ') : 'No diet restrictions');
  bits.push(`${p.meals} meals${p.snacks ? ` + ${p.snacks} snack${p.snacks > 1 ? 's' : ''}` : ''}`);
  if (p.quick) bits.push('quick meals');
  if (p.batch) bits.push('leftovers for lunch');
  if (p.budget) bits.push('budget-friendly');
  const ep = effectivePrefs(S, p);
  const avoid = (ep.avoidFlags || []).map(a => AVOID_OPTIONS.find(x => x[0] === a)[1]).concat(ep.avoidText ? [ep.avoidText] : []);
  if (avoid.length) bits.push('avoiding ' + avoid.join(', ').toLowerCase());
  return bits.join(' · ');
}

function viewMealPlan() {
  const T = calcTargets(S);
  if (!S.mealPlan || !planIsCurrent()) {
    return `<div class="card fuel">
        <div class="h2">${S.mealPlan ? 'Plan your next week' : 'Plan your week of meals'}</div>
        <p class="muted">Groundwork builds 7 days of meals from ${RECIPES.length} recipes, sized to hit your ${fmtInt(T.calories)} kcal and ${T.protein} g protein targets. Then it turns them into a grocery list.</p>
        <div class="callout">${esc(prefsSummary())}</div>
        <div class="row wrap"><button class="btn fuel" data-act="plan-create">${icon('bolt', 18)} Create my meal plan</button><button class="btn ghost" data-act="plan-prefs">Preferences</button></div>
      </div>`;
  }
  const p = S.mealPlan, di = planDayIndex(), day = p.days[di];
  const tot = dayTotals(day, S.extraRecipes);
  const week = householdCost(S);
  return `<div class="card fuel">
      <div class="card-head"><span class="eyebrow">Week of ${shortDate(p.start)}</span><span class="tag fuel">~${money(week)} groceries</span></div>
      <p class="small muted">${esc(prefsSummary())}</p>
      <div class="row wrap"><button class="btn sm fuel" data-act="plan-new">${icon('swap', 16)} New plan</button><button class="btn sm ghost" data-act="plan-prefs">Preferences</button><button class="btn sm ghost" data-act="food-seg" data-v="grocery">${icon('fork', 16)} Grocery list</button></div>
    </div>
    <div class="daychips" role="tablist">${p.days.map((d, i) => { const dt = parseKey(d.date); return `<button role="tab" data-act="plan-day" data-v="${i}" aria-selected="${i === di}" class="${d.date === todayKey() ? 'is-today' : ''}"><span>${DOW[dt.getDay()]}</span><b>${dt.getDate()}</b></button>`; }).join('')}</div>
    <div class="card" style="gap:10px">
      <div class="row between"><b>${day.date === todayKey() ? 'Today' : prettyDate(day.date)}</b><span class="small faint num">${money(householdCost(S, [day]))}${household(S).length ? ' household' : ''}</span></div>
      ${household(S).length ? `<div class="tiny faint">Bars show your portions. Everyone else's are sized to their own needs.</div>` : ''}
      ${targetBar('Calories', tot.kcal, T.calories, 'kcal', 'var(--fuel)')}
      ${targetBar('Protein', tot.p, T.protein, 'g', 'var(--protein)')}
    </div>
    ${day.meals.map((m, mi) => mealCard(m, di, mi)).join('')}
    <p class="tiny faint">Servings are scaled so each day lands near your targets. Tap a meal for the recipe, swap anything, and lock favorites so a new plan keeps them.</p>`;
}
function targetBar(label, v, t, unit, color) {
  const pct = Math.min(100, (v / t) * 100);
  return `<div><div class="row between small"><span class="muted">${label}</span><span class="num"><b>${fmtInt(v)}</b> <span class="faint">/ ${fmtInt(t)} ${unit}</span></span></div><div class="tbar"><i style="width:${pct.toFixed(0)}%;background:${color}"></i></div></div>`;
}
function mealCard(m, di, mi) {
  const r = findRecipe(m.recipeId, S.extraRecipes);
  if (!r) return '';
  const x = mealMacros(m, S.extraRecipes);
  return `<div class="card meal-card">
    <div class="row between"><span class="eyebrow">${MEAL_SLOTS[m.slot]}</span><span class="row" style="gap:6px">${m.leftover ? '<span class="tag">Leftovers</span>' : ''}${m.locked ? `<span class="tag fuel">${icon('check', 12)} Locked</span>` : ''}</span></div>
    <button class="meal-main" data-act="recipe-open" data-d="${di}" data-m="${mi}">
      <span class="grow"><span class="h3">${esc(r.name)}</span><br><span class="small muted">${r.minutes} min · ${household(S).length ? 'Your portion ' + niceQty(m.servings) : fmtServings(m.servings)} · ${fmtInt(x.kcal)} kcal</span><br>
      ${household(S).length ? `<span class="small" style="color:var(--fuel);font-weight:700">Cook ${niceQty(totalServings(S, m))} servings for ${1 + household(S).filter(h => memberPortion(S, h, m) > 0).length}</span><br>` : ''}
      <span class="pcf"><b class="p">P ${r0(x.p)}</b> <b class="c">C ${r0(x.c)}</b> <b class="f">F ${r0(x.f)}</b></span></span>
      <span class="chev">${icon('chevR', 18)}</span></button>
    <div class="row wrap" style="gap:8px">
      ${m.logged ? `<span class="tag train">${icon('check', 12)} Logged</span>` : S.mealPlan.days[di].date > todayKey() ? '' : `<button class="btn sm fuel" data-act="meal-log" data-d="${di}" data-m="${mi}">${icon('plus', 16)} Log it</button>`}
      <button class="btn sm ghost" data-act="meal-swap" data-d="${di}" data-m="${mi}">${icon('swap', 16)} Swap</button>
      <button class="btn sm ghost" data-act="meal-lock" data-d="${di}" data-m="${mi}" aria-pressed="${!!m.locked}">${m.locked ? 'Unlock' : 'Lock'}</button>
    </div>
  </div>`;
}

/* ================= grocery list ================= */
function viewGrocery() {
  if (!S.mealPlan || !planIsCurrent()) {
    return `<div class="card"><div class="empty">${icon('fork', 28)}<span>Your grocery list is built from your meal plan.</span><button class="btn fuel" data-act="food-seg" data-v="plan">Create a meal plan</button></div></div>`;
  }
  const G = ensureGrocery();
  const list = groceryList(S, G.range === 'rest' ? todayKey() : null);
  const shop = list.items.filter(i => !i.pantry), pantry = list.items.filter(i => i.pantry);
  const done = shop.filter(i => G.checked[i.key]).length;
  const store = STORES.find(s => s.id === G.store) || STORES[0];
  let aisle = '';
  const rows = shop.map(i => {
    const head = i.aisle !== aisle ? `<div class="aisle">${esc(i.aisle)}</div>` : '';
    aisle = i.aisle;
    return head + groceryRow(i, G, store);
  }).join('');
  return `<div class="card fuel">
      <div class="card-head"><span class="eyebrow">Week of ${shortDate(S.mealPlan.start)}</span><span class="tag fuel">~${money(list.cost)}</span></div>
      <div class="seg"><button data-act="gro-range" data-v="week" aria-pressed="${G.range !== 'rest'}">Whole week</button><button data-act="gro-range" data-v="rest" aria-pressed="${G.range === 'rest'}">From today</button></div>
      <div class="tbar"><i style="width:${shop.length ? (done / shop.length) * 100 : 0}%;background:var(--train)"></i></div>
      <div class="small muted">${done} of ${shop.length} items in the cart</div>
    </div>
    <div class="card">
      <span class="eyebrow">Order online</span>
      <div class="chips">${STORES.map(s => `<button class="chip" data-act="gro-store" data-v="${s.id}" aria-pressed="${s.id === store.id}">${s.name}</button>`).join('')}</div>
      ${SERVICE_CONFIG.instacartEndpoint && store.id === 'instacart'
        ? `<button class="btn fuel block" data-act="gro-instacart">${icon('external', 18)} Send whole list to Instacart</button><p class="tiny faint">Opens an Instacart page with every item, ready to choose a store and check out.</p>`
        : `<p class="small muted">Tap ${icon('external', 14)} next to any item to find it at ${esc(store.name)}.${store.id === 'instacart' ? ' Whole-list ordering switches on once the Instacart connection is set up.' : ''}</p>`}
      <div class="row wrap"><button class="btn sm ghost" data-act="gro-copy">${icon('copy', 16)} Copy list</button>${navigator.share ? `<button class="btn sm ghost" data-act="gro-share">${icon('share', 16)} Share</button>` : ''}${done ? `<button class="btn sm ghost" data-act="gro-reset">Uncheck all</button>` : ''}</div>
    </div>
    <div class="card" style="gap:0">${rows || '<div class="empty">No items.</div>'}
      <div class="row" style="padding-top:12px"><input class="input grow" id="gro-add" placeholder="Add an item, e.g. paper towels" aria-label="Add an item"><button class="btn soft" data-act="gro-add">${icon('plus', 18)}</button></div>
    </div>
    ${pantry.length ? `<details class="card pantry"><summary><b>Pantry check</b> <span class="small muted">${pantry.length} staples you probably have</span></summary><div style="margin-top:8px">${pantry.map(i => groceryRow(i, G, store)).join('')}</div></details>` : ''}
    <p class="tiny faint">Amounts are rounded up to what you'd buy. Prices are rough US averages to help you plan, not store prices.</p>`;
}
function groceryRow(i, G, store) {
  const on = !!G.checked[i.key];
  return `<div class="gro-row ${on ? 'on' : ''}">
    <button class="gro-check" data-act="gro-toggle" data-k="${esc(i.key)}" aria-pressed="${on}" aria-label="${esc(i.name)}">${icon('check', 16)}</button>
    <span class="grow" style="min-width:0"><span class="t">${esc(i.name)}</span>${i.amount ? `<br><span class="d">${esc(i.amount)}</span>` : ''}</span>
    ${i.custom ? `<button class="icon-btn" data-act="gro-del" data-id="${i.id}" aria-label="Remove ${esc(i.name)}">${icon('x', 16)}</button>` : ''}
    <a class="icon-btn" href="${store.url(i.q || i.name)}" target="_blank" rel="noopener" aria-label="Find ${esc(i.name)} at ${esc(store.name)}">${icon('external', 16)}</a>
  </div>`;
}
function groceryText() {
  const G = ensureGrocery();
  const list = groceryList(S, G.range === 'rest' ? todayKey() : null);
  let aisle = '', out = `Groundwork grocery list (week of ${shortDate(S.mealPlan.start)})\n`;
  list.items.filter(i => !i.pantry && !G.checked[i.key]).forEach(i => { if (i.aisle !== aisle) { aisle = i.aisle; out += `\n${aisle}\n`; } out += `- ${i.name}${i.amount ? ' — ' + i.amount : ''}\n`; });
  return out;
}

/* ================= Today card ================= */
function todayMealsCard() {
  if (!S.mealPlan || !planIsCurrent()) return '';
  const di = S.mealPlan.days.findIndex(d => d.date === todayKey());
  if (di < 0) return '';
  const day = S.mealPlan.days[di];
  return `<div class="card"><div class="card-head"><span class="eyebrow">Today's meals</span><button class="link fuel" data-act="open-plan">Meal plan</button></div>
    <div class="list">${day.meals.map((m, mi) => { const r = findRecipe(m.recipeId, S.extraRecipes); if (!r) return ''; const x = mealMacros(m, S.extraRecipes);
      return `<div class="li"><button class="grow" data-act="recipe-open" data-d="${di}" data-m="${mi}" style="text-align:left;background:none;border:0;padding:0;min-width:0"><span class="tiny faint">${MEAL_SLOTS[m.slot]}</span><br><span class="t">${esc(r.name)}</span><br><span class="d">${fmtInt(x.kcal)} kcal · ${r0(x.p)} g protein</span></button>
      ${m.logged ? `<span class="tag train">${icon('check', 12)} Logged</span>` : `<button class="btn sm fuel" data-act="meal-log" data-d="${di}" data-m="${mi}">Log it</button>`}</div>`; }).join('')}</div></div>`;
}

/* ================= sheets ================= */
Object.assign(SHEETS, {
  mealPrefs(s) {
    const p = s.draft;
    const sw = (k, label, sub) => `<div class="toggle"><span class="small"><b>${label}</b><br><span class="faint">${sub}</span></span><button class="switch" role="switch" aria-checked="${!!p[k]}" data-act="mp-toggle" data-k="${k}" aria-label="${label}"></button></div>`;
    const hh = household(S);
    return sheetHead('Meal plan preferences', 'Your plan only uses recipes that fit these')
      + `<div class="stack"><span class="label">Who's eating</span>
        <div class="list">
          <div class="li"><span class="ni">${icon('user', 20)}</span><span class="grow"><span class="t">You</span><br><span class="d">${fmtInt(calcTargets(S).calories)} kcal · your targets</span></span></div>
          ${hh.map(m => `<button class="li" data-act="hh-edit" data-id="${m.id}"><span class="ni">${icon('user', 20)}</span><span class="grow"><span class="t">${esc(m.name)}</span><br><span class="d">${fmtInt(m.kcal)} kcal · ${m.meals.map(x => MEAL_SLOTS[x]).join(', ') || 'no meals'}${(m.avoid || []).length || m.avoidText ? ' · avoids ' + (m.avoid || []).map(a => AVOID_OPTIONS.find(o => o[0] === a)[1].toLowerCase()).concat(m.avoidText ? [m.avoidText] : []).join(', ') : ''}</span></span><span class="chev">${icon('chevR', 18)}</span></button>`).join('')}
        </div>
        <button class="btn ghost sm" data-act="hh-add" style="align-self:flex-start">${icon('plus', 16)} Add a family member</button>
        <span class="tiny faint">Everyone eats the same recipes in their own portion size. Anyone's foods to avoid apply to shared meals.</span></div>
      <div class="stack"><span class="label">Diet</span><div class="chips">${DIETS.map(([k, l]) => `<button class="chip" data-act="mp-diet" data-v="${k}" aria-pressed="${p.diets.includes(k)}">${l}</button>`).join('')}</div><span class="tiny faint">Leave all off to eat anything.</span></div>
      <div class="stack"><span class="label">Foods to avoid</span><div class="chips">${AVOID_OPTIONS.map(([k, l]) => `<button class="chip" data-act="mp-avoid" data-v="${k}" aria-pressed="${p.avoidFlags.includes(k)}">${l}</button>`).join('')}</div>
        <input class="input" id="mp-avoid-text" placeholder="Anything else? e.g. mushrooms, avocado" value="${esc(p.avoidText)}" aria-label="Other foods to avoid"></div>
      <div class="grid2"><div class="field"><span class="label">Meals a day</span><div class="seg">${[2, 3, 4].map(n => `<button data-act="mp-set" data-k="meals" data-v="${n}" aria-pressed="${p.meals === n}">${n}</button>`).join('')}</div></div>
        <div class="field"><span class="label">Snacks a day</span><div class="seg">${[0, 1, 2].map(n => `<button data-act="mp-set" data-k="snacks" data-v="${n}" aria-pressed="${p.snacks === n}">${n}</button>`).join('')}</div></div></div>
      ${sw('quick', 'Quick meals', '20 minutes or less where possible')}
      ${sw('batch', 'Cook once, eat twice', 'Dinner leftovers become the next day\'s lunch')}
      ${sw('budget', 'Budget-friendly', 'Favors lower-cost recipes')}
      <p class="small faint" id="mp-count">${mpCount(effectivePrefs(S, p))}</p>
      <button class="btn fuel block" data-act="mp-save">${S.mealPlan && planIsCurrent() ? 'Save and rebuild plan' : 'Save and create plan'}</button>`;
  },

  member(s) {
    const d = s.draft;
    return sheetHead(s.id ? 'Edit family member' : 'Add a family member', 'Used only to size portions and shape shared meals')
      + `<div class="field"><label for="hh-name">Name</label><input class="input" id="hh-name" data-hh="name" value="${esc(d.name)}" placeholder="e.g. Sam"></div>
      <div class="stack"><span class="label">Who are they?</span><div class="chips">${HOUSEHOLD_GROUPS.map(([k, l]) => `<button class="chip" data-act="hh-group" data-v="${k}" aria-pressed="${d.group === k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label for="hh-kcal">Daily calories</label><div class="input-suffix"><input class="input" id="hh-kcal" data-hh="kcal" inputmode="numeric" value="${d.kcal}"><span>kcal</span></div><span class="tiny faint">A typical amount for this group. Adjust it if they eat more or less.</span></div>
      <div class="stack"><span class="label">Meals they eat from the plan</span><div class="chips">${['breakfast', 'lunch', 'dinner'].map(x => `<button class="chip" data-act="hh-meal" data-v="${x}" aria-pressed="${d.meals.includes(x)}">${MEAL_SLOTS[x]}</button>`).join('')}</div><span class="tiny faint">Turn off meals they eat elsewhere, like school lunch.</span></div>
      <div class="stack"><span class="label">Foods they avoid</span><div class="chips">${AVOID_OPTIONS.map(([k, l]) => `<button class="chip" data-act="hh-avoid" data-v="${k}" aria-pressed="${d.avoid.includes(k)}">${l}</button>`).join('')}</div>
        <input class="input" id="hh-avoid-text" data-hh="avoidText" value="${esc(d.avoidText || '')}" placeholder="Anything else? e.g. spicy, mushrooms" aria-label="Other foods they avoid"></div>
      <button class="btn fuel block" data-act="hh-save">${s.id ? 'Save' : 'Add to household'}</button>
      ${s.id ? `<button class="btn danger block" data-act="hh-del">${icon('trash', 18)} Remove ${esc(d.name || 'member')}</button>` : ''}`;
  },

  recipe(s) {
    const ref = s.d != null ? S.mealPlan.days[s.d].meals[s.m] : null;
    const r = findRecipe(ref ? ref.recipeId : s.id, S.extraRecipes);
    const sv = ref ? ref.servings : (s.servings || 1);
    const hh = ref ? household(S).map(h => ({ name: h.name, s: memberPortion(S, h, ref) })).filter(x => x.s > 0) : [];
    const cookSv = ref ? totalServings(S, ref) : sv;
    const flags = r.flags || '';
    const tags = [];
    if (!/[mfhpb]/.test(flags)) tags.push('Vegetarian');
    if (!flags.includes('d')) tags.push('Dairy-free');
    if (!flags.includes('g')) tags.push('Gluten-free');
    return sheetHead(esc(r.name), `${ref ? MEAL_SLOTS[ref.slot] + ' · ' + prettyDate(S.mealPlan.days[s.d].date) + ' · ' : ''}${r.minutes} min · about ${money(r.cost * sv)}`)
      + `<div class="stats"><div class="stat"><div class="v">${fmtInt(r.kcal * sv)}</div><div class="k">kcal</div></div><div class="stat"><div class="v">${r0(r.p * sv)}<span class="unit">g</span></div><div class="k">Protein</div></div><div class="stat"><div class="v">${r0(r.c * sv)}/${r0(r.f * sv)}</div><div class="k">Carbs/fat (g)</div></div></div>
      ${ref ? `<div class="field"><span class="label">${hh.length ? 'Your servings' : 'Servings'}</span><div class="stepper"><button data-act="recipe-serv" data-v="-0.25" aria-label="Fewer">−</button><div class="input big" aria-live="polite">${niceQty(sv)}</div><button data-act="recipe-serv" data-v="0.25" aria-label="More">+</button></div></div>` : ''}
      ${tags.length ? `<div class="chips">${tags.map(t => `<span class="tag train">${t}</span>`).join('')}${r.batch ? '<span class="tag">Good for leftovers</span>' : ''}</div>` : ''}
      ${hh.length ? `<div class="card" style="box-shadow:none;gap:6px"><span class="eyebrow">Cooking for ${hh.length + 1}: ${niceQty(cookSv)} servings</span><div class="list">${[{ name: 'You', s: sv }].concat(hh).map(x => `<div class="li" style="padding:6px 0"><span class="grow">${esc(x.name)}</span><span class="num small">${niceQty(x.s)} serving${x.s === 1 ? '' : 's'} · ${fmtInt(r.kcal * x.s)} kcal</span></div>`).join('')}</div></div>` : ''}
      <div class="stack"><span class="eyebrow">Ingredients${cookSv !== 1 ? ` for ${niceQty(cookSv)} servings${hh.length ? ' (everyone)' : ''}` : ''}</span><ul class="ingr">${r.ingredients.map(([k, q]) => { const g = INGR[k]; return `<li><span>${esc(g ? g.name : k)}</span><span class="faint num">${g ? esc(recipeAmount(g, q * cookSv)) : ''}</span></li>`; }).join('')}</ul></div>
      <div class="stack"><span class="eyebrow">Steps</span><ol class="cues">${r.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ''}</div>
      ${ref ? `<div class="grid2">${ref.logged ? `<span class="tag train" style="justify-content:center">${icon('check', 12)} Logged</span>` : S.mealPlan.days[s.d].date > todayKey() ? `<span class="tag" style="justify-content:center">Log on ${DOW[parseKey(S.mealPlan.days[s.d].date).getDay()]}</span>` : `<button class="btn fuel" data-act="meal-log" data-d="${s.d}" data-m="${s.m}">Log it</button>`}<button class="btn ghost" data-act="meal-swap" data-d="${s.d}" data-m="${s.m}">Swap</button></div>` : ''}`;
  },

  mealSwap(s) {
    const day = S.mealPlan.days[s.d], m = day.meals[s.m];
    const cur = findRecipe(m.recipeId, S.extraRecipes);
    const opts = swapOptions(S, s.d, s.m).slice(0, 14);
    return sheetHead(`Swap ${MEAL_SLOTS[m.slot].toLowerCase()}`, `Replacing ${esc(cur.name)}. Best fits for your targets first.`)
      + `<div class="list">${opts.map(o => `<button class="li" data-act="meal-pick" data-id="${o.r.id}" data-s="${o.s}"><span class="grow"><span class="t">${esc(o.r.name)}</span><br><span class="d">${o.r.minutes} min · ${fmtServings(o.s)} · ${fmtInt(o.r.kcal * o.s)} kcal · ${r0(o.r.p * o.s)} g protein</span></span><span class="chev">${icon('chevR', 18)}</span></button>`).join('') || '<div class="empty">No other recipes fit your preferences for this meal.</div>'}</div>
      ${SERVICE_CONFIG.recipeEndpoint ? `<div class="divider"></div><div class="row"><input class="input grow" id="rs-q" placeholder="Search more recipes online" aria-label="Search recipes online"><button class="btn soft" data-act="rs-search">${icon('search', 18)}</button></div><div id="rs-results"></div>` : ''}`;
  },
});
function recipeAmount(g, q) {
  if (g.unit === 'oz') return `${niceQty(q)} oz`;
  if (['cup', 'tbsp', 'tsp'].includes(g.unit)) return `${niceQty(q)} ${g.unit === 'cup' && q > 1 ? 'cups' : g.unit}`;
  // whole items (eggs, slices, tortillas…) round up; produce can stay fractional (½ avocado)
  const whole = ['egg', 'slice', 'tortilla', 'muffin', 'pita', 'cake', 'link', 'bar', 'stick'].includes(g.unit);
  const v = whole ? Math.max(1, Math.ceil(q - 0.1)) : q;
  return `${whole ? v : niceQty(v)} ${v > 1 ? (PLURAL[g.unit] || g.unit + 's') : g.unit}`;
}
function mpCount(p) {
  const n = { b: 0, l: 0, s: 0 };
  RECIPES.forEach(r => { if (!recipeAllowed(r, p)) return; if (r.meals.includes('breakfast')) n.b++; if (r.meals.includes('lunch') || r.meals.includes('dinner')) n.l++; if (r.meals.includes('snack')) n.s++; });
  return `${n.b} breakfasts, ${n.l} lunches and dinners, ${n.s} snacks match these preferences.`;
}

/* ================= actions ================= */
function rebuildMealPlan(keepLocked) {
  S.mealPlan = generateMealPlan(S, { keepLocked, start: keepLocked && S.mealPlan && planIsCurrent() ? S.mealPlan.start : todayKey() });
  ensureGrocery().checked = {};
  UI.planDay = null;
  save();
}
Object.assign(ACT, {
  'food-seg': t => { UI.foodSeg = t.dataset.v; UI.sheet = null; UI.stack = []; render(); window.scrollTo(0, 0); },
  'open-plan': () => { UI.tab = 'food'; UI.foodSeg = 'plan'; UI.planDay = null; closeAll(); window.scrollTo(0, 0); },
  'plan-create': () => { if (!S.mealPrefs) S.mealPrefs = defaultMealPrefs(); rebuildMealPlan(false); render(); toast('Your 7-day meal plan is ready'); },
  'plan-new': () => confirmSheet('Make a new plan?', 'Unlocked meals are replaced with a fresh mix. Locked meals stay, and your grocery checkmarks reset.', 'New plan', () => { rebuildMealPlan(true); toast('New meal plan ready'); }),
  'plan-prefs': () => pushSheet({ type: 'mealPrefs', draft: JSON.parse(JSON.stringify(S.mealPrefs || defaultMealPrefs())), tall: true }),
  'plan-day': t => { UI.planDay = Number(t.dataset.v); render(); },
  'mp-diet': t => {
    const d = UI.sheet.draft, v = t.dataset.v;
    if (d.diets.includes(v)) d.diets = d.diets.filter(x => x !== v);
    else { d.diets.push(v); if (v === 'vegetarian') d.diets = d.diets.filter(x => x !== 'pescatarian'); if (v === 'pescatarian') d.diets = d.diets.filter(x => x !== 'vegetarian'); }
    render();
  },
  'mp-avoid': t => { const d = UI.sheet.draft, v = t.dataset.v; d.avoidFlags = d.avoidFlags.includes(v) ? d.avoidFlags.filter(x => x !== v) : d.avoidFlags.concat([v]); render(); },
  'mp-set': t => { UI.sheet.draft[t.dataset.k] = Number(t.dataset.v); render(); },
  'mp-toggle': t => { const d = UI.sheet.draft; d[t.dataset.k] = !d[t.dataset.k]; render(); },
  'mp-save': () => { S.mealPrefs = UI.sheet.draft; rebuildMealPlan(!!S.mealPlan); closeAll(); UI.foodSeg = 'plan'; toast('Meal plan updated'); },
  'hh-add': () => pushSheet({ type: 'member', draft: { name: '', group: 'adult_f', kcal: 1900, meals: ['breakfast', 'lunch', 'dinner'], avoid: [], avoidText: '' } }),
  'hh-edit': t => { const m = household(S).find(x => x.id === t.dataset.id); if (m) pushSheet({ type: 'member', id: m.id, draft: JSON.parse(JSON.stringify({ avoidText: '', avoid: [], ...m })) }); },
  'hh-group': t => { const d = UI.sheet.draft, g = HOUSEHOLD_GROUPS.find(x => x[0] === t.dataset.v); d.group = g[0]; d.kcal = g[2]; render(); },
  'hh-meal': t => { const d = UI.sheet.draft, v = t.dataset.v; d.meals = d.meals.includes(v) ? d.meals.filter(x => x !== v) : d.meals.concat([v]); render(); },
  'hh-avoid': t => { const d = UI.sheet.draft, v = t.dataset.v; d.avoid = d.avoid.includes(v) ? d.avoid.filter(x => x !== v) : d.avoid.concat([v]); render(); },
  'hh-save': () => {
    const s = UI.sheet, d = s.draft;
    d.name = (d.name || '').trim() || 'Family member';
    d.kcal = Math.min(4500, Math.max(600, Math.round(Number(d.kcal) || 1800)));
    S.household = household(S).slice();
    if (s.id) S.household = S.household.map(m => m.id === s.id ? { ...d, id: s.id } : m);
    else S.household.push({ ...d, id: uid() });
    const n = replaceConflicts(S); save(); popSheet();
    toast(`${s.id ? 'Saved' : 'Added'} ${d.name}${n ? `. Swapped ${n} meal${n > 1 ? 's' : ''} to fit their foods to avoid.` : ''}`);
  },
  'hh-del': () => { const s = UI.sheet; S.household = household(S).filter(m => m.id !== s.id); save(); popSheet(); toast('Removed from household'); },
  'recipe-open': t => pushSheet({ type: 'recipe', d: Number(t.dataset.d), m: Number(t.dataset.m), key: t.dataset.d + '-' + t.dataset.m }),
  'recipe-serv': t => { const m = S.mealPlan.days[UI.sheet.d].meals[UI.sheet.m]; m.servings = Math.max(0.25, Math.min(4, m.servings + Number(t.dataset.v))); save(); render(); },
  'meal-log': t => {
    const d = Number(t.dataset.d), mi = Number(t.dataset.m);
    const day = S.mealPlan.days[d], m = day.meals[mi], r = findRecipe(m.recipeId, S.extraRecipes);
    logFood({ name: r.name, serving: '1 serving', kcal: r.kcal, p: r.p, c: r.c, f: r.f, source: 'Meal plan' }, m.servings, SLOT_TO_LOG[m.slot], day.date);
    m.logged = true; save();
    if (UI.sheet && UI.sheet.type === 'recipe') { render(); } else render();
    toast(`Logged ${r.name}`);
  },
  'meal-swap': t => pushSheet({ type: 'mealSwap', d: Number(t.dataset.d), m: Number(t.dataset.m) }),
  'meal-pick': t => {
    const s = UI.sheet, day = S.mealPlan.days[s.d];
    day.meals[s.m] = { slot: day.meals[s.m].slot, recipeId: t.dataset.id, servings: Number(t.dataset.s), locked: day.meals[s.m].locked };
    save(); closeAll(); toast('Meal swapped');
  },
  'meal-lock': t => { const m = S.mealPlan.days[Number(t.dataset.d)].meals[Number(t.dataset.m)]; m.locked = !m.locked; save(); render(); },
  'rs-search': async () => {
    const q = val('rs-q'); const el = document.getElementById('rs-results'); if (!q || !el) return;
    el.innerHTML = '<p class="small muted">Searching…</p>';
    try {
      const found = await searchRecipeService(q, S.mealPrefs || defaultMealPrefs());
      S.extraRecipes = (S.extraRecipes || []).filter(r => !found.some(f => f.id === r.id)).concat(found).slice(-60); save();
      el.innerHTML = found.length ? `<div class="list">${found.map(r => `<button class="li" data-act="meal-pick" data-id="${esc(r.id)}" data-s="1"><span class="grow"><span class="t">${esc(r.name)}</span><br><span class="d">${fmtInt(r.kcal)} kcal · ${r0(r.p)} g protein · ${esc(r.source)}</span></span></button>`).join('')}</div>` : '<p class="small muted">No recipes found.</p>';
    } catch (e) { el.innerHTML = '<p class="small muted">The recipe service isn\'t reachable right now.</p>'; }
  },
  // grocery
  'gro-toggle': t => { const G = ensureGrocery(), k = t.dataset.k; if (G.checked[k]) delete G.checked[k]; else G.checked[k] = true; save(); render(); },
  'gro-range': t => { ensureGrocery().range = t.dataset.v; save(); render(); },
  'gro-store': t => { ensureGrocery().store = t.dataset.v; save(); render(); },
  'gro-reset': () => { ensureGrocery().checked = {}; save(); render(); },
  'gro-add': () => { const v = val('gro-add'); if (!v) return; ensureGrocery().extra.push({ id: uid(), name: v }); save(); render(); setTimeout(() => { const i = document.getElementById('gro-add'); if (i) i.focus(); }, 30); },
  'gro-del': t => { const G = ensureGrocery(); G.extra = G.extra.filter(x => x.id !== t.dataset.id); save(); render(); },
  'gro-copy': () => {
    const txt = groceryText();
    try { navigator.clipboard.writeText(txt).then(() => toast('List copied. Paste it into notes, a text or an email.'), () => toast('Copy isn\'t available here')); } catch (e) { toast('Copy isn\'t available here'); }
  },
  'gro-share': async () => { try { await navigator.share({ title: 'Grocery list', text: groceryText() }); } catch (e) { /* cancelled */ } },
  'gro-instacart': async () => {
    const G = ensureGrocery();
    const items = groceryList(S, G.range === 'rest' ? todayKey() : null).items.filter(i => !i.pantry && !G.checked[i.key]);
    toast('Building your Instacart list…');
    try { const url = await sendToInstacart(items, `Groundwork meals, week of ${shortDate(S.mealPlan.start)}`); window.open(url, '_blank', 'noopener') || (location.href = url); }
    catch (e) { toast('Couldn\'t reach Instacart. Use the item links or copy the list instead.'); }
  },
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.hh && UI.sheet && UI.sheet.type === 'member') { UI.sheet.draft[t.dataset.hh] = t.value; return; }
  if (t.id === 'mp-avoid-text' && UI.sheet && UI.sheet.draft) {
    UI.sheet.draft.avoidText = t.value;
    const c = document.getElementById('mp-count'); if (c) c.textContent = mpCount(effectivePrefs(S, UI.sheet.draft));
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'gro-add') { e.preventDefault(); ACT['gro-add'](); }
  if (e.key === 'Enter' && e.target.id === 'rs-q') { e.preventDefault(); ACT['rs-search'](); }
});
