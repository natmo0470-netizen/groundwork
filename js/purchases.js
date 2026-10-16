/* Movla — App Store and Google Play subscriptions, through RevenueCat.
   Plus (monthly or yearly) and coach plans (Starter, Growth, Pro, Studio; monthly with a free trial)
   are bought in the phone app with the store's own checkout. RevenueCat tells our server (Edge Function
   `revenuecat`), which saves the plan on the account; the app reads it the usual way (Cloud.refreshAccess).
   Purchases need an account, so the plan follows the person to any phone and to movla.app.
   On the website, and until the keys below are filled in, nothing here shows: the early-access and
   test-checkout screens stay as they are.

   RevenueCat setup this expects (server/README.md has the click-by-click):
     entitlements  plus · coach_starter · coach_growth · coach_pro · coach_studio
     offerings     'default' → packages $rc_monthly and $rc_annual (Plus)
                   'coach'   → packages starter · growth · pro · studio (custom identifiers) */
const PURCHASES_CONFIG = {
  appleKey: '',     // RevenueCat → Project settings → API keys → App Store public key (appl_…)
  googleKey: '',    // RevenueCat → Project settings → API keys → Google Play public key (goog_…)
  terms: 'https://movla.app/terms.html',
  privacy: 'https://movla.app/privacy.html',
};

const Purchases = (() => {
  const C = window.Capacitor;
  const P = () => C && C.Plugins && C.Plugins.Purchases;
  const native = typeof Native !== 'undefined' && Native.isNative;
  const key = () => (typeof Native !== 'undefined' && Native.platform === 'ios' ? PURCHASES_CONFIG.appleKey : PURCHASES_CONFIG.googleKey);
  let configured = false, user = null, offerings = null, loading = false, info = null;

  const available = () => native && !!P() && !!key();
  const ready = () => available() && configured;

  async function setup() {
    if (!available() || typeof Cloud === 'undefined' || !Cloud.configured()) return;
    const uid = Cloud.signedIn() ? Cloud.me() : null;
    try {
      if (!configured) {
        await P().configure(uid ? { apiKey: key(), appUserID: uid } : { apiKey: key() });
        configured = true; user = uid;
        try { P().addCustomerInfoUpdateListener(ci => { info = ci; }); } catch (e) { /* older plugin */ }
      } else if (uid && uid !== user) { await P().logIn({ appUserID: uid }); user = uid; }
      else if (!uid && user) { await P().logOut(); user = null; }
      loadOfferings();
    } catch (e) { /* the store isn't reachable right now; screens fall back to early access */ }
  }
  async function loadOfferings() {
    if (!configured || loading) return;
    loading = true;
    try { offerings = await P().getOfferings(); } catch (e) { offerings = null; }
    loading = false; render();
  }
  const offering = id => offerings && (id === 'default' ? offerings.current || (offerings.all || {}).default : (offerings.all || {})[id]) || null;
  function pkg(offeringId, ident) {
    const o = offering(offeringId); if (!o) return null;
    const list = o.availablePackages || [];
    return list.find(p => p.identifier === ident) || list.find(p => (p.packageType || '').toLowerCase() === ident.replace('$rc_', '')) ||
      list.find(p => p.product && new RegExp(ident.replace('$rc_', ''), 'i').test(p.product.identifier)) || null;
  }
  const plusPkgs = () => ({ monthly: pkg('default', '$rc_monthly'), yearly: pkg('default', '$rc_annual') });
  const coachPkg = plan => pkg('coach', plan);

  /* "Free for 14 days, then $24.99/month" — the wording the stores require next to the button. */
  function terms(p, per) {
    const pr = p && p.product; if (!pr) return '';
    const intro = pr.introPrice;
    const unit = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };
    const trial = intro && intro.price === 0 ? `Free for ${intro.periodNumberOfUnits} ${unit[intro.periodUnit] || 'day'}${intro.periodNumberOfUnits === 1 ? '' : 's'}, then ` : '';
    return `${trial}${pr.priceString}/${per}`;
  }
  function legal() {
    const store = typeof Native !== 'undefined' && Native.platform === 'ios' ? 'Apple ID' : 'Google Play account';
    return `<p class="tiny faint" style="margin:0">Payment is charged to your ${store}. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period; cancel any time in your ${typeof Native !== 'undefined' && Native.platform === 'ios' ? 'App Store' : 'Google Play'} subscriptions. <a href="${PURCHASES_CONFIG.terms}" target="_blank" rel="noopener">Terms of Use</a> · <a href="${PURCHASES_CONFIG.privacy}" target="_blank" rel="noopener">Privacy Policy</a></p>`;
  }

  /* After the store says yes: ask our server to save the plan, then refresh what this account can use. */
  async function confirm() {
    try { await Cloud.fn('revenuecat', { action: 'sync' }); } catch (e) { /* the webhook will catch up */ }
    try { await Cloud.refreshAccess(); } catch (e) { /* offline */ }
    render();
  }
  async function buy(p) {
    if (!ready() || !p) throw new Error('Purchases aren\'t available right now.');
    try { await P().purchasePackage({ aPackage: p }); }
    catch (e) {
      if (e && (e.userCancelled || e.code === '1' || /cancel/i.test(e.message || ''))) return 'cancelled';
      throw e;
    }
    await confirm();
    return 'ok';
  }
  async function restore() {
    if (!ready()) throw new Error('Purchases aren\'t available right now.');
    await P().restorePurchases();
    await confirm();
  }
  async function manage() {
    let url = info && info.managementURL;
    if (!url && ready()) { try { const r = await P().getCustomerInfo(); info = r && (r.customerInfo || r); url = info && info.managementURL; } catch (e) { /* ignore */ } }
    url = url || (typeof Native !== 'undefined' && Native.platform === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions');
    window.open(url, '_blank');
  }
  const errText = e => (e && e.message) || 'The purchase didn\'t go through. Nothing was charged.';

  return { available, ready, setup, loadOfferings, plusPkgs, coachPkg, terms, legal, buy, restore, manage, errText };
})();

