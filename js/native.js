/* Groundwork — native phone features (Capacitor). Everything here is a no-op on the website.
   - Reminders scheduled on the phone, so they arrive with the app closed (Local Notifications)
   - Haptics on completed sets, finished workouts and personal bests
   - Screen kept awake while a workout is open
   - Backups saved through the phone's share sheet (Files, Drive, email)
   - Android back button closes sheets, then the logger, then goes to Today, then leaves the app
   Plugins are called through the Capacitor bridge by name, so no bundler is needed. */
const Native = (() => {
  const C = window.Capacitor;
  const isNative = !!(C && typeof C.isNativePlatform === 'function' && C.isNativePlatform());
  const platform = C && C.getPlatform ? C.getPlatform() : 'web';
  const available = name => isNative && (!C.isPluginAvailable || C.isPluginAvailable(name));
  function call(plugin, method, opts) {
    if (!available(plugin)) return Promise.reject(new Error(plugin + ' unavailable'));
    const P = C.Plugins && C.Plugins[plugin];
    if (P && typeof P[method] === 'function') return P[method](opts || {});
    if (typeof C.nativePromise === 'function') return C.nativePromise(plugin, method, opts || {});
    return Promise.reject(new Error('bridge unavailable'));
  }
  function listen(plugin, event, fn) {
    if (!available(plugin)) return;
    const P = C.Plugins && C.Plugins[plugin];
    try { if (P && P.addListener) P.addListener(event, fn); else if (C.addListener) C.addListener(plugin, event, fn); } catch (e) { /* ignore */ }
  }
  const quiet = p => (p && p.catch ? p.catch(() => null) : p);

  /* ---------- haptics ---------- */
  function haptic(kind) {
    if (!available('Haptics')) return;
    if (kind === 'success') quiet(call('Haptics', 'notification', { type: 'SUCCESS' }));
    else quiet(call('Haptics', 'impact', { style: kind === 'heavy' ? 'HEAVY' : kind === 'medium' ? 'MEDIUM' : 'LIGHT' }));
  }

  /* ---------- keep the screen on during workouts ---------- */
  let awake = false;
  function setAwake(on) {
    if (!available('KeepAwake') || on === awake) return;
    awake = on; quiet(call('KeepAwake', on ? 'keepAwake' : 'allowSleep'));
  }

  /* ---------- share a file (backups) ---------- */
  async function shareFile(name, text, title) {
    const w = await call('Filesystem', 'writeFile', { path: name, data: text, directory: 'CACHE', encoding: 'utf8' });
    await call('Share', 'share', { title: title || name, dialogTitle: title || 'Save your backup', files: [w.uri] });
  }

  /* ---------- reminders on the phone ---------- */
  const ID_BASE = 7000, ID_MAX = 7999;
  async function notifPermission(ask) {
    if (!available('LocalNotifications')) return 'unavailable';
    try {
      let p = await call('LocalNotifications', 'checkPermissions');
      if (p.display !== 'granted' && ask) p = await call('LocalNotifications', 'requestPermissions');
      return p.display;
    } catch (e) { return 'denied'; }
  }
  const at = (key, hhmm) => { const [h, m] = (hhmm || '08:00').split(':').map(Number); const d = parseKey(key); d.setHours(h, m, 0, 0); return d; };
  function plannedNotifications() {
    if (!S.onboarded || !S.reminders.enabled) return [];
    const R = S.reminders, out = [], now = Date.now(), today = todayKey();
    const push = (date, title, body, act) => { if (date.getTime() > now + 60000) out.push({ id: ID_BASE + out.length, title, body, schedule: { at: date, allowWhileIdle: true }, extra: { act }, actionTypeId: act === 'today' ? 'GW_WORKOUT' : act === 'food' ? 'GW_FOOD' : undefined }); };
    for (let i = 0; i < 14; i++) {
      const k = addDays(today, i);
      const w = workoutForDate(S, k);
      if (R.workout && w && !workoutDoneOn(S, k)) push(at(k, R.workoutTime || '08:00'), `Today: ${w.name}`, `About ${S.schedule.minutes} min. Tap to see your workout.`, 'today');
      const logged = (S.foodLog[k] || []).length > 0;
      if (R.meals && !logged) push(at(k, R.foodTime || '20:00'), 'Log today\'s food', 'A quick log keeps your targets on track. Rough entries are fine.', 'food');
      const dow = parseKey(k).getDay();
      if (R.weighin && (dow === 1 || dow === 4) && !S.weights.some(x => x.date === k)) push(at(k, '07:30'), 'Morning weigh-in', 'Before breakfast, after the bathroom. Your trend does the rest.', 'weight');
    }
    if (R.checkin && typeof checkinStatus === 'function') {
      const ci = checkinStatus(S);
      if (ci && !ci.due && ci.daysUntil != null) push(at(addDays(today, ci.daysUntil), '09:00'), 'Weekly check-in is ready', 'Takes 30 seconds. Your calories adjust to your progress.', 'checkin');
    }
    return out.slice(0, 60); // iOS keeps at most 64 pending
  }
  let syncTimer = null;
  function queueSync() { if (!isNative) return; clearTimeout(syncTimer); syncTimer = setTimeout(syncReminders, 1500); }
  async function syncReminders() {
    if (!S.reminders || !S.reminders.browser) return;
    if ((await notifPermission(false)) !== 'granted') return;
    try {
      const pend = await call('LocalNotifications', 'getPending');
      const ours = (pend.notifications || []).filter(n => n.id >= ID_BASE && n.id <= ID_MAX).map(n => ({ id: n.id }));
      if (ours.length) await call('LocalNotifications', 'cancel', { notifications: ours });
      const list = plannedNotifications();
      if (list.length) await call('LocalNotifications', 'schedule', { notifications: list });
    } catch (e) { /* reminders are best effort */ }
  }
  /* Rest timer: a notification when rest ends, so a phone in your pocket (and a paired watch) buzzes. */
  const REST_ID = 7990, SNOOZE_ID = 7950;
  let restAt = 0;
  async function syncRest(rest, label) {
    if (!isNative || !S.reminders || !S.reminders.browser) return;
    const end = rest ? Math.round(rest.end / 1000) * 1000 : 0;
    if (end === restAt) return;
    restAt = end;
    try {
      await call('LocalNotifications', 'cancel', { notifications: [{ id: REST_ID }] });
      if (end && end - Date.now() > 3000) await call('LocalNotifications', 'schedule', { notifications: [{ id: REST_ID, title: 'Rest is over', body: label || 'Time for your next set.', schedule: { at: new Date(end), allowWhileIdle: true }, extra: { act: 'rest' } }] });
    } catch (e) { /* best effort */ }
  }
  async function clearReminders() {
    try {
      const pend = await call('LocalNotifications', 'getPending');
      const ours = (pend.notifications || []).filter(n => n.id >= ID_BASE && n.id <= ID_MAX).map(n => ({ id: n.id }));
      if (ours.length) await call('LocalNotifications', 'cancel', { notifications: ours });
    } catch (e) { /* ignore */ }
  }

  /* ---------- start-up ---------- */
  function boot() {
    if (!isNative) return;
    document.documentElement.classList.add('native', 'native-' + platform);
    // Status bar text matches the theme.
    const dark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    quiet(call('StatusBar', 'setStyle', { style: dark ? 'DARK' : 'LIGHT' }));
    if (platform === 'android') quiet(call('StatusBar', 'setBackgroundColor', { color: dark ? '#0F1513' : '#F3F5F4' }));
    listen('App', 'backButton', () => {
      if (UI.sheet) { popSheet(); return; }
      if (S.activeWorkout && UI.loggerOpen) { UI.loggerOpen = false; render(); return; }
      if (UI.tab !== 'today') { UI.tab = 'today'; render(); window.scrollTo(0, 0); return; }
      quiet(call('App', 'exitApp'));
    });
    listen('App', 'appStateChange', st => { if (st && st.isActive) { render(); queueSync(); } });
    quiet(call('LocalNotifications', 'registerActionTypes', { types: [
      { id: 'GW_WORKOUT', actions: [{ id: 'open', title: 'Open workout', foreground: true }, { id: 'snooze', title: 'Remind me in 1 hour' }] },
      { id: 'GW_FOOD', actions: [{ id: 'open', title: 'Log food', foreground: true }, { id: 'snooze', title: 'Remind me in 1 hour' }] },
    ] }));
    listen('LocalNotifications', 'localNotificationActionPerformed', ev => {
      const n = ev && ev.notification, act = n && n.extra && n.extra.act;
      if (ev && ev.actionId === 'snooze' && n) {
        quiet(call('LocalNotifications', 'schedule', { notifications: [{ id: SNOOZE_ID, title: n.title, body: n.body, schedule: { at: new Date(Date.now() + 3600e3), allowWhileIdle: true }, extra: n.extra, actionTypeId: n.actionTypeId }] }));
        return;
      }
      if (act === 'rest') { if (S.activeWorkout) { UI.loggerOpen = true; render(); } return; }
      UI.sheet = null; UI.stack = [];
      if (act === 'food') { UI.tab = 'food'; UI.foodDate = todayKey(); }
      else if (act === 'weight') { UI.tab = 'today'; render(); pushSheet({ type: 'weight' }); return; }
      else if (act === 'coachmsg') { UI.tab = typeof coachOn === 'function' && coachOn() ? 'clients' : 'coach'; }
      else if (act === 'checkin') { UI.tab = 'today'; render(); if (ACT['open-checkin']) ACT['open-checkin'](); return; }
      else UI.tab = 'today';
      render();
    });
    queueSync();
  }

  return { isNative, platform, available, call, syncRest, haptic, setAwake, shareFile, notifPermission, queueSync, syncReminders, clearReminders, plannedNotifications, boot };
})();

