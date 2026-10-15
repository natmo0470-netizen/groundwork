/* Movla — the free plan and Plus.
   Everything in the app is free. Plus removes the one small card on Today and the food log and
   lifts the daily barcode-scan limit. Coaches, coached clients and complimentary (friends and
   family) accounts get Plus through Cloud.hasPlus(). Builds without accounts (no cloud config)
   have no limits and no cards.
   Cards: our own tips ("house" cards) and, once the RitFit affiliate IDs (Awin) are set, a plain
   link to home-gym gear the person doesn't have yet, shown only to people who train at home.
   No ad network, no tracking, nothing is sent anywhere when a card is shown. */
const PLUS = {
  freeScans: 3,                 // barcode lookups a day on the free plan
  monthly: 2.99, yearly: 19.99,
  showPrices: false,            // switch on with in-app purchases (RevenueCat / store billing)
  // RitFit affiliate links through Awin. Both IDs come from your Awin account once RitFit approves you:
  // awinmid = RitFit's advertiser ID (on its programme page), awinaffid = your publisher ID (top of the dashboard).
  // Either blank hides product cards.
  partner: { name: 'RitFit', site: 'https://www.ritfitsports.com', awinmid: '', awinaffid: '' },
};

const Plus = (() => {
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const SKEY = 'groundwork.scans', HKEY = 'groundwork.cardHidden';
  const gated = () => typeof Cloud !== 'undefined' && Cloud.configured();
  const active = () => !gated() || (Cloud.signedIn() && Cloud.hasPlus());

  /* ---------- barcode scans ---------- */
  function day() { const d = store.get(SKEY); return d && d.day === todayKey() ? d : { day: todayKey(), codes: [] }; }
  const used = () => day().codes.length;
  const left = () => (active() ? Infinity : Math.max(0, PLUS.freeScans - used()));
  // Rescanning a code already looked up today, or one saved as your own food, is always free.
  function free(code) { return active() || day().codes.includes(code) || (S.customFoods || []).some(f => f.barcode === code); }
  function take(code) {
    if (free(code)) return true;
    const d = day(); if (d.codes.length >= PLUS.freeScans) return false;
    d.codes.push(code); store.set(SKEY, d); return true;
  }
  const scanLine = () => (active() || left() <= 0 ? '' : `<p class="tiny faint" style="margin:0">${left() === 1 ? '1 free scan' : left() + ' free scans'} left today · <button class="link" data-act="plus-open">Unlimited with Plus</button></p>`);
  const outHtml = () => `<div class="stack" style="gap:8px"><p class="small" style="margin:0">You've used today's ${PLUS.freeScans} free scans. They reset at midnight.</p>
    <button class="btn fuel block" data-act="plus-open">Unlimited scans with Plus</button>
    <button class="btn ghost block" data-act="quick-add">Quick add calories</button>
    <button class="btn ghost block" data-act="scan-create">Add it from the label</button>
    <p class="tiny faint" style="margin:0">Foods you've already scanned today, and ones you saved with a barcode, still scan for free.</p></div>`;

  /* ---------- the one card ---------- */
  const HOUSE = [
    { id: 'meals', eyebrow: 'Tip', title: 'Meal prep, counted for you', body: 'Build a recipe from its ingredients in My meals and get calories and macros per portion.', act: 'promo-meals', label: 'Open My meals' },
    { id: 'coach', eyebrow: 'Tip', title: 'Working with a trainer?', body: 'Your coach can send your program and targets straight to the app, and their clients get Plus free.', act: 'tab', id2: 'coach', label: 'See coaching' },
    { id: 'plus', eyebrow: 'Movla Plus', title: 'Keep it clean', body: 'Plus hides this card and gives you unlimited barcode scans. Everything else stays free.', act: 'plus-open', label: 'See Plus' },
  ];
  // Home-gym gear, each tied to the equipment it adds to your plan. A card only offers gear you don't have.
  const PRODUCTS = [
    { id: 'dumbbell', title: 'Adjustable dumbbells', body: 'One pair replaces a rack of weights and unlocks most of the exercises in your plan.', q: 'adjustable dumbbells' },
    { id: 'bench', title: 'A weight bench', body: 'Adds presses, rows and step-ups to your home workouts.', q: 'weight bench' },
    { id: 'bands', title: 'Resistance bands', body: 'A cheap way to add pulling exercises, warm-ups and assistance.', q: 'resistance bands' },
    { id: 'pullup_bar', title: 'A pull-up bar', body: 'The simplest way to train your back at home.', q: 'pull up bar' },
    { id: 'barbell', title: 'A power rack', body: 'Squats, bench and overhead press, safely, in a garage gym.', q: 'power rack' },
  ];
  const partnerOn = () => !!(PLUS.partner && PLUS.partner.awinmid && PLUS.partner.awinaffid);
  // Commercial gyms (gym presets that aren't home_ or garage) and "Full gym" already have the gear.
  const atHome = () => { const e = S.equipment || {}; return !e.fullGym && (!e.gym || /^home|garage/.test(e.gym)); };
  const wanted = () => (partnerOn() && atHome() ? PRODUCTS.filter(p => !((S.equipment && S.equipment.items) || []).includes(p.id)) : []);
  const partnerLink = q => `https://www.awin1.com/cread.php?awinmid=${encodeURIComponent(PLUS.partner.awinmid)}&awinaffid=${encodeURIComponent(PLUS.partner.awinaffid)}&ued=${encodeURIComponent(PLUS.partner.site + '/search?q=' + encodeURIComponent(q))}`;
  const hidden = () => (store.get(HKEY) || '') === todayKey();
  function pick(place) {
    const pool = HOUSE.concat(wanted().map(p => Object.assign({ product: true }, p)));
    const seed = Math.floor(Date.now() / 864e5) + (place === 'food' ? 1 : 0);
    return pool[seed % pool.length];
  }
  function card(place) {
    if (active() || hidden() || S.demo || !S.onboarded || S.startDate === todayKey()) return '';
    const c = pick(place);
    const x = `<button class="x" data-act="card-hide" aria-label="Hide for today">${icon('x', 16)}</button>`;
    if (c.product) {
      const n = esc(PLUS.partner.name);
      return `<div class="card promo"><div class="card-head"><span class="eyebrow">Sponsored · ${n}</span>${x}</div><b>${esc(c.title)}</b><span class="small muted">${esc(c.body)}</span>
        <a class="btn ghost sm" href="${partnerLink(c.q)}" target="_blank" rel="noopener sponsored" style="align-self:flex-start">${icon('external', 16)} See it at ${n}</a>
        <span class="tiny faint">Movla earns a commission if you buy through this link, at no cost to you. <button class="link" data-act="plus-open">Hide these with Plus</button></span></div>`;
    }
    return `<div class="card promo"><div class="card-head"><span class="eyebrow">${esc(c.eyebrow)}</span>${x}</div><b>${esc(c.title)}</b><span class="small muted">${esc(c.body)}</span>
      <button class="link" data-act="${c.act}"${c.id2 ? ` data-id="${c.id2}"` : ''} style="align-self:flex-start">${esc(c.label)}</button></div>`;
  }

  /* ---------- the Plus sheet ---------- */
  SHEETS.plus = () => {
    const src = gated() && Cloud.signedIn() ? Cloud.plusSource() : null;
    const have = active() && gated();
    return sheetHead('Movla Plus', have ? 'You have Plus' : 'The whole app is free. Plus is for people who want it extra clean.')
      + `<div class="card"><div class="list">
          <div class="li"><span class="grow"><span class="t">No sponsored or tip cards</span><br><span class="d">Today and the food log show only your stuff</span></span>${icon('check', 18)}</div>
          <div class="li"><span class="grow"><span class="t">Unlimited barcode scans</span><br><span class="d">Free plan: ${PLUS.freeScans} a day</span></span>${icon('check', 18)}</div>
        </div></div>
        <p class="small muted">Workouts, programs, food logging, meal plans, groceries, My meals, check-ins, progress and coaching all stay free.</p>
        ${have ? `<p class="small">${icon('check', 14)} ${src && src.source === 'coach' ? 'Included with your coach' : src && src.kind === 'coach' ? 'Included with your coach plan' : src && src.source === 'grant' ? 'Complimentary' : 'Active'}</p>`
          : PLUS.showPrices ? `<div class="row wrap"><button class="btn fuel" data-act="plus-buy" data-id="yearly">$${PLUS.yearly}/year</button><button class="btn ghost" data-act="plus-buy" data-id="monthly">$${PLUS.monthly}/month</button></div><button class="link muted" data-act="plus-restore">Restore purchases</button>`
          : `<p class="small muted">Plus opens at launch. Training with a coach on Movla? You get it free.</p>`}`;
  };

  Object.assign(ACT, {
    'plus-open': () => pushSheet({ type: 'plus' }),
    'card-hide': () => { store.set(HKEY, todayKey()); render(); },
    'promo-meals': () => { UI.tab = 'food'; UI.foodSeg = 'meals'; render(); },
    'plus-buy': () => toast('Purchases open at launch'),
    'plus-restore': () => toast('Purchases open at launch'),
  });

  // Open the scanner only with a scan to spend; the sheet shows how many are left.
  const openScan = ACT['scan-open'];
  ACT['scan-open'] = (t, e) => { if (left() <= 0) { pushSheet({ type: 'scan', status: ' ', resultHtml: outHtml() }); return; } openScan(t, e); };
  const scanSheet = SHEETS.scan;
  SHEETS.scan = s => {
    const h = scanSheet(s).replace('<div id="scan-result">', scanLine() + '<div id="scan-result">');
    return left() > 0 ? h : h.replace(/<div class="scanbox">[\s\S]*?<\/div><\/div>/, '');   // no camera once today's scans are used
  };

  const camera = startScan;
  startScan = () => { if (left() > 0) camera(); };

  // Every lookup path (live camera, photo, typed number) goes through handleBarcode.
  const lookup = handleBarcode;
  handleBarcode = function (code) {
    const c = String(code).replace(/\D/g, '');
    if (!take(c)) { Scanner.stop(); if (UI.sheet && UI.sheet.type === 'scan') { UI.sheet.code = c; UI.sheet.status = ' '; UI.sheet.resultHtml = outHtml(); render(); } return Promise.resolve(); }
    return lookup(code);
  };

  return { active, left, used, card, scanLine };
})();

/* The card sits at the bottom of Today and the food log, below everything that's yours. */
{
  const today = viewToday, foodLog = viewFoodLog;
  viewToday = () => today() + Plus.card('today');
  viewFoodLog = () => foodLog() + Plus.card('food');
}
