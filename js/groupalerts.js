/* Movla — notifications for families and challenges (migration 012).
   - Cheers you get, and people joining your family or challenge (from my_group_activity)
   - Leaderboard moves in live challenges: you moved up, someone passed you
   - Family team goal reached for the week
   - Challenge dates, scheduled on the phone so they arrive even with the app closed:
     starts today, last day tomorrow, final results
   In the app they show as a toast and in the reminders bell; with the app in the background they arrive
   as phone notifications (needs Settings → Reminders → phone notifications on). Each kind can be turned
   off in Settings → Reminders. */

const GroupAlerts = (() => {
  const KEY = 'groundwork.groupAlerts';
  const ls = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  // { uid, since, ranks: {groupId: rank}, done: {key: 1}, feed: [{id, at, title, body, group_id, seen}] }
  let M = ls.get();
  const me = () => (typeof Cloud !== 'undefined' && Cloud.signedIn() ? Cloud.me() : null);
  function mine() { if (M.uid !== me()) M = { uid: me(), since: new Date().toISOString(), ranks: {}, done: {}, feed: [] }; return M; }
  const save = () => { const m = mine(); m.feed = (m.feed || []).slice(0, 40); const keys = Object.keys(m.done || {}); if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(k => delete m.done[k]); ls.set(m); };
  const prefs = () => { const R = S.reminders || {}; return { cheers: R.groupCheers !== false, ranks: R.groupRanks !== false, dates: R.groupDates !== false }; };
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
  const native = () => typeof Native !== 'undefined' && Native.isNative;
  const phoneOn = () => !!(S.reminders && S.reminders.browser);

  /* ---------- deliver ---------- */
  let nid = 0;
  function notify(items) {
    if (!items.length) return;
    const m = mine();
    items.forEach(it => { if (!it.at) it.at = new Date().toISOString(); if (!m.feed.some(f => f.id === it.id)) m.feed.unshift(Object.assign({ seen: false }, it)); });
    save();
    if (document.visibilityState === 'visible') {
      toast(items.length === 1 ? items[0].title : `${items[0].title} (+${items.length - 1} more)`);
      render();
      return;
    }
    const shown = items.slice(0, 3);
    if (native() && phoneOn()) {
      Native.call('LocalNotifications', 'schedule', { notifications: shown.map(it => ({ id: 8200 + (nid++ % 50), title: it.title, body: it.body || '', schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }, extra: { act: 'group', id: it.group_id } })) }).catch(() => null);
    } else if (phoneOn()) {
      try { if ('Notification' in window && Notification.permission === 'granted') shown.forEach(it => new Notification(it.title, { body: it.body || '', tag: 'movla-' + it.id, icon: 'icons/icon-192.png' })); } catch (e) { /* not available */ }
    }
  }

  /* ---------- what changed ---------- */
  function cheerText(list) {
    const who = [...new Set(list.map(e => e.who))];
    const names = who.length <= 2 ? who.join(' and ') : `${who.slice(0, 2).join(', ')} and ${who.length - 2} other${who.length - 2 > 1 ? 's' : ''}`;
    const w = list.find(e => e.workout);
    return { title: `${names} cheered you on`, body: w ? `${w.workout} · ${w.group}` : list[0].group };
  }
  async function poll() {
    if (typeof Groups === 'undefined' || !Groups.available() || !me() || !S.onboarded) return;
    const m = mine(), P = prefs(), out = [];
    // Cheers and new members since last time.
    try {
      const ev = await Cloud.rpc('my_group_activity', { p_since: m.since });
      m.since = new Date(Date.now() - 5000).toISOString();
      const fresh = (ev || []).filter(e => { const k = `${e.kind}:${e.group_id}:${e.who}:${e.ref || ''}:${e.at}`; if (m.done[k]) return false; m.done[k] = 1; return true; });
      const cheers = fresh.filter(e => e.kind === 'cheer');
      if (P.cheers && cheers.length) {
        const byGroup = {};
        cheers.forEach(e => (byGroup[e.group_id] = byGroup[e.group_id] || []).push(e));
        Object.values(byGroup).forEach(list => { const t = cheerText(list); out.push({ id: 'c' + list[0].at + list[0].group_id, at: list[0].at, group_id: list[0].group_id, ...t }); });
      }
      if (P.ranks) fresh.filter(e => e.kind === 'joined').forEach(e => out.push({ id: 'j' + e.at + e.who, at: e.at, group_id: e.group_id, title: `${e.who} joined ${e.group}`, body: e.group_kind === 'challenge' ? 'One more on the leaderboard.' : 'Say hi with a cheer on their next workout.' }));
    } catch (e) { /* 012 not run yet, or offline */ }
    // Leaderboard moves, team goals and finished challenges, from the details Groups already loads.
    Groups.list().forEach(g => {
      const d = Groups.detail(g.id); if (!d) return;
      const G = d.group, meRow = d.members.find(x => x.is_me);
      if (G.kind === 'challenge' && meRow) {
        const prev = m.ranks[g.id], now = meRow.rank;
        if (P.ranks && prev && now && now !== prev && !G.ended && d.members.length > 1) {
          if (now < prev) out.push({ id: `r${g.id}${now}${todayKey()}`, group_id: g.id, title: now === 1 ? `You're in 1st in ${G.name}!` : `You moved up to ${ord(now)} in ${G.name}`, body: `${d.members.length} people · keep it going` });
          else { const ahead = d.members.find(x => x.rank === now - 1 && !x.is_me) || d.members.find(x => x.rank && x.rank < now && !x.is_me); out.push({ id: `r${g.id}${now}${todayKey()}`, group_id: g.id, title: `${ahead ? ahead.name + ' passed you' : 'Someone passed you'} in ${G.name}`, body: `You're ${ord(now)} of ${d.members.length}. Time to catch up.` }); }
        }
        if (now) m.ranks[g.id] = now;
        const endKey = 'end:' + g.id;
        if (P.dates && G.ended && !m.done[endKey]) {
          m.done[endKey] = 1;
          const top = d.members.filter(x => x.rank === 1).map(x => (x.is_me ? 'You' : x.name));
          if (top.length) out.push({ id: endKey, group_id: g.id, title: `${G.name} is over`, body: top.length > 1 ? `${top.join(' and ')} tied for first.` : top[0] === 'You' ? 'You won! 🏆' : `${top[0]} won. You finished ${meRow.rank ? ord(meRow.rank) : 'the challenge'}.` });
        }
      }
      if (G.kind === 'family' && G.weekly_goal && G.team_week >= G.weekly_goal) {
        const k = `goal:${g.id}:${G.week_start}`;
        if (P.ranks && !m.done[k]) { m.done[k] = 1; out.push({ id: k, group_id: g.id, title: `${G.name} hit the team goal`, body: `${G.team_week} workouts this week. Nice work, everyone.` }); }
      }
    });
    save();
    notify(out);
    schedule();
  }

  /* ---------- challenge dates, scheduled ahead on the phone ---------- */
  const SID = 8100, SMAX = 8199;
  let lastPlan = '';
  async function schedule() {
    if (!native()) return;
    const P = prefs(), list = [], now = Date.now();
    const at = (key, hh) => { const d = parseKey(key); d.setHours(hh, 0, 0, 0); return d; };
    if (P.dates && phoneOn()) Groups.list().filter(g => g.kind === 'challenge' && !g.ended).forEach(g => {
      const push = (d, title, body) => { if (d.getTime() > now + 60000) list.push({ title, body, schedule: { at: d, allowWhileIdle: true }, extra: { act: 'group', id: g.id } }); };
      if (g.starts_on > todayKey()) push(at(g.starts_on, 8), `${g.name} starts today`, g.metric === 'weight_loss' ? 'Log a weigh-in this morning so your starting point counts.' : g.metric === 'body_fat' ? 'Log your body fat today so your starting point counts.' : 'Good luck. Every workout counts from today.');
      push(at(addDays(g.ends_on, -1), 18), `${g.name}: last day tomorrow`, g.metric === 'weight_loss' || g.metric === 'body_fat' ? 'Weigh in tomorrow morning so your final number counts.' : 'One more day to climb the leaderboard.');
      push(at(addDays(g.ends_on, 1), 9), `Final results: ${g.name}`, 'See who won and where you finished.');
    });
    const plan = JSON.stringify(list.map(n => [n.title, +n.schedule.at]));
    if (plan === lastPlan) return;
    lastPlan = plan;
    try {
      const pend = await Native.call('LocalNotifications', 'getPending');
      const ours = ((pend && pend.notifications) || []).filter(n => n.id >= SID && n.id <= SMAX).map(n => ({ id: n.id }));
      if (ours.length) await Native.call('LocalNotifications', 'cancel', { notifications: ours });
      if (list.length) await Native.call('LocalNotifications', 'schedule', { notifications: list.slice(0, 99).map((n, i) => Object.assign({ id: SID + i }, n)) });
    } catch (e) { lastPlan = ''; }
  }

  /* ---------- the reminders bell: unseen group activity from the last 2 days ---------- */
  const unseen = () => (mine().feed || []).filter(f => !f.seen && Date.now() - (Date.parse(f.at) || Date.now()) < 2 * 864e5);
  function markSeen(groupId) { const m = mine(); let ch = false; (m.feed || []).forEach(f => { if (!f.seen && (!groupId || f.group_id === groupId)) { f.seen = true; ch = true; } }); if (ch) save(); }

  return { poll, schedule, unseen, markSeen, prefs };
})();