/* ---------- hooks into the app ---------- */
(() => {
  // Re-plan phone reminders whenever data is saved.
  const _save = save;
  save = function () { _save(); Native.queueSync(); };
  // Keep the screen on while a workout is open.
  const _render = render;
  render = function () { _render(); Native.setAwake(!!(S.activeWorkout && UI.loggerOpen)); restSync(); };
  // Rest-over notification follows the in-app rest timer.
  function restSync() {
    if (!Native.isNative) return;
    let label = '';
    if (UI.rest && S.activeWorkout) { const it = S.activeWorkout.items.find(x => x.rows.some(r => !r.done)); if (it) { const j = it.rows.findIndex(r => !r.done); label = `Next: ${EX_BY_ID[it.exId].name}, set ${j + 1}`; } }
    Native.syncRest(S.activeWorkout ? UI.rest : null, label);
  }
  ['rest-add', 'rest-skip'].forEach(k => { const f = ACT[k]; if (f) ACT[k] = t => { f(t); restSync(); }; });
  // Haptics.
  const tog = ACT['toggle-set'];
  if (tog) ACT['toggle-set'] = t => { tog(t); const it = S.activeWorkout && S.activeWorkout.items[Number(t.dataset.i)]; const r = it && it.rows[Number(t.dataset.j)]; if (r && r.done) Native.haptic('light'); };
  const _fw = finishWorkout;
  finishWorkout = function () { const n = S.workouts.length; const res = _fw.apply(this, arguments); const w = S.workouts[S.workouts.length - 1]; if (S.workouts.length > n) Native.haptic(w && w.prs && w.prs.length ? 'success' : 'medium'); return res; };
  if (!Native.isNative) return;
  // Backups go through the share sheet inside the app (handled in safety.js 'download-backup').
  // Phone notifications replace browser notifications.
  ACT['notif-toggle'] = async () => {
    if (S.reminders.browser) { S.reminders.browser = false; save(); await Native.clearReminders(); render(); toast('Phone reminders off'); return; }
    const p = await Native.notifPermission(true);
    S.reminders.browser = p === 'granted'; save(); render();
    if (p === 'granted') { await Native.syncReminders(); toast('Reminders on. They arrive even with the app closed.'); }
    else toast('Notifications are off for Groundwork. Turn them on in your phone\'s Settings.');
  };
  ACT['rem-time'] = t => { S.reminders[t.dataset.k] = t.value; save(); render(); };
})();
document.addEventListener('change', e => { if (e.target && e.target.dataset && e.target.dataset.remtime) { S.reminders[e.target.dataset.remtime] = e.target.value; save(); } });
Native.boot();
