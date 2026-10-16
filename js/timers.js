/* Movla — workout timers and alerts.
   - Timed sets: holds (planks, wall sits, hangs, carries; unit 'sec') count down from the target with a
     3-2-1 lead-in and record the set when time is up. Cardio (treadmill, bike, rower…; unit 'min') counts up,
     pings when the target is reached, and records the minutes when you tap Done.
   - Rest: a sound (and vibration) when rest is over, with a soft tick for the last 3 seconds.
   - With the app in the background, the phone app shows a notification at the same moment (native.js).
   Settings → Workout timers turns sound, vibration and notifications on or off. */

function timerPrefs() { return (S.timerPrefs = Object.assign({ sound: true, vibrate: true, notify: true, leadIn: true }, S.timerPrefs || {})); }

const Beep = (() => {
  let ctx = null;
  function unlock() {   // browsers only allow sound after a tap; every tap keeps it ready
    try {
      if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return; ctx = new A(); }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* no audio */ }
  }
  function tone(freq, at, dur, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g); g.connect(ctx.destination); o.start(at); o.stop(at + dur + 0.03);
  }
  function play(kind) {
    if (!timerPrefs().sound) return;
    unlock(); if (!ctx) return;
    try {
      const t = ctx.currentTime + 0.03;
      if (kind === 'tick') tone(880, t, 0.08, 0.22);
      else if (kind === 'go') tone(1320, t, 0.22, 0.32);
      else { tone(988, t, 0.15, 0.4); tone(988, t + 0.2, 0.15, 0.4); tone(1319, t + 0.4, 0.4, 0.45); }   // done: two short, one long
    } catch (e) { /* ignore */ }
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, { passive: true, capture: true }));
  return { play, unlock };
})();

function buzz(pattern) {
  if (!timerPrefs().vibrate) return;
  if (typeof Native !== 'undefined' && Native.isNative && Native.haptic && !Array.isArray(pattern)) { Native.haptic(pattern === 'light' ? 'light' : 'heavy'); return; }
  try { if (navigator.vibrate) navigator.vibrate(Array.isArray(pattern) ? pattern : pattern === 'light' ? 15 : [200, 100, 200]); } catch (e) { /* ignore */ }
}
/* The website, with the tab in the background: a browser notification if the person already allowed them. */
function webNotify(title, body) {
  if ((typeof Native !== 'undefined' && Native.isNative) || !document.hidden || !timerPrefs().notify) return;
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, tag: 'movla-timer', icon: 'icons/icon-192.png' }); } catch (e) { /* ignore */ }
}

