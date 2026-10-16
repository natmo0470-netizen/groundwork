/* Movla — safety, privacy and data-accuracy protections (roadmap risk mitigations).
   1. Injury / unsafe targets: a short health check (based on the PAR-Q screening questions),
      pain reports that can retire an exercise from future plans, gentler plans when joints or
      pregnancy call for it, a low-intake warning, and calorie caps for pregnancy and under-18s (calc.js).
   2. Privacy: password-protected backups (AES-GCM, key from PBKDF2) and the encryption used by
      coach files; nothing leaves the device unless the user shares a file.
   3. Demo accuracy: every exercise has "Something wrong with this demo?" (advanced.js).
   4. Food accuracy: USDA results (lab-verified) first, source badges, and a check that flags
      online foods whose calories don't match their macros.
   5. Service dependence: online food search tries USDA and Open Food Facts independently with
      timeouts; either one failing still returns results from the other, and built-in foods always work. */

/* ================= crypto ================= */
const GWCrypto = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const ok = () => !!(window.crypto && crypto.subtle);
  async function passKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const rawKey = k => crypto.subtle.importKey('raw', unb64(k), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(obj, key, extra) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return Object.assign({ iv: b64(iv), ct: b64(ct) }, extra);
  }
  async function open(env, key) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, key, unb64(env.ct));
    return JSON.parse(dec.decode(pt));
  }
  return {
    ok,
    newKey: () => b64(crypto.getRandomValues(new Uint8Array(32))),
    async withPassword(obj, password, tag) { const salt = crypto.getRandomValues(new Uint8Array(16)); return seal(obj, await passKey(password, salt), { gw: tag || 'enc', v: 1, kdf: 'pbkdf2-sha256-210000', salt: b64(salt) }); },
    async openPassword(env, password) { return open(env, await passKey(password, unb64(env.salt))); },
    async withKey(obj, k, extra) { return seal(obj, await rawKey(k), extra); },
    async openKey(env, k) { return open(env, await rawKey(k)); },
  };
})();

/* ================= backups (optional password) ================= */
async function backupText() {
  const pw = (document.getElementById('bk-pw') || {}).value || UI.backupPw || '';
  if (pw && GWCrypto.ok()) return JSON.stringify(await GWCrypto.withPassword(S, pw, 'backup-enc'));
  return JSON.stringify(S, null, 1);
}
const _exportSheet = SHEETS.exportData;
SHEETS.exportData = s => _exportSheet(s).replace('<button class="btn train block" data-act="download-backup">',
  `<div class="field"><label for="bk-pw">Password (optional)</label><input class="input" id="bk-pw" type="password" autocomplete="new-password" placeholder="Protect the file with a password"><span class="tiny faint">With a password, the backup is encrypted. You'll need the same password to restore it; it can't be recovered.</span></div>
  <button class="btn train block" data-act="download-backup">`);
const _importSheet = SHEETS.importData;
SHEETS.importData = s => _importSheet(s).replace('style="font:12px ui-monospace,monospace"></textarea>', `style="font:12px ui-monospace,monospace">${esc(s.text || '')}</textarea>`).replace('<button class="btn train block" data-act="do-import">',
  `<div class="field"><label for="imp-pw">Password (only for protected backups)</label><input class="input" id="imp-pw" type="password" autocomplete="current-password"></div>
  <button class="btn train block" data-act="do-import">`);

