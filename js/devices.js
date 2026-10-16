/* Movla — watches and smart scales.
   Every major brand writes into Apple Health (iPhone) or Health Connect (Android), and Movla reads
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
    return sheetHead('Set up your watch or scale', `Your device's app shares with ${both ? 'Apple Health or Health Connect' : hub}; Movla reads from there`)
      + `<ol class="small" style="margin:0;padding-left:20px;display:grid;gap:4px">
          <li>${on ? `<b>${hub} is connected.</b>` : `Connect ${both ? 'Apple Health or Health Connect in the phone app' : hub} in Movla (Settings → Phone and watch data).`}</li>
          <li>In your device's own app, turn on sharing with ${both ? 'Apple Health / Health Connect' : hub} (steps below).</li>
          <li>Come back and tap <b>Sync now</b>. New data appears within a few minutes of your device syncing.</li></ol>
        <div class="list">${rows.map(g => `<button class="li" data-act="device-pick" data-id="${g.id}" aria-expanded="${open === g.id}"><span class="grow"><span class="t">${esc(g.name)}</span><br><span class="d">${esc(g.kind === 'Any' ? 'Any watch, ring, scale or app' : g.kind)}</span></span><span class="chev">${icon(open === g.id ? 'chevD' : 'chevR', 18)}</span></button>
          ${open === g.id ? `<div class="card" style="box-shadow:none;gap:6px;margin:4px 0 8px">${both
            ? `${g.ios ? `<p class="small" style="margin:0"><b>iPhone:</b> ${esc(g.ios)}</p>` : ''}${g.android ? `<p class="small" style="margin:0"><b>Android:</b> ${esc(g.android)}</p>` : ''}`
            : `<p class="small" style="margin:0">${esc(g[plat])}</p>`}</div>` : ''}`).join('')}</div>
        ${plat === 'android' || both ? `<p class="tiny faint" style="margin:0">Two devices counting steps? In Health Connect → Data and access → Steps → Data sources and priority, put your main device first so steps aren't counted twice.</p>` : ''}
        ${on ? `<button class="btn ghost block" data-act="health-sync">Sync now</button>` : (typeof HealthSync !== 'undefined' && HealthSync.ok() ? `<button class="btn train block" data-act="health-open">Connect ${hub}</button>` : `<p class="tiny faint" style="margin:0">Watches and scales connect in the Movla phone app.</p>`)}
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
      `<div class="card" style="box-shadow:none"><span class="eyebrow">Phone and watch data</span><button class="li" data-act="devices-open"><span class="ni">${icon('heart', 20)}</span><span class="grow"><span class="t">Watches and smart scales</span><br><span class="d">Works in the phone app with Garmin, Fitbit, Apple Watch, Withings, Renpho and more. Shopping for one? See what\'s compatible</span></span><span class="chev">${icon('chevR', 18)}</span></button></div>
      <div class="card" style="box-shadow:none" id="set-profile">`);
  };
}

/* ---------- Shopping for a compatible device ----------
   A quiet guide, reached only from the watch-and-scale guide (Settings → Watches and smart scales, or the health
   sheet in the phone app). Nothing about it appears unless someone opens it.
   Affiliate links: paste each brand's tracking link into `link` once you're approved (Renpho's own program,
   Withings on Awin, Garmin/Oura/Fitbit/WHOOP on Impact or Awin). If `link` is empty and DEVICE_SHOP.amazonTag is set,
   the button goes to an Amazon search with your Associates tag; otherwise to the brand's own site, untracked. */
