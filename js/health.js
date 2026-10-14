/* Groundwork — Apple Health / Android Health Connect (Phase 3, on-phone data only).
   Reads: daily steps, active calories, sleep, resting heart rate, body weight and workouts
   recorded by other apps and watches. Writes: body weight logged in Groundwork.
   Data stays on the phone. No accounts or outside servers: Garmin, Fitbit and Strava
   sign-ins come later. Uses @capgo/capacitor-health; does nothing on the website. */

const HealthSync = (() => {
  const PLUGIN = 'Health';
  const READ = ['steps', 'calories', 'sleep', 'restingHeartRate', 'weight', 'workouts'];
  const WRITE = ['weight'];
  const ok = () => typeof Native !== 'undefined' && Native.isNative && Native.available(PLUGIN);
  const call = (m, o) => Native.call(PLUGIN, m, o);
  const name = () => (typeof Native !== 'undefined' && Native.platform === 'ios') ? 'Apple Health' : 'Health Connect';
  const iso = d => new Date(d).toISOString();
  const dayStart = k => parseKey(k).getTime();
  const localKey = isoStr => dateKey(new Date(isoStr));

  async function available() {
    if (!ok()) return { available: false, reason: 'Only in the phone app' };
    try { return await call('isAvailable'); } catch (e) { return { available: false, reason: e.message }; }
  }
  async function connect() {
    const a = await available();
    if (!a.available) throw new Error(a.reason || 'unavailable');
    const st = await call('requestAuthorization', { read: READ, write: WRITE });
    S.health = Object.assign({ stepGoal: 8000 }, S.health || {}, { on: true, since: S.health && S.health.since || todayKey(), denied: (st && st.readDenied) || [] });
    save();
    await sync();
    return st;
  }
  function disconnect() { if (S.health) S.health.on = false; save(); }

  async function aggregated(dataType, days) {
    const end = Date.now(), start = dayStart(addDays(todayKey(), -(days - 1)));
    const r = await call('queryAggregated', { dataType, startDate: iso(start), endDate: iso(end), bucket: 'day', aggregation: 'sum' });
    const out = {}; (r.samples || []).forEach(s => { out[localKey(s.startDate)] = Math.round(s.value || 0); });
    return out;
  }
  async function sleepByNight(days) {
    const end = Date.now(), start = dayStart(addDays(todayKey(), -days)) - 6 * 3600e3;
    const r = await call('readSamples', { dataType: 'sleep', startDate: iso(start), endDate: iso(end), limit: 500 });
    const out = {};
    (r.samples || []).forEach(s => {
      const state = String(s.sleepState || '').toLowerCase();
      if (/awake|inbed|in_bed/.test(state)) return;
      const wake = new Date(s.endDate); const k = dateKey(wake.getHours() < 18 ? wake : new Date(wake.getTime() + 864e5)); // credit sleep to the morning you wake
      out[k] = (out[k] || 0) + (s.value || 0);
    });
    Object.keys(out).forEach(k => { out[k] = Math.round(out[k]); });
    return out;
  }
  async function samplesByDay(dataType, days) {
    const r = await call('readSamples', { dataType, startDate: iso(dayStart(addDays(todayKey(), -(days - 1)))), endDate: iso(Date.now()), limit: 300, ascending: true });
    const out = {}; (r.samples || []).forEach(s => { out[localKey(s.startDate)] = s.value; });
    return out;
  }
  async function otherWorkouts(days) {
    const r = await call('queryWorkouts', { startDate: iso(dayStart(addDays(todayKey(), -(days - 1)))), endDate: iso(Date.now()), limit: 50 });
    return (r.workouts || []).filter(w => !/groundwork/i.test(w.sourceName || '')).map(w => ({
      date: localKey(w.startDate), type: String(w.workoutType || 'other').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim(),
      minutes: Math.round((w.duration || 0) / 60), kcal: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned) : null, source: w.sourceName || '',
    }));
  }

  let syncing = false;
  async function sync() {
    if (!ok() || !S.health || !S.health.on || syncing) return;
    syncing = true;
    const d = S.healthData = S.healthData || {};
    const step = async (key, fn) => { try { d[key] = await fn(); } catch (e) { /* that type may be denied; others still sync */ } };
    await step('steps', () => aggregated('steps', 14));
    await step('active', () => aggregated('calories', 14));
    await step('sleep', () => sleepByNight(14));
    await step('rhr', () => samplesByDay('restingHeartRate', 21));
    await step('workouts', () => otherWorkouts(14));
    try { // weigh-ins from a smart scale or other apps fill days you didn't log here
      const w = await samplesByDay('weight', 30); let added = 0;
      Object.entries(w).forEach(([k, kg]) => { if (kg > 20 && kg < 400 && !S.weights.some(x => x.date === k)) { S.weights.push({ date: k, kg: Math.round(kg * 100) / 100, source: 'health' }); added++; } });
      if (added) S.weights.sort((a, b) => a.date < b.date ? -1 : 1);
    } catch (e) { /* ignore */ }
    d.syncedAt = new Date().toISOString();
    syncing = false;
    save(); render();
  }
  async function writeWeight(kg, k) {
    if (!ok() || !S.health || !S.health.on) return;
    const t = new Date(parseKey(k).getTime() + 7 * 3600e3);
    try { await call('saveSample', { dataType: 'weight', value: Math.round(kg * 100) / 100, startDate: iso(t), endDate: iso(t) }); } catch (e) { /* write may be denied */ }
  }
  return { ok, name, available, connect, disconnect, sync, writeWeight, openSettings: () => call('openHealthConnectSettings') };
})();