/* ================= health check ================= */
const HEALTH_QS = [
  ['heart', 'Has a doctor said you have a heart condition or high blood pressure?'],
  ['chest', 'Do you feel pain in your chest at rest, in daily activities, or when you exercise?'],
  ['dizzy', 'Have you lost balance because of dizziness or lost consciousness in the last 12 months?'],
  ['chronic', 'Do you have another chronic condition, or take prescribed medication for one?'],
  ['joint', 'Do you have a bone, joint or soft-tissue problem that could get worse with activity?'],
  ['pregnant', 'Are you pregnant, or did you give birth or are you breastfeeding in the last 6 months?'],
  ['supervised', 'Has a doctor said you should only exercise with medical supervision?'],
];
const CLEARANCE_KEYS = ['heart', 'chest', 'dizzy', 'chronic', 'supervised'];
function needsClearance(sf) { return CLEARANCE_KEYS.some(k => sf && sf[k]); }
function healthCheckHtml(sf, act) {
  sf = sf || {};
  return `<div class="stack" style="gap:8px">${HEALTH_QS.map(([k, q]) => `<div class="toggle"><span class="small">${esc(q)}</span><div class="seg" style="flex:none"><button data-act="${act}" data-k="${k}" data-v="0" aria-pressed="${!sf[k]}">No</button><button data-act="${act}" data-k="${k}" data-v="1" aria-pressed="${!!sf[k]}">Yes</button></div></div>`).join('')}</div>
    ${needsClearance(sf) ? `<div class="banner" style="background:color-mix(in srgb,var(--warn) 14%,transparent)">${icon('info', 18)}<span><b>Check with your doctor before starting.</b> Share your plan with them; a "yes" here doesn't mean you can't train, just that a professional should OK it first.</span></div>` : ''}
    ${sf.joint ? `<p class="small muted" style="margin:0">Joint issue: jumping and high-impact moves are left out of your plan. If any exercise hurts, tap "Something hurts?" in the workout to swap it out for good.</p>` : ''}
    ${sf.pregnant ? `<p class="small muted" style="margin:0">Pregnancy or postpartum: calorie targets stay at maintenance, high-impact moves are left out, and you should follow your provider's advice on lying on your back and heavy straining.</p>` : ''}`;
}
const HIGH_IMPACT = ['jump_squat', 'burpee', 'jumping_jacks', 'high_knees', 'jump_rope', 'pistol_squat', 'skater_squat', 'mountain_climber', 'push_press'];
function isBlockedEx(e) {
  if (!e || typeof S === 'undefined' || !S) return false;
  if ((S.avoidEx || []).includes(e.id)) return true;
  const sf = S.safety || {};
  return !!((sf.joint || sf.pregnant) && HIGH_IMPACT.includes(e.id));
}
const _candidates = candidates;
candidates = function (pattern, equip, experience) { return _candidates(pattern, equip, experience).filter(e => !isBlockedEx(e)); };

/* Onboarding: the health check sits on the "your plan is ready" step. */
const _viewOnboarding = viewOnboarding;
viewOnboarding = () => {
  const html = _viewOnboarding();
  if (UI.obStep !== 6) return html;
  const o = obDraft(); o.safety = o.safety || {};
  const card = `<div class="card"><div class="card-head"><span class="eyebrow">Quick health check</span></div><p class="small muted" style="margin:0">Seven yes/no questions used by trainers before anyone starts exercising.</p>${healthCheckHtml(o.safety, 'ob-health')}</div>`;
  const marker = '<p class="tiny faint">Movla gives general fitness';
  return html.includes(marker) ? html.replace(marker, card + marker) : html;
};
const _obToState = obToState;
obToState = o => { const st = _obToState(o); st.safety = Object.assign({}, o.safety || {}); return st; };