/* ---------- Plus ---------- */
{
  const sheet = SHEETS.plus;
  SHEETS.plus = s => {
    const html = sheet(s);
    if (!Purchases.available()) return html;
    const have = Cloud.signedIn() && Cloud.hasPlus();
    const src = have ? Cloud.plusSource() : null;
    if (have && src && src.source === 'store') return html + `<button class="link muted" data-act="buy-manage" style="align-self:center">Manage subscription</button>`;
    if (have) return html;
    let body;
    if (!Cloud.signedIn()) body = `<p class="small muted" style="margin:0">Plus is linked to your Movla account so it works on all your devices.</p><button class="btn fuel block" data-act="acct-open" data-mode="signup">Create a free account</button><button class="link" data-act="acct-open" data-mode="signin" style="align-self:center">I have an account</button>`;
    else if (!Purchases.ready()) body = `<p class="small muted" style="margin:0">Connecting to the ${Native.platform === 'ios' ? 'App Store' : 'Play Store'}…</p>`;
    else {
      const k = Purchases.plusPkgs();
      if (!k.monthly && !k.yearly) body = `<p class="small muted" style="margin:0">Plus isn't available in your store yet.</p>`;
      else body = `${k.yearly ? `<button class="btn fuel block" data-act="buy-plus" data-id="yearly" ${s.busy ? 'disabled' : ''}>${esc(Purchases.terms(k.yearly, 'year'))}</button>` : ''}
        ${k.monthly ? `<button class="btn ghost block" data-act="buy-plus" data-id="monthly" ${s.busy ? 'disabled' : ''}>${esc(Purchases.terms(k.monthly, 'month'))}</button>` : ''}
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        ${Purchases.legal()}<button class="link muted" data-act="buy-restore" style="align-self:center">Restore purchases</button>`;
    }
    // Replace the "opens at launch" line or the placeholder price buttons with the store's.
    return html.replace(/<p class="small muted">Plus opens at launch[^<]*<\/p>/, body)
      .replace(/<div class="row wrap"><button class="btn fuel" data-act="plus-buy"[\s\S]*?data-act="plus-restore">Restore purchases<\/button>/, body);
  };
}

