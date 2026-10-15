/* Groundwork — becoming a coach.
   Modelled on the onboarding of popular coaching platforms: a short pitch, an account, the coaching
   business, optional credentials, a plan by client seats, then "invite your first client".
   Coach tools unlock only when the server reports an active coach plan for the account (bought at
   launch, or granted by the Groundwork team now), so the old Settings switch can't be flipped on. */
(() => {
  if (typeof Cloud === 'undefined' || !Cloud.configured()) return;
  const SPECIALTIES = [['strength', 'Strength'], ['muscle', 'Muscle building'], ['fatloss', 'Fat loss'], ['nutrition', 'Nutrition'], ['sport', 'Sport performance'], ['beginners', 'Beginners'], ['older', 'Older adults'], ['postnatal', 'Pre/postnatal'], ['rehab', 'Injury-aware training']];
  const COUNTS = [['0', 'None yet'], ['3', '1–5'], ['10', '6–15'], ['30', '16–40'], ['80', '41–100'], ['150', '100+']];
  const CERTS = ['None yet', 'NASM', 'ACE', 'ISSA', 'NSCA', 'ACSM', 'NCSF', 'Other'];
  const STEPS = ['business', 'creds', 'plan', 'pay'];
  const draft = () => UI.cs || (UI.cs = { display_name: (S.coachMode && S.coachMode.name) || (S.profile && S.profile.name) || '', business_name: '', coaching_type: 'hybrid', specialties: [], client_count: null, certification: 'None yet', cert_number: '', plan: null });
  const suggestPlan = n => (COACH_PLANS.find(p => p.seats >= Math.max(1, Number(n) || 0) * 1.2) || COACH_PLANS[COACH_PLANS.length - 1]).id;
  const stepHead = (s, title, sub) => sheetHead(title, `Step ${STEPS.indexOf(s.step) + 1} of ${STEPS.length} · ${sub}`);

  SHEETS.coachStart = s => {
    const d = draft(), step = s.step || 'intro';
    if (step === 'intro') return sheetHead('Coach on Groundwork', 'For personal trainers and online coaches')
      + `<div class="card train" style="box-shadow:none"><div class="join-list">
          <div>${icon('user', 18)}<span><b>Your clients use Groundwork free</b><br><span class="small muted">You pay by number of clients; they get every feature, no ads.</span></span></div>
          <div>${icon('dumbbell', 18)}<span><b>Programs and nutrition targets</b><br><span class="small muted">Assign a program or your own workouts and macros; clients approve them in their app.</span></span></div>
          <div>${icon('chart', 18)}<span><b>Live progress</b><br><span class="small muted">Sessions, weigh-ins, food totals and pain reports, limited to what each client shares.</span></span></div>
          <div>${icon('chat', 18)}<span><b>Messaging and invite links</b><br><span class="small muted">One link brings a client in and lands them in your chat.</span></span></div></div></div>
        <p class="small muted" style="margin:0">${(PRICING.showPrices || testCheckout()) ? `Plans from $${COACH_PLANS[0].monthly}/month for ${COACH_PLANS[0].seats} clients, with a ${PRICING.trialDays}-day free trial.` : 'Plans are by number of clients, from 5 to 100. During early access coach plans are set up by the Groundwork team.'}</p>
        <button class="btn train block" data-act="cs-go" data-v="business">${Cloud.signedIn() ? 'Get started' : 'Create a coach account'}</button>
        ${Cloud.signedIn() ? '' : '<button class="link" data-act="cs-signin" style="align-self:center">I already have an account</button>'}`;
    if (step === 'business') return stepHead(s, 'Your coaching business', 'This is what clients see')
      + `<div class="field"><label for="cs-name">Your name</label><input class="input" id="cs-name" data-cs="display_name" maxlength="80" value="${esc(d.display_name)}" placeholder="e.g. Dana Ruiz"></div>
        <div class="field"><label for="cs-biz">Business name <span class="faint">(optional)</span></label><input class="input" id="cs-biz" data-cs="business_name" maxlength="80" value="${esc(d.business_name)}" placeholder="e.g. Ruiz Strength"></div>
        <div class="field"><span class="label">How you coach</span><div class="seg">${[['in_person', 'In person'], ['online', 'Online'], ['hybrid', 'Both']].map(([k, l]) => `<button data-act="cs-set" data-k="coaching_type" data-v="${k}" aria-pressed="${d.coaching_type === k}">${l}</button>`).join('')}</div></div>
        <div class="field"><span class="label">Specialties <span class="faint">(pick any)</span></span><div class="chips">${SPECIALTIES.map(([k, l]) => `<button class="chip" data-act="cs-spec" data-v="${k}" aria-pressed="${d.specialties.includes(k)}">${l}</button>`).join('')}</div></div>
        <div class="field"><span class="label">Clients you coach today</span><div class="chips">${COUNTS.map(([v, l]) => `<button class="chip" data-act="cs-set" data-k="client_count" data-v="${v}" aria-pressed="${String(d.client_count) === v}">${l}</button>`).join('')}</div></div>
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="cs-go" data-v="creds">Continue</button>`;
    if (step === 'creds') return stepHead(s, 'Credentials', 'Optional, shown to clients as self-reported')
      + `<div class="field"><span class="label">Certification</span><div class="chips">${CERTS.map(c => `<button class="chip" data-act="cs-set" data-k="certification" data-v="${esc(c)}" aria-pressed="${d.certification === c}">${esc(c)}</button>`).join('')}</div></div>
        ${d.certification !== 'None yet' ? `<div class="field"><label for="cs-cert">Certificate number <span class="faint">(optional)</span></label><input class="input" id="cs-cert" data-cs="cert_number" maxlength="60" value="${esc(d.cert_number)}"></div>` : ''}
        <p class="tiny faint" style="margin:0">Groundwork doesn't check certifications yet. Coaches are independent; see the Terms of Use.</p>
        <button class="btn train block" data-act="cs-go" data-v="plan">Continue</button><button class="link" data-act="cs-go" data-v="business" style="align-self:center">Back</button>`;
    if (step === 'plan') {
      const rec = suggestPlan(d.client_count); if (!d.plan) d.plan = rec;
      return stepHead(s, 'Choose a plan', 'By number of clients; your clients use Groundwork free')
        + `<div class="list">${COACH_PLANS.map(p => `<button class="li" data-act="cs-set" data-k="plan" data-v="${p.id}" aria-pressed="${d.plan === p.id}"><span class="grow"><span class="t">${p.name} · up to ${p.seats} clients</span><br><span class="d">${(PRICING.showPrices || testCheckout()) ? `$${p.monthly}/month · about $${(p.monthly / p.seats).toFixed(2)} per client` : 'Early access'}</span></span>${p.id === rec ? '<span class="tag train">Suggested</span>' : ''}${d.plan === p.id ? `<span class="chev">${icon('check', 18)}</span>` : ''}</button>`).join('')}</div>
        <p class="tiny faint" style="margin:0">${(PRICING.showPrices || testCheckout()) ? `${PRICING.trialDays}-day free trial, then billed monthly. Cancel any time.` : 'You can change plans later.'}</p>
        <button class="btn train block" data-act="cs-plan-next" ${s.busy ? 'disabled' : ''}>${s.busy ? 'One moment…' : 'Continue'}</button><button class="link" data-act="cs-go" data-v="creds" style="align-self:center">Back</button>`;
    }
    if (step === 'pay' && Cloud.testCheckout()) {
      const p = COACH_PLANS.find(x => x.id === d.plan) || COACH_PLANS[0];
      return stepHead(s, 'Start your free trial', 'Test checkout')
        + `<div class="banner">${icon('info', 18)}<span class="small"><b>Test mode.</b> No payment is taken. At launch this step becomes the real checkout.</span></div>
        <div class="card" style="box-shadow:none;gap:10px">
          <div class="row between"><b>${p.name} plan</b><span class="small muted">up to ${p.seats} clients</span></div>
          <div class="row between"><span class="small muted">After your ${PRICING.trialDays}-day trial</span><span class="small">$${p.monthly}/month</span></div>
          <div class="row between"><b>Due today</b><b>$0.00</b></div>
        </div>
        <p class="tiny faint" style="margin:0">Your clients use Groundwork free. You can change plans or cancel any time.</p>
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="cs-test-pay" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Starting…' : `Start ${PRICING.trialDays}-day free trial`}</button><button class="link" data-act="cs-go" data-v="plan" style="align-self:center">Change plan</button>`;
    }
    if (step === 'pay') return stepHead(s, 'Start your plan', 'Early access')
      + `<div class="card" style="box-shadow:none;gap:8px"><b>We've saved your coach profile.</b><p class="small muted" style="margin:0">Coach plans can't be bought in the app yet. During early access the Groundwork team switches coach plans on for each coach. Once yours is on, this screen moves on by itself, or tap Check again.</p></div>
        ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
        <button class="btn train block" data-act="cs-check" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Checking…' : 'Check again'}</button><button class="btn ghost block" data-act="close-sheet">I'll come back later</button>`;
    // done
    const plan = coachPlan();
    return sheetHead("You're set up as a coach", `${plan.name} plan · up to ${plan.seats} clients`)
      + `<div class="card train" style="box-shadow:none"><p class="small" style="margin:0">Next: invite your first client. They get a link, create a free account, choose what to share and land in a chat with you.</p></div>
        ${S.onboarded ? '' : '<p class="small muted" style="margin:0">First, a few quick questions to set up your own training. Keep it simple; you can skip ahead.</p>'}
        <button class="btn train block" data-act="cs-finish">${S.onboarded ? 'Invite your first client' : 'Continue'}</button>`;
  };

  function enableCoachMode() {
    const d = draft(), a = Cloud.coachAccess();
    S.coachMode = Object.assign({ clients: [], id: 'co_' + uid() }, S.coachMode || {}, { on: true, plan: (a && a.plan) || d.plan || 'starter', name: (d.display_name || '').trim() || (S.coachMode && S.coachMode.name) || S.profile.name || 'Coach' });
    save(); Cloud.syncNow();
  }
  const goto = step => { UI.sheet.step = step; UI.sheet.error = ''; render(); const sh = document.querySelector('.sheet'); if (sh) sh.scrollTop = 0; };
  Object.assign(ACT, {
    'coach-start': () => {
      if (Cloud.signedIn() && Cloud.hasCoach()) { enableCoachMode(); UI.stack = []; UI.sheet = { type: 'coachStart', step: 'done', tall: true }; render(); return; }
      UI.stack = []; UI.sheet = { type: 'coachStart', step: 'intro', tall: true }; render();
    },
    'cs-signin': () => pushSheet({ type: 'account', mode: 'signin', email: '', pw: '', after: 'coachStart', afterState: { step: 'business' } }),
    'cs-go': t => {
      const to = t.dataset.v, d = draft();
      if (to === 'business' && !Cloud.signedIn()) { pushSheet({ type: 'account', mode: 'signup', email: '', pw: '', after: 'coachStart', afterState: { step: 'business' }, reason: 'Coaching runs on accounts, so you and your clients stay in sync.' }); return; }
      if (to === 'creds' && !(d.display_name || '').trim()) { UI.sheet.error = 'Add the name clients will see.'; render(); return; }
      if (to === 'creds' && d.client_count == null) { UI.sheet.error = 'Choose how many clients you coach today.'; render(); return; }
      goto(to);
    },
    'cs-set': t => { const d = draft(); d[t.dataset.k] = t.dataset.k === 'client_count' ? Number(t.dataset.v) : t.dataset.v; if (t.dataset.k === 'client_count') d.plan = null; UI.sheet.error = ''; render(); },
    'cs-spec': t => { const d = draft(), v = t.dataset.v; d.specialties = d.specialties.includes(v) ? d.specialties.filter(x => x !== v) : d.specialties.concat([v]); render(); },
    'cs-plan-next': async () => {
      const s = UI.sheet, d = draft(); s.busy = true; render();
      try {
        await Cloud.saveCoachProfile({ display_name: d.display_name.trim().slice(0, 80), business_name: d.business_name.trim().slice(0, 80), coaching_type: d.coaching_type, specialties: d.specialties, certification: d.certification === 'None yet' ? '' : d.certification, cert_number: d.cert_number.trim().slice(0, 60), client_count: d.client_count, plan_wanted: d.plan });
        await Cloud.refreshAccess();
      } catch (e) { s.busy = false; s.error = e.code === 'offline' ? 'No connection. Check your internet and try again.' : 'Couldn\'t save: ' + (e.message || 'try again'); render(); return; }
      s.busy = false;
      if (Cloud.hasCoach()) { enableCoachMode(); goto('done'); } else goto('pay');
    },
    'cs-test-pay': async () => {
      const s = UI.sheet, d = draft(); s.busy = true; s.error = ''; render();
      try { await Cloud.startTestPlan(d.plan || 'starter'); } catch (e) { s.busy = false; s.error = e.code === 'offline' ? 'No connection. Check your internet and try again.' : 'Couldn\'t start the trial: ' + (e.message || 'try again'); render(); return; }
      s.busy = false;
      if (Cloud.hasCoach()) { enableCoachMode(); goto('done'); } else { s.error = 'The trial didn\'t start. Try again.'; render(); }
    },
    'cs-check': async () => {
      const s = UI.sheet; s.busy = true; render();
      try { await Cloud.refreshAccess(); } catch (e) { /* offline */ }
      s.busy = false;
      if (Cloud.hasCoach()) { enableCoachMode(); goto('done'); } else { s.error = 'Not switched on yet. We\'ll pick it up automatically next time you open the app.'; render(); }
    },
    'cs-finish': () => {
      UI.stack = []; UI.sheet = null; UI.cs = null;
      if (!S.onboarded) { UI.coachOb = true; UI.obStep = 1; render(); window.scrollTo(0, 0); return; }
      UI.tab = 'clients'; render(); ACT['coach-add']();
    },
  });
  document.addEventListener('input', e => { const el = e.target; if (el && el.dataset && el.dataset.cs != null && UI.cs) UI.cs[el.dataset.cs] = el.value; });

  // A coach who signs up before setting up their own training: a banner during setup, then the Clients tab.
  const _ob = viewOnboarding;
  viewOnboarding = function () {
    const html = _ob();
    if (!UI.coachOb || UI.obStep === 0) return html;
    return html.replace('<div class="ob">', `<div class="ob"><div class="banner" style="background:var(--train-soft)">${icon('check', 18)}<span><b>Last step:</b> your coach account is ready. A few questions about your own training.</span></div>`);
  };
  const _finish = ACT['ob-finish'];
  ACT['ob-finish'] = () => {
    const keep = S.coachMode, wasCoach = UI.coachOb;
    _finish();
    if (keep) { S.coachMode = keep; save(); }
    if (wasCoach) { UI.coachOb = null; UI.tab = 'clients'; render(); ACT['coach-add'](); }
  };
  // The plan can be switched on while the app is open: move on from the waiting screen.
  const _render = render;
  render = function () {
    _render();
    if (UI.sheet && UI.sheet.type === 'coachStart' && UI.sheet.step === 'pay' && Cloud.hasCoach() && !UI.sheet.busy) { enableCoachMode(); UI.sheet.step = 'done'; setTimeout(render, 0); }
  };
})();