/* Today: a clearance reminder until the user confirms. */
const _viewToday = viewToday;
viewToday = () => {
  const html = _viewToday();
  const sf = S.safety || {};
  if (!needsClearance(sf) || sf.cleared) return html;
  const note = `<div class="nudge high"><span class="ni">${icon('heart', 20)}</span><div class="stack grow" style="gap:4px"><b>Get the OK from your doctor</b><span class="small muted">Your health check suggests checking with a doctor before you start training. Show them your plan; keep sessions light until then.</span><div class="row" style="gap:14px"><button class="link" data-act="health-cleared">I've been cleared</button><button class="link muted" data-act="health-open">Review answers</button></div></div></div>`;
  const i = html.indexOf('</h1></div>');
  return i > 0 ? html.slice(0, i + 11) + note + html.slice(i + 11) : note + html;
};
/* Settings: health check entry. */
const _settings = SHEETS.settings;
SHEETS.settings = s => _settings(s).replace('<div class="card" style="box-shadow:none" id="set-profile">',
  `<div class="card" style="box-shadow:none"><span class="eyebrow">Health and safety</span>
    <button class="li" data-act="health-open"><span class="ni">${icon('heart', 20)}</span><span class="grow"><span class="t">Health check</span><br><span class="d">${needsClearance(S.safety) ? (S.safety.cleared ? 'Cleared by a doctor' : 'Doctor check recommended') : 'Seven quick questions'}</span></span><span class="chev">${icon('chevR', 18)}</span></button>
    ${(S.avoidEx || []).length ? `<button class="li" data-act="avoid-open"><span class="ni">${icon('x', 20)}</span><span class="grow"><span class="t">Exercises you've ruled out</span><br><span class="d">${S.avoidEx.length} left out of new plans</span></span><span class="chev">${icon('chevR', 18)}</span></button>` : ''}
  </div>
  <div class="card" style="box-shadow:none" id="set-profile">`);

/* ================= pain reports ================= */
const PAIN_AREAS = ['Knee', 'Lower back', 'Shoulder', 'Elbow', 'Wrist', 'Hip', 'Neck', 'Other'];
/* Exercise sheet: note when an exercise has been ruled out. */
const _exSheetSafety = SHEETS.exercise;
SHEETS.exercise = s => {
  const html = _exSheetSafety(s);
  if (!(S.avoidEx || []).includes(s.id)) return html;
  return html + `<div class="banner">${icon('info', 18)}<span class="grow">You marked this exercise as painful, so new plans leave it out.</span><button class="link" data-act="avoid-remove" data-id="${s.id}">Allow again</button></div>`;
};

Object.assign(SHEETS, {
  health() { return sheetHead('Health check', 'Based on the standard pre-exercise screening questions') + healthCheckHtml(S.safety, 'set-health') + `<p class="tiny faint">Movla gives general fitness guidance, not medical advice.</p><button class="btn train block" data-act="health-save">Save</button>`; },
  pain(s) {
    const d = s.draft, ex = EX_BY_ID[s.exId];
    const sharp = d.kind === 'sharp';
    return sheetHead('Something hurts?', esc(ex.name))
      + `<div class="field"><span class="label">Where?</span><div class="chips">${PAIN_AREAS.map(a => `<button class="chip" data-act="pain-area" data-v="${a}" aria-pressed="${d.area === a}">${a}</button>`).join('')}</div></div>
      <div class="field"><span class="label">What does it feel like?</span><div class="seg"><button data-act="pain-kind" data-v="sharp" aria-pressed="${sharp}">Sharp, pinching or in a joint</button><button data-act="pain-kind" data-v="ache" aria-pressed="${d.kind === 'ache'}">Muscle burn or ache</button></div></div>
      ${d.kind ? (sharp ? `<div class="banner" style="background:color-mix(in srgb,var(--warn) 14%,transparent)">${icon('info', 18)}<span><b>Stop this exercise for today.</b> Sharp or joint pain is a signal, not something to push through. Swap it for a different movement. If pain lasts more than a few days, gets worse, or comes with swelling or numbness, see a doctor or physical therapist.</span></div>
          <div class="toggle"><span class="small"><b>Leave it out of future plans</b><br><span class="faint">You can allow it again from the exercise page.</span></span><button class="switch" role="switch" aria-checked="${d.avoid !== false}" data-act="pain-avoid" aria-label="Leave out of future plans"></button></div>`
        : `<p class="small muted">A burn or ache in the working muscle is normal effort. If it's more than usual, lower the weight, slow down, and stop 2–3 reps short of failure. Soreness a day or two later is also normal.</p>`) : ''}
      <div class="grid2"><button class="btn ghost" data-act="pain-swap" ${d.kind ? '' : 'disabled'}>${icon('swap', 18)} Swap exercise</button><button class="btn train" data-act="pain-save" ${d.kind ? '' : 'disabled'}>Done</button></div>`;
  },
  avoidList() {
    return sheetHead('Ruled-out exercises', 'Left out of new plans and swaps')
      + `<div class="list">${(S.avoidEx || []).map(id => { const e = EX_BY_ID[id]; return e ? `<div class="li"><span class="grow"><span class="t">${esc(e.name)}</span></span><button class="link" data-act="avoid-remove" data-id="${id}">Allow again</button></div>` : ''; }).join('')}</div>`;
  },
});
function savePain(d, exId) {
  S.painLog = (S.painLog || []).concat([{ date: todayKey(), exId, area: d.area || 'Other', kind: d.kind }]);
  if (d.kind === 'sharp' && d.avoid !== false && !(S.avoidEx || []).includes(exId)) S.avoidEx = (S.avoidEx || []).concat([exId]);
}

/* ================= reminders: low intake + repeated pain ================= */
const _computeReminders = computeReminders;
computeReminders = function (state, now) {
  const out = _computeReminders(state, now);
  if (!state.onboarded || !state.reminders.enabled) return out;
  const today = dateKey(now || new Date()), T = calcTargets(state);
  const low = [1, 2, 3].map(i => addDays(today, -i)).filter(k => { const t = foodTotals(state, k); return t.kcal > 300 && t.kcal < T.floor * 0.85; });
  if (low.length === 3 && !state.dismissed['lowintake']) out.unshift({ id: 'lowintake', level: 'high', title: 'You\'ve been eating well under your target', body: `The last 3 days were below ${fmtInt(T.floor)} kcal. Eating too little costs muscle and energy. If logging was incomplete, ignore this; otherwise add a snack or two.`, action: 'tab-food', actionLabel: 'Open food log', icon: 'heart' });
  const recent = (state.painLog || []).filter(p => p.kind === 'sharp' && p.date >= addDays(today, -14));
  const areas = {}; recent.forEach(p => { areas[p.area] = (areas[p.area] || 0) + 1; });
  const hot = Object.entries(areas).find(([, n]) => n >= 2);
  if (hot && !state.dismissed['pain_' + hot[0]]) out.unshift({ id: 'pain_' + hot[0], level: 'high', title: `${hot[0]} pain reported ${hot[1]} times`, body: 'Repeated pain in the same spot is worth getting checked by a doctor or physical therapist. Meanwhile, train around it with exercises that don\'t hurt.', icon: 'heart' });
  return out;
};

/* ================= food accuracy ================= */
/* USDA search goes through our server function (the key stays private there); USDA's public DEMO_KEY is the fallback. */
async function searchUSDA(q) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 9000);
  const fn = typeof SERVICE_CONFIG !== 'undefined' && SERVICE_CONFIG.usdaFunction;
  const cloud = typeof CLOUD_CONFIG !== 'undefined' && CLOUD_CONFIG.url && CLOUD_CONFIG.anonKey;
  try {
    let data = null;
    if (fn && cloud) {
      try {
        const res = await fetch(`${CLOUD_CONFIG.url.replace(/\/$/, '')}/functions/v1/${fn}?q=${encodeURIComponent(q)}`, { headers: { apikey: CLOUD_CONFIG.anonKey }, signal: ctrl.signal });
        if (res.ok) data = await res.json();
      } catch (e) { if (ctrl.signal.aborted) throw e; }
    }
    if (!data) {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&pageSize=15&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&query=${encodeURIComponent(q)}`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      data = await res.json();
    }
    return (data.foods || []).map(usdaToFood).filter(Boolean);
  } finally { clearTimeout(timer); }
}
function usdaToFood(f) {
  const get = (nums, names) => { const n = (f.foodNutrients || []).find(x => nums.includes(String(x.nutrientNumber)) || names.includes(x.nutrientName)); return n ? n.value : null; };
  const kcal = get(['208', '957', '958'], ['Energy', 'Energy (Atwater General Factors)']);
  if (kcal == null || !f.description) return null;
  const name = f.description.charAt(0) + f.description.slice(1).toLowerCase();
  return { id: 'usda_' + f.fdcId, name, serving: '100 g', kcal: Math.round(kcal), p: round1(get(['203'], ['Protein']) || 0), c: round1(get(['205'], ['Carbohydrate, by difference']) || 0), f: round1(get(['204'], ['Total lipid (fat)']) || 0), cat: 'Online', source: 'USDA', verified: true };
}
/* Flags online foods whose label looks wrong: calories that don't match 4/4/9 from macros, or missing macros. */
function foodQuality(f) {
  if (!f || f.verified || f.source === 'built-in' || f.source === 'My food' || f.source === 'Quick add') return null;
  const calc = f.p * 4 + f.c * 4 + f.f * 9;
  if (f.kcal > 40 && calc === 0) return 'Macros are missing for this product. Check the package label.';
  if (f.kcal > 40 && Math.abs(calc - f.kcal) / f.kcal > 0.25) return `The calories (${fmtInt(f.kcal)}) don't match the macros (about ${fmtInt(calc)}). Check the package label.`;
  return null;
}
function sourceBadge(f) {
  if (f.verified || f.source === 'USDA') return '<span class="src ok">USDA</span>';
  if (f.source === 'built-in') return '';
  if (f.source === 'My food') return '<span class="src">My food</span>';
  if (f.source === 'Open Food Facts') return `<span class="src ${foodQuality(f) ? 'warn' : ''}">${foodQuality(f) ? 'Check label' : 'Community'}</span>`;
  return '';
}
const _searchOnline = searchOnlineFoods;
searchOnlineFoods = async function (q) {
  const [usda, off] = await Promise.allSettled([searchUSDA(q), _searchOnline(q)]);
  const a = usda.status === 'fulfilled' ? usda.value : [], b = off.status === 'fulfilled' ? off.value : [];
  if (usda.status === 'rejected' && off.status === 'rejected') throw new Error('offline');
  return a.slice(0, 8).concat(b);
};
const _foodPick = foodPick;
foodPick = f => _foodPick(f).replace(`${esc(f.serving)} · <span class="pcf">`, `${sourceBadge(f)}${esc(f.serving)} · <span class="pcf">`);
const _servingSheet = SHEETS.serving;
SHEETS.serving = s => { const html = _servingSheet(s); const q = foodQuality(s.food); return q ? html.replace('<div class="field"><span class="label">How much?</span>', `<div class="banner">${icon('info', 18)}<span>${esc(q)}</span></div><div class="field"><span class="label">How much?</span>`) : html; };