/* ================= derived numbers ================= */
function healthToday() {
  const d = S.healthData || {}, k = todayKey();
  const rhrVals = Object.entries(d.rhr || {}).filter(([day]) => day < k).map(([, v]) => v);
  const rhrAvg = rhrVals.length >= 5 ? rhrVals.reduce((a, b) => a + b, 0) / rhrVals.length : null;
  const rhr = d.rhr ? d.rhr[k] : null;
  return { steps: (d.steps || {})[k] || 0, active: (d.active || {})[k] || 0, sleep: (d.sleep || {})[k] || null, rhr, rhrAvg };
}
function recoveryNote(h) {
  const reasons = [];
  if (h.sleep != null && h.sleep < 360) reasons.push(`${Math.floor(h.sleep / 60)}h ${h.sleep % 60}m of sleep`);
  if (h.rhr && h.rhrAvg && h.rhr > h.rhrAvg + 7) reasons.push(`resting heart rate ${Math.round(h.rhr - h.rhrAvg)} bpm above your usual`);
  return reasons.length ? `Recovery looks low (${reasons.join(', ')}). Keep today lighter: drop a set per exercise or stop 3 reps short of failure.` : '';
}
const fmtSleep = m => m == null ? '—' : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

/* ================= UI ================= */
function activityCard() {
  if (!S.health || !S.health.on) return '';
  const h = healthToday(), goal = S.health.stepGoal || 8000, note = recoveryNote(h);
  return `<div class="card"><div class="card-head"><span class="eyebrow">Activity · ${HealthSync.name()}</span><span class="tiny faint">${S.healthData && S.healthData.syncedAt ? 'Synced ' + new Date(S.healthData.syncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</span></div>
    <div class="stack" style="gap:6px"><div class="row between"><span class="small"><b class="num">${fmtInt(h.steps)}</b> <span class="faint">/ ${fmtInt(goal)} steps</span></span><span class="small faint">${h.steps >= goal ? 'Goal reached' : fmtInt(goal - h.steps) + ' to go'}</span></div>
      <div class="progress" style="height:8px"><i style="width:${Math.min(100, h.steps / goal * 100)}%"></i></div></div>
    <div class="stats"><div class="stat"><div class="v">${fmtInt(h.active)}</div><div class="k">Active kcal</div></div><div class="stat"><div class="v">${fmtSleep(h.sleep)}</div><div class="k">Sleep</div></div><div class="stat"><div class="v">${h.rhr ? Math.round(h.rhr) : '—'}</div><div class="k">Resting HR</div></div></div>
    ${note ? `<div class="banner">${icon('heart', 18)}<span>${esc(note)}</span></div>` : ''}</div>`;
}
function activityProgressCard() {
  if (!S.health || !S.health.on) return '';
  const d = S.healthData || {}, days = [...Array(7)].map((_, i) => addDays(todayKey(), i - 6));
  const steps = days.map(k => (d.steps || {})[k] || 0), max = Math.max(S.health.stepGoal || 8000, ...steps) * 1.1;
  const sl = days.map(k => (d.sleep || {})[k]).filter(x => x != null);
  const W = 340, H = 120, B = 20, bw = W / 7;
  const goalY = Math.max(14, (H - B) * (1 - (S.health.stepGoal || 8000) / max));
  const others = (d.workouts || []).slice().reverse();
  return `<div class="card"><div class="card-head"><span class="eyebrow">Activity, last 7 days</span><span class="small faint">${fmtInt(steps.reduce((a, b) => a + b, 0) / 7)} steps/day</span></div>
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily steps, last 7 days">${steps.map((v, i) => { const h = Math.max(3, (H - B) * v / max); return `<rect class="bar steps" x="${(i * bw + bw * 0.2).toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="4"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${DOW[parseKey(days[i]).getDay()].slice(0, 2)}</text>`; }).join('')}
      <line class="target" x1="0" x2="${W}" y1="${goalY.toFixed(1)}" y2="${goalY.toFixed(1)}"/><text x="${W}" y="${Math.max(10, goalY - 4).toFixed(1)}" text-anchor="end">Goal ${fmtInt(S.health.stepGoal || 8000)}</text></svg>
    ${sl.length ? `<p class="small muted" style="margin:0">Average sleep: <b>${fmtSleep(Math.round(sl.reduce((a, b) => a + b, 0) / sl.length))}</b> over ${sl.length} night${sl.length > 1 ? 's' : ''}</p>` : ''}
    ${others.length ? `<span class="label">From other apps and watches</span><div class="list">${others.slice(0, 6).map(w => `<div class="li"><span class="grow"><span class="t">${esc(w.type)}</span><br><span class="d">${shortDate(w.date)} · ${w.minutes} min${w.kcal ? ` · ${fmtInt(w.kcal)} kcal` : ''}${w.source ? ' · ' + esc(w.source) : ''}</span></span></div>`).join('')}</div>` : ''}</div>`;
}

Object.assign(SHEETS, {
  health_connect() {
    const on = !!(S.health && S.health.on), nm = HealthSync.name();
    return sheetHead(nm, 'Use data from your phone and watch')
      + `<p class="muted" style="margin:0">Groundwork reads <b>steps, active calories, sleep, resting heart rate, weigh-ins and workouts</b> from other apps, and saves the weight you log here back to ${nm}. Nothing leaves your phone.</p>
      <div class="toggle"><span class="small"><b>Connect ${nm}</b><br><span class="faint">${on ? 'Connected' + (S.healthData && S.healthData.syncedAt ? ' · last sync ' + new Date(S.healthData.syncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '') : 'You choose what to share on the next screen'}</span></span><button class="switch" role="switch" aria-checked="${on}" data-act="health-toggle" aria-label="Connect ${nm}"></button></div>
      ${on ? `<div class="field"><label for="hc-goal">Daily step goal</label><select class="input" id="hc-goal" data-stepgoal>${[5000, 6000, 7000, 8000, 10000, 12000, 15000].map(v => `<option value="${v}" ${(S.health.stepGoal || 8000) === v ? 'selected' : ''}>${fmtInt(v)}</option>`).join('')}</select></div>
        <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn ghost sm" data-act="health-sync">Sync now</button>${Native.platform === 'android' ? `<button class="btn ghost sm" data-act="health-settings">Health Connect permissions</button>` : ''}</div>
        <p class="tiny faint">Calorie targets stay based on your weight trend, so watch calorie estimates don't double count. To change what's shared, use ${Native.platform === 'ios' ? 'the Health app → Sharing → Apps → Groundwork' : 'Health Connect permissions'}.</p>` : ''}
      ${Native.platform === 'android' ? `<p class="tiny faint">Health Connect is built into Android 14 and later; on older phones, install "Health Connect" from the Play Store.</p>` : ''}`;
  },
});

/* ================= hooks ================= */
const _settingsHealth = SHEETS.settings;
SHEETS.settings = s => {
  const html = _settingsHealth(s);
  if (!HealthSync.ok()) return html;
  const on = !!(S.health && S.health.on);
  return html.replace('<div class="card" style="box-shadow:none" id="set-profile">',
    `<div class="card" style="box-shadow:none"><span class="eyebrow">Phone and watch data</span><button class="li" data-act="health-open"><span class="ni">${icon('heart', 20)}</span><span class="grow"><span class="t">${HealthSync.name()}</span><br><span class="d">${on ? 'Connected: steps, sleep, heart rate, weight, workouts' : 'Bring in steps, sleep and workouts from your watch'}</span></span><span class="chev">${icon('chevR', 18)}</span></button></div>
    <div class="card" style="box-shadow:none" id="set-profile">`);
};
const _viewTodayHealth = viewToday;
viewToday = () => {
  const html = _viewTodayHealth(), card = activityCard();
  if (!card) return html;
  const marker = '<div class="card fuel">';
  return html.includes(marker) ? html.replace(marker, card + marker) : html + card;
};
const _viewProgressHealth = viewProgress;
viewProgress = () => {
  const html = _viewProgressHealth(), card = activityProgressCard();
  if (!card) return html;
  const marker = '<div class="card"><div class="card-head"><span class="eyebrow">Personal records';
  return html.includes(marker) ? html.replace(marker, card + marker) : html + card;
};
const _weightSave = ACT['weight-save'];
ACT['weight-save'] = t => {
  const d = val('w-date') || todayKey(), before = JSON.stringify(S.weights);
  _weightSave(t);
  const w = S.weights.find(x => x.date === d);
  if (w && JSON.stringify(S.weights) !== before) HealthSync.writeWeight(w.kg, d);
};
/* Coach updates include activity averages when connected. */
if (typeof buildUpdate === 'function') {
  const _bu = buildUpdate;
  buildUpdate = note => { const u = _bu(note); const sh = (S.coach && S.coach.share) || {}; if (S.health && S.health.on && S.healthData && sh.activity && !sh.paused) { const days = [...Array(7)].map((_, i) => addDays(todayKey(), -i)); const st = days.map(k => (S.healthData.steps || {})[k]).filter(x => x != null), sl = days.map(k => (S.healthData.sleep || {})[k]).filter(x => x != null); u.activity = { stepsAvg: st.length ? Math.round(st.reduce((a, b) => a + b, 0) / st.length) : null, sleepAvg: sl.length ? Math.round(sl.reduce((a, b) => a + b, 0) / sl.length) : null }; } return u; };
}

Object.assign(ACT, {
  'health-open': () => pushSheet({ type: 'health_connect' }),
  'health-toggle': async () => {
    if (S.health && S.health.on) { HealthSync.disconnect(); render(); toast(`${HealthSync.name()} disconnected. Data already brought in stays.`); return; }
    try { await HealthSync.connect(); render(); toast(`${HealthSync.name()} connected`); }
    catch (e) { toast(Native.platform === 'android' ? 'Health Connect isn\'t available. Install it from the Play Store, then try again.' : 'Health data isn\'t available on this device.'); }
  },
  'health-sync': async () => { toast('Syncing…'); await HealthSync.sync(); toast('Up to date'); },
  'health-settings': () => { HealthSync.openSettings().catch(() => {}); },
});
document.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.stepgoal != null && S.health) { S.health.stepGoal = Number(e.target.value); save(); render(); } });

/* Sync on start and whenever the app comes back to the front. */
if (HealthSync.ok()) {
  setTimeout(() => HealthSync.sync(), 1500);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') HealthSync.sync(); });
}