const Timers = (() => {
  const LEAD = 3000;
  const fmt = sec => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
  const elapsed = h => h.acc + (h.running ? Math.max(0, Date.now() - h.startAt) : 0);
  const inLead = h => h.running && Date.now() < h.startAt;

  function nextRow(it) { return it.rows.findIndex(r => !r.done); }
  function target(it, ex, r) {
    const v = r && r.reps != null && r.reps > 0 ? r.reps : it.max || it.min || (ex.unit === 'min' ? 10 : 30);
    return ex.unit === 'min' ? v * 60 : v;
  }
  function start(i, j) {
    const it = S.activeWorkout && S.activeWorkout.items[i]; if (!it) return;
    const ex = EX_BY_ID[it.exId], r = it.rows[j];
    // Use what's typed in the box as the target, if anything.
    const box = document.querySelector(`input[data-set="r"][data-i="${i}"][data-j="${j}"]`);
    if (box && box.value) { const n = parseFloat(box.value); if (n > 0) r.reps = n; }
    UI.rest = null;
    const lead = timerPrefs().leadIn ? LEAD : 0;
    UI.hold = { i, j, mode: ex.unit === 'min' ? 'up' : 'down', target: target(it, ex, r), acc: 0, startAt: Date.now() + lead, running: true, pinged: false, ticked: {} };
    askPermissionOnce();
    Beep.unlock();
    render();
  }
  function stop() { UI.hold = null; render(); }
  function pause() { const h = UI.hold; if (!h || !h.running) return; h.acc = inLead(h) ? 0 : elapsed(h); h.running = false; render(); }
  function resume() { const h = UI.hold; if (!h || h.running) return; h.startAt = Date.now(); h.running = true; render(); }
  function finish(auto) {
    const h = UI.hold; if (!h || !S.activeWorkout) return;
    const it = S.activeWorkout.items[h.i], r = it && it.rows[h.j]; if (!r) { UI.hold = null; render(); return; }
    const secs = h.mode === 'down' && auto ? h.target : elapsed(h) / 1000;
    if (secs < 1 && !auto) { UI.hold = null; render(); return; }
    r.reps = h.mode === 'up' ? Math.max(1, Math.round(secs / 60)) : Math.max(1, Math.round(secs));
    UI.hold = null;
    if (!r.done) ACT['toggle-set']({ dataset: { i: String(h.i), j: String(h.j) } });   // marks it done and starts rest
    else { save(); render(); }
  }

  /* 5 times a second: update the numbers on screen and fire sounds. */
  function tick() {
    const h = UI.hold;
    if (h && S.activeWorkout) {
      const now = Date.now();
      if (h.running && now < h.startAt) {
        const n = Math.ceil((h.startAt - now) / 1000);
        if (!h.ticked['lead' + n]) { h.ticked['lead' + n] = 1; Beep.play('tick'); buzz('light'); }
      } else if (h.running && !h.ticked.go && timerPrefs().leadIn) { h.ticked.go = 1; Beep.play('go'); buzz('light'); }
      const e = elapsed(h) / 1000;
      if (h.mode === 'down') {
        const left = h.target - e;
        const n = Math.ceil(left);
        if (h.running && n <= 3 && n > 0 && !inLead(h) && !h.ticked['end' + n]) { h.ticked['end' + n] = 1; Beep.play('tick'); }
        if (h.running && left <= 0) { Beep.play('done'); buzz([200, 100, 200]); webNotify('Time!', setName(h) + ' done'); toast(`${setName(h)} done: ${h.target} s`); finish(true); return; }
      } else if (h.running && !h.pinged && e >= h.target) {
        h.pinged = true; Beep.play('done'); buzz([200, 100, 200]); webNotify('Target reached', `${setName(h)}: ${Math.round(h.target / 60)} min`);
        { const m = Math.round(h.target / 60); toast(`${m} minute${m === 1 ? '' : 's'} done. Keep going or tap Done.`); }
      }
      paint(h);
    }
  }
  function setName(h) { const it = S.activeWorkout.items[h.i]; return EX_BY_ID[it.exId].name; }
  function paint(h) {
    const t = document.getElementById('hold-t'), p = document.getElementById('hold-prog'), l = document.getElementById('hold-l');
    if (!t) return;
    const e = elapsed(h) / 1000;
    if (inLead(h)) { t.textContent = String(Math.ceil((h.startAt - Date.now()) / 1000)); if (l) l.textContent = 'Get ready'; if (p) p.style.width = '0%'; return; }
    if (l) l.textContent = h.mode === 'down' ? (h.running ? 'Hold' : 'Paused') : (h.running ? (h.pinged ? 'Target reached · keep going' : `Target ${Math.round(h.target / 60)} min`) : 'Paused');
    t.textContent = h.mode === 'down' ? fmt(Math.ceil(h.target - e)) : fmt(e);
    if (p) p.style.width = Math.min(100, (e / h.target) * 100) + '%';
  }

  /* What the phone should notify about if the app goes to the background now. */
  function alarm() {
    const out = [];
    if (UI.rest) {
      let body = 'Time for your next set.';
      const it = S.activeWorkout && S.activeWorkout.items.find(x => x.rows.some(r => !r.done));
      if (it) body = `Next: ${EX_BY_ID[it.exId].name}, set ${it.rows.findIndex(r => !r.done) + 1}`;
      out.push({ end: UI.rest.end, title: 'Rest is over', body });
    }
    const h = UI.hold;
    if (h && h.running && S.activeWorkout) {
      const name = setName(h);
      if (h.mode === 'down') out.push({ end: h.startAt + (h.target * 1000 - h.acc), title: 'Time!', body: `${name}: ${h.target} s done. Open Movla to log it.` });
      else if (!h.pinged) out.push({ end: h.startAt + (h.target * 1000 - h.acc), title: 'Target reached', body: `${name}: ${Math.round(h.target / 60)} min` });
    }
    return out.sort((a, b) => a.end - b.end)[0] || null;
  }

  /* The phone needs permission once for notifications; asked the first time a timer runs. */
  async function askPermissionOnce() {
    const P = timerPrefs();
    if (P.asked || !P.notify || typeof Native === 'undefined' || !Native.isNative) return;
    P.asked = true; save();
    try { await Native.notifPermission(true); } catch (e) { /* ignore */ }
  }

  /* The timer panel inside an exercise card. */
  function panel(it, i) {
    const ex = EX_BY_ID[it.exId];
    if (ex.unit !== 'sec' && ex.unit !== 'min') return '';
    const h = UI.hold && UI.hold.i === i ? UI.hold : null;
    if (!h) {
      const j = nextRow(it); if (j < 0) return '';
      const tg = target(it, ex, it.rows[j]);
      return `<button class="btn soft block hold-start" data-act="hold-start" data-i="${i}" data-j="${j}">${icon('timer', 18)} ${ex.unit === 'min' ? `Start · set ${j + 1} · ${Math.round(tg / 60)} min` : `Start ${tg}-second hold · set ${j + 1}`}</button>`;
    }
    return `<div class="hold" role="timer" aria-live="off">
      <div class="hold-top"><span class="small muted">Set ${h.j + 1} · <span id="hold-l"></span></span><span class="hold-t" id="hold-t">${h.mode === 'down' ? fmt(h.target) : '0:00'}</span></div>
      <div class="tbar"><i id="hold-prog" style="width:0%;background:var(--train)"></i></div>
      <div class="hold-btns">${h.running ? `<button class="btn ghost sm" data-act="hold-pause">${icon('pause', 16)} Pause</button>` : `<button class="btn ghost sm" data-act="hold-resume">${icon('play', 16)} Resume</button>`}
        <button class="btn train sm" data-act="hold-done">${icon('check', 16)} Done</button><button class="icon-btn" data-act="hold-cancel" aria-label="Cancel timer">${icon('x', 18)}</button></div>
    </div>`;
  }

  setInterval(tick, 200);
  return { start, stop, pause, resume, finish, panel, alarm, paint, tick };
})();