/* ================= actions ================= */
Object.assign(ACT, {
  'ob-health': t => { const o = obDraft(); o.safety = o.safety || {}; o.safety[t.dataset.k] = t.dataset.v === '1'; render(); },
  'health-open': () => { UI.healthDraft = Object.assign({}, S.safety || {}); pushSheet({ type: 'health', tall: true }); },
  'set-health': t => { S.safety = S.safety || {}; S.safety[t.dataset.k] = t.dataset.v === '1'; render(); },
  'health-save': () => { S.safety = S.safety || {}; if (!needsClearance(S.safety)) S.safety.cleared = false; save(); closeAll(); toast('Health check saved'); },
  'health-cleared': () => { S.safety.cleared = todayKey(); save(); render(); toast('Thanks. Train well.'); },
  'pain-report': t => { const it = S.activeWorkout.items[+t.dataset.i]; pushSheet({ type: 'pain', exId: it.exId, idx: +t.dataset.i, draft: {} }); },
  'pain-area': t => { UI.sheet.draft.area = t.dataset.v; render(); },
  'pain-kind': t => { UI.sheet.draft.kind = t.dataset.v; render(); },
  'pain-avoid': () => { const d = UI.sheet.draft; d.avoid = d.avoid === false; render(); },
  'pain-save': () => { const s = UI.sheet; savePain(s.draft, s.exId); save(); closeAll(); toast(s.draft.kind === 'sharp' ? 'Noted. Skip it today and swap it out.' : 'Noted'); },
  'pain-swap': () => { const s = UI.sheet; savePain(s.draft, s.exId); save(); UI.stack = []; UI.sheet = null; ACT.swap({ dataset: { scope: 'active', idx: String(s.idx) } }); },
  'avoid-open': () => pushSheet({ type: 'avoidList' }),
  'avoid-remove': t => { S.avoidEx = (S.avoidEx || []).filter(x => x !== t.dataset.id); save(); render(); toast('Allowed again'); },
  'download-backup': async () => {
    try {
      const text = await backupText();
      if (typeof Native !== 'undefined' && Native.isNative) { await Native.shareFile(`movla-backup-${todayKey()}.json`, text, 'Movla backup'); }
      else {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = `movla-backup-${todayKey()}.json`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
      S.lastBackup = todayKey(); save(); toast(text.includes('"backup-enc"') ? 'Encrypted backup saved' : 'Backup saved. If nothing downloaded, use Copy backup text.');
    } catch (e) { toast('Couldn\'t save the backup here. Use Copy backup text instead.'); }
  },
  'copy-export': async () => {
    const text = await backupText();
    const ok = () => toast(text.includes('"backup-enc"') ? 'Encrypted backup copied' : 'Backup copied');
    try { await navigator.clipboard.writeText(text); ok(); } catch (e) { const ta = document.getElementById('exp-text'); if (ta) { ta.value = text; ta.focus(); ta.select(); } toast('Text selected. Copy it with your device\'s copy command.'); }
  },
  'do-import': async () => {
    const readFile = f => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsText(f); });
    const file = document.getElementById('imp-file').files[0];
    const text = file ? await readFile(file) : val('imp-text');
    if (!text) { toast('Paste a backup or choose a file'); return; }
    if (UI.sheet && UI.sheet.type === 'importData') UI.sheet.text = text; // keep it if the password is wrong
    let data;
    try { data = JSON.parse(text); } catch (e) { toast('That doesn\'t look like a Movla backup'); return; }
    if (data && data.gw === 'backup-enc') {
      const pw = val('imp-pw');
      if (!pw) { toast('This backup is password-protected. Enter its password.'); return; }
      try { data = await GWCrypto.openPassword(data, pw); } catch (e) { toast('Wrong password, or the file is damaged'); return; }
    }
    if (data && data.gw === 'coach') { toast('That\'s a coach file. Open it from Settings → Coaching.'); return; }
    if (!data || !data.profile || !data.version) { toast('That doesn\'t look like a Movla backup'); return; }
    S = Object.assign(defaultState(), data); UI.loggerOpen = false; save(); closeAll(); toast('Data restored');
  },
});