/* Bell: one entry per group with news. */
{
  const rem = computeReminders;
  computeReminders = function (state, now) {
    const out = rem(state, now);
    if (!state.onboarded || typeof Groups === 'undefined' || !Groups.available()) return out;
    const byGroup = {};
    GroupAlerts.unseen().forEach(f => (byGroup[f.group_id] = byGroup[f.group_id] || []).push(f));
    Object.entries(byGroup).forEach(([gid, list]) => out.unshift({ id: 'grp-' + gid, level: 'normal', title: list[0].title, body: list.length > 1 ? `${list[0].body ? list[0].body + ' · ' : ''}${list.length - 1} more update${list.length > 2 ? 's' : ''}` : (list[0].body || ''), action: 'grp-open-bell', actionLabel: 'Open', icon: 'trophy', data: gid }));
    return out;
  };
}
/* Opening a group marks its news as seen. The bell's button carries the group id in data-id. */
ACT['grp-open-bell'] = t => { const id = t.dataset.id || t.dataset.v; if (!id) return; GroupAlerts.markSeen(id); UI.sheet = null; UI.stack = []; UI.tab = 'progress'; render(); pushSheet({ type: 'group', id, tall: true }); };
{
  const open = ACT['grp-open'];
  ACT['grp-open'] = t => { GroupAlerts.markSeen(t.dataset.id); open(t); };
}