const DEVICE_SHOP = {
  amazonTag: '',   // Amazon Associates tracking ID, e.g. 'movla-20'
  picks: [
    { id: 'renpho', kind: 'scale', name: 'Renpho smart scale', note: 'Budget pick. Weight and body fat; shares with Apple Health and Health Connect.', site: 'https://renpho.com/collections/smart-scales', q: 'Renpho smart scale', link: '' },
    { id: 'eufy', kind: 'scale', name: 'Eufy smart scale', note: 'Budget pick. Weight and body fat through the EufyLife app.', site: 'https://www.eufy.com/collections/smart-scales', q: 'eufy smart scale', link: '' },
    { id: 'withings', kind: 'scale', name: 'Withings Body scale', note: 'Premium pick. Accurate, Wi-Fi sync, no phone needed at weigh-in.', site: 'https://www.withings.com/us/en/scales', q: 'Withings Body smart scale', link: '' },
    { id: 'garmin', kind: 'watch', name: 'Garmin watch', note: 'Long battery, strong workout tracking. Forerunner for running, Venu for everyday.', site: 'https://www.garmin.com/en-US/c/wearables-smartwatches/', q: 'Garmin Forerunner watch', link: '' },
    { id: 'fitbit', kind: 'watch', name: 'Fitbit tracker', note: 'Simple and affordable: steps, sleep and heart rate.', site: 'https://store.google.com/category/watches_trackers', q: 'Fitbit Charge', link: '' },
    { id: 'apple', kind: 'watch', name: 'Apple Watch', note: 'For iPhone. Saves to Apple Health automatically.', site: 'https://www.apple.com/watch/', q: 'Apple Watch', link: '', only: 'ios' },
    { id: 'samsung', kind: 'watch', name: 'Samsung Galaxy Watch', note: 'For Android. Shares through Samsung Health.', site: 'https://www.samsung.com/us/watches/', q: 'Samsung Galaxy Watch', link: '', only: 'android' },
    { id: 'oura', kind: 'ring', name: 'Oura Ring', note: 'Sleep and recovery in a ring. Needs an Oura membership.', site: 'https://ouraring.com/', q: 'Oura Ring', link: '' },
    { id: 'whoop', kind: 'band', name: 'WHOOP', note: 'Strap focused on strain and recovery. Sold as a membership.', site: 'https://www.whoop.com/', q: '', link: '' },
  ],
};
function deviceShopUrl(p) {
  if (p.link) return p.link;
  if (DEVICE_SHOP.amazonTag && p.q) return `https://www.amazon.com/s?k=${encodeURIComponent(p.q)}&tag=${encodeURIComponent(DEVICE_SHOP.amazonTag)}`;
  return p.site;
}
const deviceShopTracked = () => !!DEVICE_SHOP.amazonTag || DEVICE_SHOP.picks.some(p => p.link);

SHEETS.deviceShop = () => {
  const plat = (typeof Native !== 'undefined' && Native.platform) || 'web';
  const picks = DEVICE_SHOP.picks.filter(p => !p.only || plat === 'web' || p.only === plat);
  const group = (title, kinds) => {
    const rows = picks.filter(p => kinds.includes(p.kind));
    return rows.length ? `<span class="eyebrow" style="margin-top:4px">${title}</span><div class="list">${rows.map(p => `<a class="li" href="${esc(deviceShopUrl(p))}" target="_blank" rel="noopener sponsored" data-shop="${p.id}"><span class="grow"><span class="t">${esc(p.name)}${p.only && plat === 'web' ? ` <span class="faint small">(${p.only === 'ios' ? 'iPhone' : 'Android'})</span>` : ''}</span><br><span class="d">${esc(p.note)}</span></span><span class="chev">${icon('external', 16)}</span></a>`).join('')}</div>` : '';
  };
  return sheetHead('Compatible devices', 'All of these work with Movla through Apple Health or Health Connect')
    + group('Smart scales', ['scale']) + group('Watches, rings and bands', ['watch', 'ring', 'band'])
    + `<p class="tiny faint" style="margin:0">Any device that shares with ${plat === 'ios' ? 'Apple Health' : plat === 'android' ? 'Health Connect' : 'Apple Health or Health Connect'} works, not only these. Prices and models change, so check the store page.${deviceShopTracked() ? ' Movla may earn a commission if you buy through these links, at no extra cost to you.' : ''}</p>`;
};
ACT['device-shop'] = () => pushSheet({ type: 'deviceShop' });

/* One quiet line at the bottom of the setup guide. */
{
  const guide = SHEETS.devices;
  SHEETS.devices = s => guide(s) + `<button class="link" data-act="device-shop" style="align-self:center">Don't have one yet? See compatible scales and watches</button>`;
}
