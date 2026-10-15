/* Groundwork — watches and smart scales.
   Every major brand writes into Apple Health (iPhone) or Health Connect (Android), and Groundwork reads
   those hubs (health.js), so one connection covers them all. This file adds:
   - a "Set up your watch or scale" guide with the switch to flip in each brand's own app
   - body fat % from smart scales, next to body weight on Today and in Progress
   - where a weigh-in came from ("from Renpho") */

const DEVICE_GUIDES = [
  { id: 'apple', name: 'Apple Watch', kind: 'Watch', ios: 'Nothing to do: Apple Watch saves to Apple Health automatically.', android: null },
  { id: 'garmin', name: 'Garmin', kind: 'Watch',
    ios: 'Garmin Connect app → More → Settings → Connected Apps → Apple Health. Turn on the data you want to share.',
    android: 'Garmin Connect app → More → Settings → Connected Apps → Health Connect. Allow steps, sleep, heart rate, weight and workouts.' },
  { id: 'fitbit', name: 'Fitbit / Pixel Watch', kind: 'Watch',
    ios: 'Fitbit (Google Health) app → your profile → Settings → look for "Apple Health" and turn sharing on. Older versions of the Fitbit app can\'t share with Apple Health.',
    android: 'Fitbit (Google Health) app → your profile → Settings → Health Connect. Turn on sharing.' },
  { id: 'samsung', name: 'Samsung Galaxy Watch', kind: 'Watch', ios: null,
    android: 'Samsung Health app → ☰ menu → Settings → Health Connect. Allow Samsung Health to write your data.' },
  { id: 'oura', name: 'Oura Ring', kind: 'Watch',
    ios: 'Oura app → ☰ menu → Settings → Apple Health. Turn it on.',
    android: 'Oura app → ☰ menu → Settings → Health Connect. Turn it on.' },
  { id: 'whoop', name: 'WHOOP', kind: 'Watch',
    ios: 'WHOOP app → More → App Settings → Integrations → Apple Health.',
    android: 'WHOOP app → More → App Settings → Integrations → Health Connect.' },
  { id: 'withings', name: 'Withings scale', kind: 'Scale',
    ios: 'Withings app → Profile → Health apps → Apple Health. Allow weight and body fat.',
    android: 'Withings app → Profile → Health apps → Health Connect. Allow weight and body fat.' },
  { id: 'renpho', name: 'Renpho scale', kind: 'Scale',
    ios: 'Renpho Health app → Me (or Settings) → Apple Health. Turn on weight and body fat.',
    android: 'Renpho Health app → Me (or Settings) → Health Connect. Turn on weight and body fat.' },
  { id: 'eufy', name: 'Eufy scale', kind: 'Scale',
    ios: 'EufyLife app → Me → Settings → Apple Health. Turn on weight and body fat.',
    android: 'EufyLife app → Me → Settings → Health Connect. Turn on weight and body fat.' },
  { id: 'strava', name: 'Strava', kind: 'App',
    ios: 'Strava app → You → Settings → Applications, Services, and Devices → Health. Turn on sharing.',
    android: 'Strava app → You → Settings → Applications, Services, and Devices → Health Connect. Turn on sharing.' },
  { id: 'other', name: 'Another brand', kind: 'Any',
    ios: 'In that brand\'s app, open Settings and look for "Apple Health", often under Connected apps, Integrations or Partners.',
    android: 'In that brand\'s app, open Settings and look for "Health Connect", often under Connected apps, Integrations or Partners.' },
];

/* Body fat from smart scales (S.healthData.bodyFat = { 'YYYY-MM-DD': { pct, from } }). */
function bodyFatSummary() {
  const bf = (S.healthData && S.healthData.bodyFat) || {}, days = Object.keys(bf).sort();
  if (!days.length) return null;
  const last = days[days.length - 1], cut = addDays(last, -30), old = days.filter(k => k >= cut)[0];
  const change = old && old !== last ? Math.round((bf[last].pct - bf[old].pct) * 10) / 10 : null;
  return { date: last, pct: bf[last].pct, from: bf[last].from || '', change, since: old };
}

