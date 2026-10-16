/* Movla — feedback and feature ideas.
   One quiet entry in Settings ("Feedback & ideas"); nothing pops up on its own. Notes go to the
   feedback table (migration 008, insert-only) whether or not the person has an account. If the phone
   is offline, the note waits on the device and sends next time the app opens. Builds without cloud
   settings fall back to an email to support@movla.app. */
const APP_VERSION = '1.21.0';

const Feedback = (() => {
  const KINDS = [
    ['idea', 'Feature idea', 'What would you like Movla to do? The more specific the better.'],
    ['problem', 'Something\'s broken', 'What happened, and what did you expect? Which screen were you on?'],
    ['confusing', 'Something\'s confusing', 'What was hard to find or understand?'],
    ['praise', 'Something I like', 'What\'s working well for you?'],
    ['other', 'Other', 'Tell us anything.'],
  ];
  const AREAS = ['Workouts', 'Nutrition', 'My meals', 'Progress', 'Coaching', 'Watch & scale', 'Account', 'Other'];
  const online = () => typeof Cloud !== 'undefined' && Cloud.configured();
  const platform = () => (typeof Native !== 'undefined' && Native.isNative ? Native.platform : 'web');
  const queue = () => (S.feedbackQueue = S.feedbackQueue || []);

  function row(d) {
    return {
      kind: d.kind, area: (d.area || '').slice(0, 40), message: d.message.trim().slice(0, 2000),
      rating: d.rating || null, contact: d.reply ? (d.contact || '').trim().slice(0, 200) : '',
      app_version: APP_VERSION, platform: platform(),
    };
  }
  async function send(r) { await Cloud.sendFeedback(r); }
  async function flush() {
    if (!online() || !queue().length || flush.busy) return;
    flush.busy = true;
    try { while (queue().length) { await send(queue()[0]); queue().shift(); save(); } } catch (e) { /* still offline; try again later */ }
    flush.busy = false;
  }
  // Notes saved by the earlier test-only form, never sent anywhere.
  function oldNotes() {
    return (S.feedback || []).filter(f => !f.sent && (f.confusing || f.missing || f.rating)).map(f => ({
      kind: f.missing ? 'idea' : 'confusing', area: (f.areas || []).join(', ').slice(0, 40),
      message: [f.confusing && 'Confusing: ' + f.confusing, f.missing && 'Missing: ' + f.missing].filter(Boolean).join('\n') || `Ease rating ${f.rating}/5`,
      rating: f.rating || null, contact: '', app_version: 'test', platform: platform(),
    }));
  }

  SHEETS.feedback = s => {
    const d = s.draft || (s.draft = {});
    if (s.sent) {
      return sheetHead('Thank you', '')
        + `<div class="card" style="box-shadow:none;gap:8px">${icon('check', 22)}<p style="margin:0">${s.queued ? 'Saved. It will send automatically next time you\'re online.' : 'Sent. Every note is read, and ideas go on the list for upcoming versions.'}</p></div>
          <button class="btn train block" data-act="close-sheet">Done</button><button class="link" data-act="fb-another" style="align-self:center">Send another</button>`;
    }
    const k = KINDS.find(x => x[0] === d.kind);
    const email = online() && Cloud.signedIn() ? Cloud.email() : '';
    if (d.contact == null) d.contact = email || '';
    const old = oldNotes().length;
    return sheetHead('Feedback & ideas', 'Tell us what to build, fix or keep. It takes a minute.')
      + `<div class="field"><span class="label">What's it about?</span><div class="chips">${KINDS.map(([id, label]) => `<button class="chip" data-act="fb-kind" data-v="${id}" aria-pressed="${d.kind === id}">${label}</button>`).join('')}</div></div>
      ${d.kind ? `
      <div class="field"><span class="label">Which part of the app? <span class="faint">(optional)</span></span><div class="chips">${AREAS.map(a => `<button class="chip" data-act="fb-pick-area" data-v="${a}" aria-pressed="${d.area === a}">${a}</button>`).join('')}</div></div>
      <div class="field"><label for="fb-msg">${d.kind === 'idea' ? 'Your idea' : 'Details'}</label><textarea class="input" id="fb-msg" rows="5" maxlength="2000" data-fbx="message" placeholder="${esc(k[2])}">${esc(d.message || '')}</textarea></div>
      <div class="field"><span class="label">How easy is Movla to use? <span class="faint">(optional)</span></span><div class="seg">${[1, 2, 3, 4, 5].map(n => `<button data-act="fb-rate" data-v="${n}" aria-pressed="${d.rating === n}" aria-label="${n} of 5">${n}</button>`).join('')}</div><div class="row between tiny faint"><span>Hard</span><span>Easy</span></div></div>
      <label class="consent small" style="align-items:center;padding:10px 12px"><input type="checkbox" data-fbx="reply" ${d.reply ? 'checked' : ''}><span>It's OK to email me about this</span></label>
      ${d.reply ? `<div class="field"><label for="fb-contact">Your email</label><input class="input" id="fb-contact" type="email" inputmode="email" autocomplete="email" data-fbx="contact" value="${esc(d.contact || '')}"></div>` : ''}
      ${s.error ? `<p class="small" role="alert" style="margin:0;color:var(--bad)">${esc(s.error)}</p>` : ''}
      <button class="btn train block" data-act="fb-send" ${s.busy ? 'disabled' : ''}>${s.busy ? 'Sending…' : online() ? 'Send' : 'Send by email'}</button>
      <p class="tiny faint" style="margin:0">We get your note, the app version and phone type, and your email only if you add it. Nothing else about your data is included.</p>` : ''}
      ${old ? `<div class="divider"></div><div class="row between"><span class="small muted">${old} note${old > 1 ? 's' : ''} saved on this phone during testing</span><button class="link" data-act="fb-send-old">Send ${old > 1 ? 'them' : 'it'}</button></div>` : ''}
      <p class="tiny faint" style="margin:0">Prefer email? <a href="mailto:support@movla.app?subject=Movla%20feedback">support@movla.app</a></p>`;
  };

  Object.assign(ACT, {
    'open-feedback': () => pushSheet({ type: 'feedback', draft: {} }),
    'fb-kind': t => { UI.sheet.draft.kind = t.dataset.v; UI.sheet.error = ''; render(); setTimeout(() => { const m = document.getElementById('fb-msg'); if (m && !m.value) m.focus(); }, 50); },
    'fb-pick-area': t => { const d = UI.sheet.draft; d.area = d.area === t.dataset.v ? '' : t.dataset.v; render(); },
    'fb-rate': t => { const d = UI.sheet.draft; const n = Number(t.dataset.v); d.rating = d.rating === n ? null : n; render(); },
    'fb-another': () => { UI.sheet = { type: 'feedback', draft: {} }; render(); },
    'fb-send': async () => {
      const s = UI.sheet, d = s.draft;
      if (!d.kind) { s.error = 'Choose what it\'s about.'; render(); return; }
      if (!(d.message || '').trim()) { s.error = 'Add a few words first.'; render(); const m = document.getElementById('fb-msg'); if (m) m.focus(); return; }
      if (d.reply && d.contact && !/^\S+@\S+\.\S+$/.test(d.contact.trim())) { s.error = 'That email doesn\'t look right.'; render(); return; }
      const r = row(d);
      if (!online()) {
        const body = `${KINDS.find(x => x[0] === d.kind)[1]}${d.area ? ' · ' + d.area : ''}${d.rating ? ' · ease ' + d.rating + '/5' : ''}\n\n${r.message}\n\n(Movla ${APP_VERSION}, ${r.platform})`;
        location.href = `mailto:support@movla.app?subject=${encodeURIComponent('Movla feedback')}&body=${encodeURIComponent(body)}`;
        return;
      }
      s.busy = true; s.error = ''; render();
      try { await send(r); s.sent = true; }
      catch (e) {
        if (e && (e.code === 'offline' || e.status === 0)) { queue().push(r); save(); s.sent = true; s.queued = true; }
        else s.error = (e && e.message) || 'Couldn\'t send. Try again.';
      }
      s.busy = false; render();
    },
    'fb-send-old': async () => {
      const notes = oldNotes(); if (!notes.length) return;
      if (!online()) { toast('Sending needs the internet'); return; }
      notes.forEach(n => queue().push(n));
      (S.feedback || []).forEach(f => { f.sent = true; });
      save(); await flush(); render();
      toast(queue().length ? 'Saved. They\'ll send when you\'re online.' : `Sent ${notes.length} note${notes.length > 1 ? 's' : ''}. Thank you!`);
    },
  });
  document.addEventListener('input', e => { const t = e.target; if (t && t.dataset && t.dataset.fbx && UI.sheet && UI.sheet.type === 'feedback') { const d = UI.sheet.draft; if (t.type === 'checkbox') return; d[t.dataset.fbx] = t.value; } });
  document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.fbx === 'reply' && UI.sheet && UI.sheet.type === 'feedback') { UI.sheet.draft.reply = t.checked; render(); } });

  // Send anything that was waiting for a connection.
  setTimeout(flush, 4000);
  window.addEventListener('online', () => flush());

  // Settings: a plain entry, worded for ideas as well as problems.
  const settings = SHEETS.settings;
  SHEETS.settings = s => settings(s).replace(/<span class="t">Send feedback<\/span><br><span class="d">[^<]*<\/span>/, '<span class="t">Feedback &amp; ideas</span><br><span class="d">Request a feature, report a problem, or tell us what works</span>');

  return { flush, queue };
})();
