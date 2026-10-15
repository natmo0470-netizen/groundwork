/* Groundwork — invite links: the client's join flow.
   A coach sends https://<site>/?join=CODE (or groundwork://join/CODE opens the phone app).
   The person sees who invited them, creates an account (or signs in), chooses what to share,
   answers the usual setup questions if they're new, and lands in the Coach tab, linked.
   An unfinished join is remembered on this device, so a page reload or an email confirmation
   picks up where it left off. */
const JoinFlow = (() => {
  const KEY = 'groundwork.join';
  const keep = code => { try { if (code) localStorage.setItem(KEY, code); else localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };
  const saved = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const codeFrom = s => { const m = String(s || '').match(/join[/=:]+([0-9A-Fa-f]{8})\b/); return m ? m[1].toUpperCase() : null; };
  const first = n => (n || '').trim() || 'your coach';

  async function open(code) {
    if (!code || typeof Cloud === 'undefined' || !Cloud.configured()) return;
    keep(code);
    UI.stack = []; UI.sheet = null;
    UI.join = { code, step: 'loading', share: defaultShare(), mode: 'signup', email: '', pw: '', name: '' };
    render();
    if (S.coach) { UI.join.step = 'already'; render(); return; }
    let p = null;
    try { p = await Cloud.invitePreview(code); }
    catch (e) { UI.join.step = 'error'; UI.join.error = e.code === 'offline' ? 'offline' : 'server'; render(); return; }
    if (!p) { UI.join.step = 'error'; UI.join.error = 'invalid'; render(); return; }
    Object.assign(UI.join, { step: 'intro', coachName: p.coach_name, label: p.client_label || '', name: (S.profile && S.profile.name) || p.client_label || '' });
    render();
  }
  function close() { keep(null); UI.join = null; render(); }
  function next() {
    const j = UI.join;
    if (j.step === 'intro') { j.step = Cloud.signedIn() ? 'share' : 'account'; j.withAccount = j.step === 'account'; }
    render(); window.scrollTo(0, 0);
  }
  const isPhoneBrowser = () => !(typeof Native !== 'undefined' && Native.isNative) && /Android|iPhone|iPad/i.test(navigator.userAgent);

  function view() {
    const j = UI.join, coach = esc(first(j.coachName)), hasAcct = j.withAccount || !Cloud.signedIn(), steps = (hasAcct ? 1 : 0) + 1 + (S.onboarded ? 0 : 1);
    const stepNo = { account: 1, share: hasAcct ? 2 : 1 }[j.step];
    const shell = (inner, foot) => `<div class="app"><div class="ob join"><div class="stack" style="gap:18px"><div class="brand"><span class="brand-mark">${icon('bolt', 16)}</span>Groundwork</div>${inner}</div><div class="stack">${foot}</div></div></div>`;
    const avatar = `<span class="avatar xl" aria-hidden="true">${esc((j.coachName || 'C').replace(/^coach\s+/i, '').trim().charAt(0).toUpperCase() || 'C')}</span>`;
    if (j.step === 'loading') return shell(`<div class="empty" style="padding:60px 0">Opening your invite…</div>`, '');
    if (j.step === 'error') return shell(`<div class="stack" style="gap:8px"><h1 class="h1">${j.error === 'invalid' ? 'This invite link has expired' : 'Couldn\'t open the invite'}</h1>
        <p class="muted">${j.error === 'invalid' ? 'It may have been used already, or your coach cancelled it. Ask your coach to send a new link.' : j.error === 'offline' ? 'You seem to be offline. Connect to the internet and try again.' : 'Something went wrong on our side. Try again in a minute.'}</p></div>`,
      `${j.error !== 'invalid' ? `<button class="btn train block" data-act="jf-retry">Try again</button>` : ''}<button class="btn ghost block" data-act="jf-cancel">Continue to Groundwork</button>`);
    if (j.step === 'already') return shell(`<div class="stack" style="gap:8px"><h1 class="h1">You already have a coach</h1><p class="muted">You're linked with ${esc(S.coach.name)}. To switch coaches, leave in Settings → Coaching first, then open the new link again.</p></div>`,
      `<button class="btn train block" data-act="jf-done">Go to your Coach tab</button><button class="btn ghost block" data-act="jf-cancel">Close</button>`);
    if (j.step === 'intro') return shell(`<div class="join-hero">${avatar}<span class="eyebrow">You're invited</span><h1 class="h1">Train with ${coach}</h1>
        <p class="muted" style="margin:0">${coach} invited you${j.label ? ` (as ${esc(j.label)})` : ''} to Groundwork, a workout and nutrition app. It takes about 2 minutes to get set up.</p></div>
      <div class="card"><div class="join-list">
        <div>${icon('dumbbell', 18)}<span><b>Plans and targets from ${coach}</b><br><span class="small muted">Nothing changes until you approve it.</span></span></div>
        <div>${icon('chat', 18)}<span><b>Message each other</b><br><span class="small muted">Right in the app's Coach tab.</span></span></div>
        <div>${icon('check', 18)}<span><b>You choose what ${coach} sees</b><br><span class="small muted">Change it, pause it or leave any time.</span></span></div></div></div>`,
      `<button class="btn train block" data-act="jf-next">Get started</button>
       ${isPhoneBrowser() ? `<a class="btn ghost block" href="groundwork://join/${esc(j.code)}">Open in the Groundwork app</a>` : ''}
       <button class="link muted" data-act="jf-cancel" style="align-self:center">Not now</button>`);
    if (j.step === 'account') {
      const up = j.mode === 'signup';
      return shell(`<div class="stack" style="gap:6px"><span class="eyebrow">${steps > 1 ? `Step ${stepNo} of ${steps}` : 'One step'}</span><h1 class="h1">${up ? 'Create your account' : 'Sign in'}</h1>
          <p class="muted" style="margin:0">${up ? `So you and ${coach} stay in sync. Your data stays private to you.` : 'Use the account you already have. Your data comes with you.'}</p></div>
        ${up && !S.onboarded ? `<div class="field"><label for="jf-name">First name</label><input class="input" id="jf-name" data-jf="name" autocomplete="given-name" value="${esc(j.name || '')}"></div>` : ''}
        <div class="field"><label for="jf-email">Email</label><input class="input" id="jf-email" type="email" inputmode="email" autocomplete="email" data-jf="email" value="${esc(j.email || '')}"></div>
        <div class="field"><label for="jf-pw">Password</label><input class="input" id="jf-pw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}" data-jf="pw" value="${esc(j.pw || '')}">${up ? '<span class="tiny faint">At least 8 characters</span>' : ''}</div>
        ${j.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(j.error)}</p>` : ''}${j.notice ? `<div class="banner">${icon('info', 18)}<span>${esc(j.notice)}</span></div>` : ''}`,
        `<button class="btn train block" data-act="jf-account" ${j.busy ? 'disabled' : ''}>${j.busy ? 'One moment…' : up ? 'Create account' : 'Sign in'}</button>
         <button class="link" data-act="jf-mode" style="align-self:center">${up ? 'I already have an account' : 'I need to create an account'}</button>
         <p class="tiny faint" style="margin:0;text-align:center">By continuing you agree to the <a href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p>`);
    }
    if (j.step === 'share') return shell(`<div class="stack" style="gap:6px"><span class="eyebrow">${steps > 1 ? `Step ${stepNo} of ${steps}` : 'One step'}</span><h1 class="h1">What can ${coach} see?</h1>
        <p class="muted" style="margin:0">${coach} can always send you plans and nutrition goals. You decide what they see of your progress.</p></div>
      <div class="card">${shareControls(j.share, 'jf-share', j.coachName)}</div>${j.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(j.error)}</p>` : ''}`,
      `<button class="btn train block" data-act="jf-link" ${j.busy ? 'disabled' : ''}>${j.busy ? 'Linking…' : `Link with ${coach}`}</button>`);
    if (j.step === 'done') return shell(`<div class="join-hero">${avatar}<span class="eyebrow">All set</span><h1 class="h1">You're linked with ${coach}</h1>
        <p class="muted" style="margin:0">Your progress now syncs to ${coach}, limited to what you chose. Plans they send show up in your Coach tab for you to approve.</p></div>`,
      `<button class="btn train block" data-act="jf-done">Say hi to ${coach}</button>`);
    return '';
  }

  /* ---------- actions ---------- */
  Object.assign(ACT, {
    'jf-next': next,
    'jf-retry': () => open(UI.join.code),
    'jf-cancel': close,
    'jf-mode': () => { const j = UI.join; j.mode = j.mode === 'signup' ? 'signin' : 'signup'; j.error = ''; j.notice = ''; render(); },
    'jf-share': t => { const sh = UI.join.share, k = t.dataset.k; sh[k] = !sh[k]; render(); },
    'jf-account': async () => {
      const j = UI.join, mail = (j.email || '').trim(), pw = j.pw || '';
      if (!/^\S+@\S+\.\S+$/.test(mail)) { j.error = 'Enter your email address.'; render(); return; }
      if (!pw) { j.error = 'Enter a password.'; render(); return; }
      if (j.mode === 'signup' && pw.length < 8) { j.error = 'Use a password of at least 8 characters.'; render(); return; }
      j.error = ''; j.busy = true; render();
      try {
        if (j.mode === 'signup') {
          const r = await Cloud.signUp(mail, pw);
          if (r.confirm) { j.busy = false; j.mode = 'signin'; j.notice = 'Check your email and tap the confirmation link. It brings you back here to finish.'; render(); return; }
        } else await Cloud.signIn(mail, pw);
        if (j.name && !S.onboarded) obDraft().name = j.name.trim();
        const res = await Cloud.afterSignIn();
        j.busy = false; j.pw = '';
        if (S.coach) { j.step = 'already'; render(); return; }
        j.step = 'share'; render(); window.scrollTo(0, 0);
        if (res === 'choose') pushSheet({ type: 'cloudChoice' });
      } catch (e) { j.busy = false; j.error = Cloud.friendlyAuthError(e); render(); }
    },
    'jf-link': async () => {
      const j = UI.join; if (j.busy) return;
      j.busy = true; j.error = ''; render();
      try {
        const r = await Cloud.acceptInvite(j.code, Object.assign({}, j.share));
        S.coach = { cloud: true, linkId: r.linkId, id: r.coachId, name: r.coachName, clientId: Cloud.me(), linkedAt: todayKey(), lastSent: null, share: Object.assign(defaultShare(), r.share || j.share) };
        save(); keep(null);
        if (!S.onboarded) {   // new here: the usual setup questions, then the Coach tab
          UI.joinOb = r.coachName; UI.join = null; UI.obStep = 1; if (j.name) obDraft().name = j.name.trim();
          render(); window.scrollTo(0, 0); return;
        }
        j.busy = false; j.step = 'done'; render(); Cloud.syncNow();
      } catch (e) {
        j.busy = false;
        if (/already linked/i.test(e.message)) {   // linked on the server already: pick that link up
          const l = await Cloud.activeLink().catch(() => null);
          if (l) { S.coach = { cloud: true, linkId: l.linkId, id: l.coachId, name: l.coachName, clientId: Cloud.me(), linkedAt: l.linkedAt, lastSent: null, share: Object.assign(defaultShare(), l.share || {}) }; save(); keep(null); j.step = S.onboarded ? 'done' : j.step; if (!S.onboarded) { UI.joinOb = l.coachName; UI.join = null; UI.obStep = 1; } render(); return; }
        }
        j.error = /not found|already used/i.test(e.message) ? 'This invite was just used or cancelled. Ask your coach for a new link.'
          : /own invite/i.test(e.message) ? 'This is your own invite link. Send it to your client instead.'
          : e.code === 'offline' ? 'No connection. Check your internet and try again.' : 'Couldn\'t link: ' + (e.message || 'try again');
        render();
      }
    },
    'jf-done': () => { UI.join = null; keep(null); UI.tab = 'coach'; UI.sheet = null; UI.stack = []; render(); window.scrollTo(0, 0); },
  });
  document.addEventListener('input', e => { const el = e.target; if (el && el.dataset && el.dataset.jf && UI.join) UI.join[el.dataset.jf] = el.value; });

  /* ---------- hooks ---------- */
  const _render = render;
  render = function () {
    if (!UI.join) { _render(); return; }
    const root = document.getElementById('root');
    root.innerHTML = view() + (UI.sheet ? `<div class="scrim" data-act="close-sheet"></div>${sheetHtml()}` : '') + (UI.toast ? `<div class="toast" role="status">${esc(UI.toast)}</div>` : '');
  };
  // Setup after joining: a banner on each question, then straight to the Coach tab.
  const _ob = viewOnboarding;
  viewOnboarding = function () {
    const html = _ob();
    if (!UI.joinOb || UI.obStep === 0) return html;
    return html.replace('<div class="ob">', `<div class="ob"><div class="banner" style="background:var(--train-soft)">${icon('check', 18)}<span><b>Last step:</b> you're linked with ${esc(UI.joinOb)}. A few questions so your plan fits you.</span></div>`);
  };
  const _finish = ACT['ob-finish'];
  ACT['ob-finish'] = () => {
    const coach = S.coach, joined = UI.joinOb;
    _finish();
    if (coach) { S.coach = coach; save(); }
    if (joined) { UI.joinOb = null; UI.tab = 'coach'; render(); toast(`You're all set. Say hi to ${joined}.`); if (typeof Cloud !== 'undefined') Cloud.syncNow(); }
  };
  // Back from step 1 during a join returns to the join screen rather than the generic welcome.
  const _back = ACT['ob-back'];
  ACT['ob-back'] = () => { if (UI.joinOb && UI.obStep === 1) return; _back(); };

  /* ---------- where invites come from ---------- */
  function boot() {
    if (typeof Cloud === 'undefined' || !Cloud.configured()) return;
    let code = null;
    try {
      const q = new URLSearchParams(location.search);
      code = codeFrom('join=' + (q.get('join') || '')) || codeFrom(location.hash);
      if (code) { q.delete('join'); const qs = q.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + (/join/.test(location.hash) ? '' : location.hash)); }
    } catch (e) { /* ignore */ }
    code = code || saved();
    if (code) setTimeout(() => open(code), 50);
    // The phone app opened from groundwork://join/CODE or an invite web link.
    if (typeof Native !== 'undefined' && Native.isNative && Native.listen) Native.listen('App', 'appUrlOpen', ev => { const c = codeFrom(ev && ev.url); if (c) open(c); });
  }
  return { open, close, boot, codeFrom };
})();
JoinFlow.boot();