Object.assign(SHEETS, {
  devices() {
    const plat = (typeof Native !== 'undefined' && Native.platform) || 'web';
    const hub = plat === 'ios' ? 'Apple Health' : 'Health Connect';
    const both = plat !== 'ios' && plat !== 'android';
    const rows = DEVICE_GUIDES.filter(g => both || g[plat]);
    const on = !!(S.health && S.health.on);
    const open = UI.sheet && UI.sheet.open;
    return sheetHead('Set up your watch or scale', `Your device's app shares with ${both ? 'Apple Health or Health Connect' : hub}; Groundwork reads from there`)
      + `<ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
          <li>${on ? `<b>${hub} is connected.</b>` : `Connect ${both ? 'Apple Health or Health Connect in the phone app' : hub} in Groundwork (Settings → Phone and watch data).`}</li>
          <li>In your device's own app, turn on sharing with ${both ? 'Apple Health / Health Connect' : hub} (steps below).</li>
          <li>Come back and tap <b>Sync now</b>. New data appears within a few minutes of your device syncing.</li></ol>
        <div class="list">${rows.map(g => `<button class="li" data-act="device-pick" data-id="${g.id}" aria-expanded="${open === g.id}"><span class="grow"><span class="t">${esc(g.name)}</span><br><span class="d">${esc(g.kind === 'Any' ? 'Any watch, ring, scale or app' : g.kind)}</span></span><span class="chev">${icon(open === g.id ? 'chevD' : 'chevR', 18)}</span></button>
          ${open === g.id ? `<div class="card" style="box-shadow:none;gap:6px;margin:4px 0 8px">${both
            ? `${g.ios ? `<p class="small" style="margin:0"><b>iPhone:</b> ${esc(g.ios)}</p>` : ''}${g.android ? `<p class="small" style="margin:0"><b>Android:</b> ${esc(g.android)}</p>` : ''}`
            : `<p class="small" style="margin:0">${esc(g[plat])}</p>`}</div>` : ''}`).join('')}</div>
        ${plat === 'android' || both ? `<p class="tiny faint" style="margin:0">Two devices counting steps? In Health Connect → Data and access → Steps → Data sources and priority, put your main device first so steps aren't counted twice.</p>` : ''}
        ${on ? `<button class="btn ghost block" data-act="health-sync">Sync now</button>` : (typeof HealthSync !== 'undefined' && HealthSync.ok() ? `<button class="btn train block" data-act="health-open">Connect ${hub}</button>` : `<p class="tiny faint" style="margin:0">Watches and scales connect in the Groundwork phone app.</p>`)}
        <p class="tiny faint" style="margin:0">Menu names change between app versions. If a step doesn't match, look in the app's settings for "${both ? 'Apple Health / Health Connect' : hub}".</p>`;
  },
});

Object.assign(ACT, {
  'devices-open': () => pushSheet({ type: 'devices' }),
  'device-pick': t => { UI.sheet.open = UI.sheet.open === t.dataset.id ? null : t.dataset.id; render(); },
});

/* Today: where the last weigh-in came from, and the latest body fat. */
{
  const today = viewToday;
  viewToday = () => {
    const html = today(), lw = typeof lastWeight === 'function' ? lastWeight(S) : null, bf = bodyFatSummary();
    const bits = [];
    if (lw && lw.source === 'health' && lw.from) bits.push('from ' + esc(lw.from));
    if (bf && bf.date >= addDays(todayKey(), -14)) bits.push(`Body fat <b>${bf.pct}%</b>${bf.from && !(lw && lw.from === bf.from) ? ' · ' + esc(bf.from) : ''}`);
    if (!bits.length) return html;
    const head = html.indexOf('<span class="eyebrow">Body weight</span>'); if (head < 0) return html;
    const at = html.indexOf('<div class="tiny faint">', head); if (at < 0) return html;
    const end = html.indexOf('</div>', at) + 6;
    return html.slice(0, end) + `<div class="tiny faint">${bits.join(' · ')}</div>` + html.slice(end);
  };
}
/* Progress: body fat trend under the activity card. */
if (typeof activityProgressCard === 'function') {
  const card = activityProgressCard;
  activityProgressCard = () => {
    const html = card(), bf = bodyFatSummary();
    if (!html || !bf) return html;
    const line = `<p class="small muted" style="margin:0">Body fat: <b>${bf.pct}%</b> on ${shortDate(bf.date)}${bf.from ? ' (' + esc(bf.from) + ')' : ''}${bf.change != null ? `, ${bf.change > 0 ? '+' : ''}${bf.change} points since ${shortDate(bf.since)}` : ''}</p>`;
    const i = html.lastIndexOf('</div>');
    return html.slice(0, i) + line + html.slice(i);
  };
}
/* The settings entry and the health sheet show the guide; the web build shows it too, for planning. */
{
  const settings = SHEETS.settings;
  SHEETS.settings = s => {
    const html = settings(s);
    if (typeof HealthSync !== 'undefined' && HealthSync.ok()) return html;   // phone app: reached from the health sheet
    return html.replace('<div class="card" style="box-shadow:none" id="set-profile">',
      `<div class="card" style="box-shadow:none"><span class="eyebrow">Phone and watch data</span><button class="li" data-act="devices-open"><span class="ni">${icon('heart', 20)}</span><span class="grow"><span class="t">Watches and smart scales</span><br><span class="d">Works in the phone app with Garmin, Fitbit, Apple Watch, Withings, Renpho and more</span></span><span class="chev">${icon('chevR', 18)}</span></button></div>
      <div class="card" style="box-shadow:none" id="set-profile">`);
  };
}