/* Settings → Reminders: three switches. */
{
  const settings = SHEETS.settings;
  SHEETS.settings = s => {
    const html = settings(s);
    if (typeof Groups === 'undefined' || !Groups.available() || !Cloud.signedIn()) return html;
    const R = S.reminders || {};
    const sw = (k, label, sub) => `<div class="toggle"><span class="small"><b>${label}</b>${sub ? `<br><span class="faint">${sub}</span>` : ''}</span><button class="switch" role="switch" aria-checked="${R[k] !== false}" data-act="grp-rem" data-k="${k}" aria-label="${label}"></button></div>`;
    const block = `<span class="eyebrow" style="margin-top:6px">Family &amp; challenges</span>${sw('groupCheers', 'Cheers', 'When someone cheers your workout')}${sw('groupRanks', 'Leaderboard and team news', 'Moving up or being passed, new members, team goals')}${sw('groupDates', 'Challenge dates', 'Start day, last day, final results')}`;
    return html.replace(/(<div class="card" style="box-shadow:none" id="set-reminders">[\s\S]*?)(<\/div>\s*<div class="card" style="box-shadow:none"><span class="eyebrow">App<\/span>)/, (m, a, b) => a + block + b);
  };
  ACT['grp-rem'] = t => { const R = S.reminders; R[t.dataset.k] = R[t.dataset.k] === false; save(); render(); GroupAlerts.schedule(); };
}

/* When to check: after the group screens refresh, every 2 minutes while the app is open, and on return. */
{
  const refresh = Groups.refresh;
  Groups.refresh = async (...a) => { const r = await refresh(...a); GroupAlerts.poll(); return r; };
  // Also while the app is in the background (as long as the phone keeps it running), so news can arrive as a notification.
  setInterval(() => Groups.refresh(true), 120000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => Groups.refresh(true), 800); });
  setTimeout(() => Groups.refresh(false), 3000);
}
