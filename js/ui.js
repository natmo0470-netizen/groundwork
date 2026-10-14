/* Groundwork — small UI helpers: icons, escaping, formatting, charts. */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
  fork: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M17 3c-1.8 0-3 2.2-3 5.5S15.2 13 17 13v8"/>',
  chart: '<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 21h4"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  chevL: '<path d="M15 5l-7 7 7 7"/>',
  chevR: '<path d="M9 5l7 7-7 7"/>',
  chevD: '<path d="M6 9l6 6 6-6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  timer: '<path d="M12 9v4.5l2.5 1.5M9.5 2.5h5"/><circle cx="12" cy="14" r="7.5"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.8 4M16 6h3.5a3.5 3.5 0 0 1-3.8 4M12 13v4M8 21h8M9.5 17h5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  swap: '<path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.6-1.8"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
  flame: '<path d="M12 21c3.9 0 7-2.6 7-6.8 0-3.3-2.3-5.7-3.8-7.7-.5 1.9-1.5 2.9-3 2.9 0-2.8-1-4.9-3-5.9 0 3-4.2 5.8-4.2 10.7C5 18.4 8.1 21 12 21z"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 13h9l1-13M9.5 7V4h5v3"/>',
  arrowL: '<path d="M19 12H5.5M11 6l-6 6 6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4.2-6.5 8-6.5s7 2 8 6.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.1a4.3 4.3 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20z"/>',
  mountain: '<path d="M3 19 9.5 8l4 6.5L16 11l5 8z"/>',
  run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M9 21l2.5-5.5 3 2.5V22M6 12l3-3.5 4 1 2.5 3.5 3 .5M11.5 15.5 13 9.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  sofa: '<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 12a1.5 1.5 0 0 1 3 0v2h12v-2a1.5 1.5 0 0 1 3 0v5H3zM5 17v2M19 17v2"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 2.5 2.5V21M8 11.5l2.5-3.5 3 .5 2 3.5 2.5.5M12 15l1-6"/>',
  box: '<path d="M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8"/>',
  barcode: '<path d="M4 6v12M7.5 6v12M10 6v12M13.5 6v12M17 6v12M20 6v12"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v7h14v-7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
};
function icon(name, size, extra) {
  const s = size || 20;
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra || ''}>${ICONS[name] || ''}</svg>`;
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const r0 = n => Math.round(n);
const fmtInt = n => Math.round(n).toLocaleString();

function ring(value, target, color, size) {
  const r = 56, c = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  const over = value > target;
  return `<svg viewBox="0 0 132 132" aria-hidden="true"><circle cx="66" cy="66" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
    ${pct > 0 ? `<circle cx="66" cy="66" r="${r}" fill="none" stroke="${over ? 'var(--bad)' : color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(pct * c).toFixed(1)} ${c.toFixed(1)}"/>` : ''}</svg>`;
}

function macroBar(cls, label, val, target) {
  const pct = target > 0 ? Math.min(100, (val / target) * 100) : 0;
  const over = val > target * 1.1;
  return `<div class="macro ${cls}"><div class="k">${label}</div><div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div><div class="small num ${over ? 'over' : ''}"><b>${r0(val)}</b><span class="faint"> / ${r0(target)} g</span></div></div>`;
}

/* Weight trend: raw weigh-ins as dots, 7-day average as the line. */
function weightChart(state, days) {
  const end = todayKey();
  const start = days ? addDays(end, -(days - 1)) : (state.weights[0] ? state.weights[0].date : end);
  const pts = state.weights.filter(w => w.date >= start && w.date <= end);
  if (pts.length < 2) return '';
  const W = 340, H = 168, L = 34, Rr = 12, T = 12, B = 24;
  const span = Math.max(1, daysBetween(start, end));
  const vals = pts.map(p => kgToDisp(state, p.kg, 1));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max(0.6, (hi - lo) * 0.18); lo -= pad; hi += pad;
  const X = k => L + (daysBetween(start, k) / span) * (W - L - Rr);
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const trend = pts.map(p => {
    const win = state.weights.filter(w => w.date <= p.date && w.date >= addDays(p.date, -6));
    return [p.date, kgToDisp(state, win.reduce((s, w) => s + w.kg, 0) / win.length, 2)];
  });
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const line = trend.map((t, i) => `${i ? 'L' : 'M'}${X(t[0]).toFixed(1)} ${Y(t[1]).toFixed(1)}`).join(' ');
  const area = line + ` L${X(trend[trend.length - 1][0]).toFixed(1)} ${H - B} L${X(trend[0][0]).toFixed(1)} ${H - B} Z`;
  const last = trend[trend.length - 1];
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend">
    ${ticks.map(v => `<line class="grid" x1="${L}" x2="${W - Rr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${L - 6}" y="${(Y(v) + 3.5).toFixed(1)}" text-anchor="end">${v.toFixed(0)}</text>`).join('')}
    <path class="area" d="${area}"/>
    ${pts.map(p => `<circle class="raw" cx="${X(p.date).toFixed(1)}" cy="${Y(kgToDisp(state, p.kg, 2)).toFixed(1)}" r="3"/>`).join('')}
    <path class="trend" d="${line}"/>
    <circle class="end" cx="${X(last[0]).toFixed(1)}" cy="${Y(last[1]).toFixed(1)}" r="5"/>
    <text x="${L}" y="${H - 6}">${shortDate(start)}</text><text x="${W - Rr}" y="${H - 6}" text-anchor="end">${shortDate(end)}</text>
  </svg>`;
}

function calorieChart(state, target) {
  const W = 340, H = 140, L = 8, Rr = 8, T = 14, B = 22;
  const days = [...Array(7)].map((_, i) => addDays(todayKey(), i - 6));
  const vals = days.map(d => foodTotals(state, d).kcal);
  const max = Math.max(target * 1.25, ...vals);
  const bw = (W - L - Rr) / 7;
  const Y = v => T + (1 - v / max) * (H - T - B);
  const ty = Y(target);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories, last 7 days">
    ${days.map((d, i) => {
      const v = vals[i], x = L + i * bw + bw * 0.2, w = bw * 0.6;
      const h = v ? (H - B) - Y(v) : 4;
      const cls = !v ? 'bar empty' : v > target * 1.1 ? 'bar over' : 'bar';
      return `<rect class="${cls}" x="${x.toFixed(1)}" y="${(H - B - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="4"/><text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${DOW[parseKey(d).getDay()].slice(0, 2)}</text>`;
    }).join('')}
    <line class="target" x1="${L}" x2="${W - Rr}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}"/>
    <text x="${W - Rr}" y="${(ty - 4).toFixed(1)}" text-anchor="end">Target ${fmtInt(target)}</text>
  </svg>`;
}