/* ---------- coach plans: the pay step ---------- */
{
  const sheet = SHEETS.coachStart;
  SHEETS.coachStart = s => {
    if (s && s.step === 'plan' && Purchases.ready()) {
      // The plan list shows the store's prices (in the person's currency) instead of "Early access".
      let html = sheet(s);
      COACH_PLANS.forEach(p => { const k = Purchases.coachPkg(p.id); if (k && k.product) html = html.replace(new RegExp(`(data-v="${p.id}"[^>]*>[\\s\\S]*?<span class="d">)(?:Early access|\\$[^<]*)(</span>)`), (m, a, b) => a + esc(k.product.priceString) + '/month' + b); });
      return html.replace('You can change plans later.', 'Free trial for new coaches where offered. Billed monthly through the store; cancel any time.');
    }
    if (!(s && s.step === 'pay' && Purchases.ready() && Cloud.signedIn())) return sheet(s);
    const d = UI.cs || {}, plan = COACH_PLANS.find(x => x.id === d.plan) || COACH_PLANS[0], p = Purchases.coachPkg(plan.id);
    if (!p) return sheet(s);
    return sheetHead('Start your plan', `${plan.name} · up to ${plan.seats} clients`)
      + `<div class="card" style="box-shadow:none;gap:10px">
          <div class="row between"><b>${plan.name} plan</b><span class="small muted">up to ${plan.seats} clients</span></div>
          <div class="row between"><span class="small muted">Price</span><span class="small">${esc(Purchases.terms(p, 'month'))}</span></div>
        </div>
        <p class="small muted" style="margin:0">Your clients use Movla free and get Plus while they work with you. Change plans or cancel any time.</p>
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="buy-coach" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Opening checkout…' : (p.product && p.product.introPrice && p.product.introPrice.price === 0 ? 'Start free trial' : 'Subscribe')}</button>
        ${Purchases.legal()}
        <div class="row" style="justify-content:center;gap:16px"><button class="link" data-act="cs-go" data-v="plan">Change plan</button><button class="link muted" data-act="buy-restore">Restore purchases</button></div>`;
  };
}

Object.assign(ACT, {
  'buy-plus': async t => {
    const s = UI.sheet, p = Purchases.plusPkgs()[t.dataset.id];
    s.busy = true; s.error = ''; render();
    try { const r = await Purchases.buy(p); if (r === 'ok') { toast(Cloud.hasPlus() ? 'Welcome to Plus' : 'Purchase received. It can take a minute to switch on.'); } }
    catch (e) { s.error = Purchases.errText(e); }
    s.busy = false; render();
  },
  'buy-coach': async () => {
    const s = UI.sheet, d = UI.cs || {}, p = Purchases.coachPkg(d.plan || 'starter');
    s.busy = true; s.error = ''; render();
    try {
      const r = await Purchases.buy(p);
      if (r === 'ok' && !Cloud.hasCoach()) s.error = 'Payment received. Your plan can take a minute to switch on; this screen moves on by itself.';
    } catch (e) { s.error = Purchases.errText(e); }
    s.busy = false; render();   // coachstart.js moves to "done" once Cloud.hasCoach() is true
  },
  'buy-restore': async () => {
    const s = UI.sheet;
    if (s) { s.busy = true; s.error = ''; render(); }
    try { await Purchases.restore(); toast(Cloud.hasPlus() || Cloud.hasCoach() ? 'Purchases restored' : 'No purchases found for this store account'); }
    catch (e) { if (s) s.error = Purchases.errText(e); }
    if (s) { s.busy = false; render(); }
  },
  'buy-manage': () => Purchases.manage(),
});

/* Settings: a plan bought in the store can be managed from the account card. */
{
  const settings = SHEETS.settings;
  SHEETS.settings = s => {
    const html = settings(s);
    if (!Purchases.available() || !Cloud.signedIn()) return html;
    const c = Cloud.coachAccess(), p = Cloud.plusSource();
    if (!((c && c.source === 'store') || (p && p.source === 'store'))) return html;
    return html.replace('<p class="tiny faint" style="margin:0">Your plan, logs and settings are backed up privately to your account.</p>',
      '<button class="link muted" data-act="buy-manage" style="align-self:flex-start">Manage subscription</button><p class="tiny faint" style="margin:0">Your plan, logs and settings are backed up privately to your account.</p>');
  };
}

/* Follow the signed-in account: RevenueCat's App User ID is the Movla account id. */
if (typeof Cloud !== 'undefined') {
  const after = Cloud.afterSignIn, out = Cloud.signOut;
  Cloud.afterSignIn = async (...a) => { const r = await after(...a); Purchases.setup(); return r; };
  Cloud.signOut = async (...a) => { const r = await out(...a); Purchases.setup(); return r; };
  setTimeout(() => Purchases.setup(), 1200);
  if (typeof Native !== 'undefined' && Native.isNative) Native.listen('App', 'appStateChange', st => { if (st && st.isActive && Purchases.ready()) { Cloud.refreshAccess().then(render).catch(() => {}); } });
}