/* ---------- hook into the workout logger ---------- */
{
  const card = loggerCard;
  loggerCard = (it, i) => {
    const html = card(it, i), p = Timers.panel(it, i);
    if (!p) return html;
    const at = html.indexOf('<div class="row" style="flex-wrap:wrap;row-gap:4px">');
    return at < 0 ? html : html.slice(0, at) + p + html.slice(at);
  };
  // After every render, show the current numbers right away (no 200 ms flash of the start value).
  const _render = render;
  render = function () { _render.apply(this, arguments); if (UI.hold) Timers.paint(UI.hold); };
}
Object.assign(ACT, {
  'hold-start': t => Timers.start(Number(t.dataset.i), Number(t.dataset.j)),
  'hold-pause': () => Timers.pause(),
  'hold-resume': () => Timers.resume(),
  'hold-done': () => Timers.finish(false),
  'hold-cancel': () => Timers.stop(),
});
// Unticking a set or leaving the workout stops its timer.
['finish-workout', 'cancel-workout'].forEach(k => { const f = ACT[k]; if (f) ACT[k] = t => { UI.hold = null; return f(t); }; });

/* Rest: soft ticks for the last 3 seconds, then the "done" sound. */
{
  const tick = tickRest;
  let lastLeft = null;
  tickRest = function () {
    const r = UI.rest;
    const left = r ? Math.ceil((r.end - Date.now()) / 1000) : null;
    if (r && left <= 3 && left > 0 && left !== lastLeft) Beep.play('tick');
    lastLeft = left;
    tick.apply(this, arguments);
    if (r && !UI.rest) {
      // Came back long after it ended (phone was locked)? The notification already told them; stay quiet.
      if (Date.now() - r.end < 5000) { Beep.play('done'); webNotify('Rest is over', 'Time for your next set.'); }
      if (typeof window.restSync === 'function') window.restSync();
    }
  };
  // Ask for notification permission the first time rest starts on the phone.
  const tog = ACT['toggle-set'];
  ACT['toggle-set'] = t => { Beep.unlock(); if (UI.hold && UI.hold.i === Number(t.dataset.i) && UI.hold.j === Number(t.dataset.j)) UI.hold = null; tog(t); if (UI.rest && typeof Native !== 'undefined' && Native.isNative) { const P = timerPrefs(); if (!P.asked && P.notify) { P.asked = true; save(); Native.notifPermission(true).catch(() => {}); } } };
}

/* ---------- Settings: Workout timers ---------- */
{
  const settings = SHEETS.settings;
  SHEETS.settings = s => {
    const P = timerPrefs();
    const sw = (k, label, sub) => `<div class="toggle"><span class="small"><b>${label}</b>${sub ? `<br><span class="faint">${sub}</span>` : ''}</span><button class="switch" role="switch" aria-checked="${!!P[k]}" data-act="timer-pref" data-k="${k}" aria-label="${label}"></button></div>`;
    const card = `<div class="card" style="box-shadow:none" id="set-timers"><span class="eyebrow">Workout timers</span>
      ${sw('sound', 'Sound', 'A ping when rest is over and when a timed set finishes')}
      ${sw('vibrate', 'Vibration', '')}
      ${sw('notify', 'Notify when the app is in the background', typeof Native !== 'undefined' && Native.isNative ? 'So you hear it with the phone locked' : 'In the phone app; on the website, only if browser notifications are on')}
      ${sw('leadIn', '3-second countdown before holds', 'Time to get into position')}
      <button class="btn ghost sm" data-act="timer-test" style="align-self:flex-start">${icon('play', 16)} Test sound</button></div>`;
    return settings(s).replace('<div class="card" style="box-shadow:none" id="set-reminders">', card + '<div class="card" style="box-shadow:none" id="set-reminders">');
  };
  ACT['timer-pref'] = t => { const P = timerPrefs(); P[t.dataset.k] = !P[t.dataset.k]; save(); render(); if (t.dataset.k === 'notify' && P.notify && typeof Native !== 'undefined' && Native.isNative) Native.notifPermission(true).catch(() => {}); };
  ACT['timer-test'] = () => { const P = timerPrefs(); if (!P.sound) { toast('Sound is off'); return; } Beep.unlock(); Beep.play('done'); buzz([200, 100, 200]); };
}
