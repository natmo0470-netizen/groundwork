/* Movla — animated exercise demos.
   A side-view figure drawn from a few key points per pose (hip, neck, ankles, hands);
   knees and elbows are solved with two-bone inverse kinematics so feet stay planted
   and limbs keep their length. Poses interpolate with easing and loop. */
(function () {
  const VB = '0 -28 200 216';
  const GROUND = 184;
  const LEN = { torso: 50, thigh: 40, shin: 40, upper: 30, fore: 28 };

  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const len = a => Math.hypot(a[0], a[1]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const f1 = n => Math.round(n * 10) / 10;

  function ik(a, c, l1, l2, pref) {
    const v = sub(c, a);
    let d = len(v);
    const dir = norm(v);
    d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.2, d));
    const end = add(a, mul(dir, d));
    const base = Math.atan2(dir[1], dir[0]);
    const ang = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const j1 = [a[0] + l1 * Math.cos(base + ang), a[1] + l1 * Math.sin(base + ang)];
    const j2 = [a[0] + l1 * Math.cos(base - ang), a[1] + l1 * Math.sin(base - ang)];
    const mid = mul(add(a, end), 0.5);
    const s1 = (j1[0] - mid[0]) * pref[0] + (j1[1] - mid[1]) * pref[1];
    const s2 = (j2[0] - mid[0]) * pref[0] + (j2[1] - mid[1]) * pref[1];
    return { joint: s1 >= s2 ? j1 : j2, end };
  }

  function lerp(a, b, t) {
    if (typeof a === 'number') return a + (b - a) * t;
    if (Array.isArray(a)) return a.map((v, i) => lerp(v, b[i], t));
    if (a && typeof a === 'object') { const o = {}; for (const k in a) o[k] = (k in b) ? lerp(a[k], b[k], t) : a[k]; return o; }
    return a;
  }

  function solve(fr) {
    const J = { hip: fr.hip, neck: fr.neck, legs: [], arms: [] };
    J.head = add(fr.neck, mul(norm(sub(fr.neck, fr.hip)), 14));
    fr.legs.forEach(L => {
      const r = ik(fr.hip, L.a, LEN.thigh, LEN.shin, L.k || [1, 0]);
      J.legs.push({ knee: r.joint, ankle: r.end, toe: L.t ? L.t : add(r.end, [12, 2]) });
    });
    fr.arms.forEach(A => {
      const r = ik(fr.neck, A.h, LEN.upper, LEN.fore, A.e || [0, 1]);
      J.arms.push({ elbow: r.joint, hand: r.end });
    });
    return J;
  }

  const pl = (pts, cls) => `<polyline class="${cls}" points="${pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' ')}"/>`;
  const ln = (a, b, cls) => `<line class="${cls}" x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}"/>`;

  function drawProp(type, at, J, def) {
    if (!type || type === 'none') return '';
    const p = at;
    switch (type) {
      case 'barbell': case 'smith':
        return `<circle class="plate" cx="${f1(p[0])}" cy="${f1(p[1])}" r="17"/><circle class="hub" cx="${f1(p[0])}" cy="${f1(p[1])}" r="3.5"/>`;
      case 'dumbbell':
        return `<circle class="plate" cx="${f1(p[0])}" cy="${f1(p[1])}" r="7"/><circle class="hub" cx="${f1(p[0])}" cy="${f1(p[1])}" r="2"/>`;
      case 'kettlebell':
        return `<path class="kbh" d="M${f1(p[0] - 5)} ${f1(p[1] + 4)} Q${f1(p[0])} ${f1(p[1] - 6)} ${f1(p[0] + 5)} ${f1(p[1] + 4)}"/><circle class="plate" cx="${f1(p[0])}" cy="${f1(p[1] + 11)}" r="8"/>`;
      case 'handle':
        return `<rect class="handle" x="${f1(p[0] - 5)}" y="${f1(p[1] - 3)}" width="10" height="6" rx="3"/>`;
      case 'cable': {
        const an = def.cable || [190, -20];
        return `<line class="cable" x1="${f1(an[0])}" y1="${f1(an[1])}" x2="${f1(p[0])}" y2="${f1(p[1])}"/><circle class="pulley" cx="${an[0]}" cy="${an[1]}" r="4"/><rect class="handle" x="${f1(p[0] - 4)}" y="${f1(p[1] - 3)}" width="8" height="6" rx="3"/>`;
      }
      case 'band': {
        const an = def.band || [100, GROUND];
        const mid = [(an[0] + p[0]) / 2 + 6, (an[1] + p[1]) / 2];
        return `<path class="band" d="M${f1(an[0])} ${f1(an[1])} Q${f1(mid[0])} ${f1(mid[1])} ${f1(p[0])} ${f1(p[1])}"/>`;
      }
      case 'pad':
        return `<circle class="pad" cx="${f1(p[0])}" cy="${f1(p[1])}" r="6"/>`;
      default: return '';
    }
  }

  // ---------- scenery ----------
  const S = {
    bench: (x1, x2, y) => `<rect class="eq" x="${x1}" y="${y}" width="${x2 - x1}" height="7" rx="2"/><line class="eqline" x1="${x1 + 8}" y1="${y + 7}" x2="${x1 + 8}" y2="${GROUND}"/><line class="eqline" x1="${x2 - 8}" y1="${y + 7}" x2="${x2 - 8}" y2="${GROUND}"/>`,
    rails: x => `<line class="rail" x1="${x - 4}" y1="-24" x2="${x - 4}" y2="${GROUND}"/><line class="rail" x1="${x + 4}" y1="-24" x2="${x + 4}" y2="${GROUND}"/>`,
    bar: y => `<line class="eqline" x1="56" y1="${y}" x2="150" y2="${y}"/><line class="rail" x1="60" y1="-26" x2="60" y2="${y}"/><line class="rail" x1="146" y1="-26" x2="146" y2="${y}"/>`,
    seat: (x, y, w) => `<rect class="eq" x="${x}" y="${y}" width="${w}" height="7" rx="2"/><line class="eqline" x1="${x + w / 2}" y1="${y + 7}" x2="${x + w / 2}" y2="${GROUND}"/>`,
    back: (x, y1, y2) => `<rect class="eq" x="${x}" y="${y1}" width="7" height="${y2 - y1}" rx="2"/>`,
    tread: () => `<rect class="eq" x="30" y="${GROUND - 6}" width="150" height="8" rx="4"/><line class="eqline" x1="168" y1="${GROUND - 6}" x2="160" y2="96"/><line class="eqline" x1="160" y1="96" x2="138" y2="98"/>`,
  };

  // ---------- poses ----------
  const STAND = { hip: [100, 104], neck: [100, 54] };
  const FOOT = { a: [100, 182], k: [1, 0] };

  function holdFor(prop, rel, alt) { return (prop === 'barbell' || prop === 'smith') ? rel.bar : (prop === 'dumbbell' || prop === 'kettlebell') ? rel.db : prop === 'band' ? (rel.band || rel.db) : (alt || rel.none); }

  const POSES = {
    stand: () => ({ frames: [
      { ...STAND, legs: [FOOT], arms: [{ h: [102, 108], e: [-1, 0] }] },
      { hip: [100, 105], neck: [100, 56], legs: [FOOT], arms: [{ h: [102, 110], e: [-1, 0] }] }] }),

    squat: prop => {
      const rel = { bar: [[-5, 3], [-1, 1]], db: [[15, 15], [0, 1]], band: [[10, 4], [0, 1]], none: [[44, 8], [0, 1]] };
      const [r, e] = holdFor(prop, rel);
      const A = { hip: [100, 104], neck: [100, 54] }, B = { hip: [78, 146], neck: [108, 106] };
      return {
        frames: [A, B].map(p => ({ ...p, legs: [FOOT], arms: [{ h: add(p.neck, r), e }] })),
        scene: prop === 'smith' ? S.rails(100) : '',
        band: [100, GROUND],
      };
    },

    deadlift: prop => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [104, 110], e: [-1, 0] }] },
        { hip: [78, 134], neck: [116, 102], legs: [FOOT], arms: [{ h: [118, prop === 'kettlebell' ? 150 : 162], e: [-1, 0] }] }],
    }),

    rdl: prop => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [104, 110], e: [-1, 0] }] },
        { hip: [86, 110], neck: [133, 93], legs: [FOOT], arms: [{ h: [136, prop === 'barbell' || prop === 'smith' ? 148 : 146], e: [-1, 0] }] }],
      scene: prop === 'smith' ? S.rails(118) : '',
      cable: [20, 176], band: [100, GROUND],
    }),

    swing: () => ({
      frames: [
        { hip: [84, 112], neck: [130, 94], legs: [FOOT], arms: [{ h: [104, 148], e: [-1, 0] }] },
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [150, 64], e: [0, 1] }] }],
    }),

    lunge: prop => {
      const relA = holdFor(prop, { bar: [-5, 3], db: [2, 54], none: [-4, 46] });
      const e = prop === 'barbell' || prop === 'smith' ? [-1, 1] : [-1, 0];
      const hand = (prop === 'kettlebell') ? [15, 15] : relA;
      const fr = (hip, neck) => ({ hip, neck,
        legs: [{ a: [122, 182], k: [1, 0] }, { a: [70, 174], t: [80, 184], k: [0.2, 1] }],
        arms: [{ h: add(neck, hand), e: prop === 'kettlebell' ? [0, 1] : e }] });
      return { frames: [fr([98, 104], [98, 54]), fr([96, 142], [97, 92])], scene: prop === 'smith' ? S.rails(96) : '' };
    },

    bench: prop => ({
      frames: [
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [70, 76], e: [1, 0.5] }] },
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [74, 118], e: [0.6, 1] }] }],
      scene: S.bench(46, 140, 139) + (prop === 'smith' ? S.rails(72) : ''),
    }),

    incline: () => ({
      frames: [
        { hip: [110, 140], neck: [80, 100], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [88, 44], e: [1, 0.3] }] },
        { hip: [110, 140], neck: [80, 100], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [96, 92], e: [0.6, 1] }] }],
      scene: `<line class="eqthick" x1="118" y1="150" x2="72" y2="92"/>` + S.seat(104, 146, 36),
    }),

    seated_press: () => ({
      frames: [
        { hip: [90, 142], neck: [92, 92], legs: [{ a: [128, 182], k: [1, -1] }], arms: [{ h: [108, 100], e: [-0.5, 1] }] },
        { hip: [90, 142], neck: [92, 92], legs: [{ a: [128, 182], k: [1, -1] }], arms: [{ h: [146, 100], e: [-0.5, 1] }] }],
      scene: S.back(78, 76, 146) + S.seat(70, 146, 46),
      band: [20, 100],
    }),

    press_forward: () => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [{ a: [118, 182] }, { a: [84, 182] }], arms: [{ h: [114, 80], e: [-0.5, 1] }] },
        { hip: [100, 104], neck: [100, 54], legs: [{ a: [118, 182] }, { a: [84, 182] }], arms: [{ h: [154, 80], e: [-0.5, 1] }] }],
      cable: [12, 80], band: [12, 80],
    }),

    pushup: () => ({
      frames: [
        { hip: [84, 138], neck: [132, 125], legs: [{ a: [12, 176], t: [18, 184], k: [0, 1] }], arms: [{ h: [134, 182], e: [-1, 0] }] },
        { hip: [84, 158], neck: [133, 152], legs: [{ a: [12, 176], t: [18, 184], k: [0, 1] }], arms: [{ h: [134, 182], e: [-0.5, -1] }] }],
    }),

    pike: () => ({
      frames: [
        { hip: [92, 108], neck: [128, 128], legs: [{ a: [50, 176], t: [58, 184], k: [0, 1] }], arms: [{ h: [138, 182], e: [-1, 0] }] },
        { hip: [92, 116], neck: [128, 156], legs: [{ a: [50, 176], t: [58, 184], k: [0, 1] }], arms: [{ h: [138, 182], e: [-1, -1] }] }],
    }),

    ohp: prop => ({
      frames: [
        { ...STAND, legs: [FOOT], arms: [{ h: [114, 58], e: [0.2, 1] }] },
        { ...STAND, legs: [FOOT], arms: [{ h: [104, -2], e: [1, 0] }] }],
      scene: prop === 'smith' ? S.rails(108) : '',
      band: [100, GROUND],
    }),

    row: prop => ({
      frames: [
        { hip: [88, 110], neck: [134, 91], legs: [FOOT], arms: [{ h: [137, prop === 'barbell' || prop === 'smith' ? 146 : 148], e: [-1, 0] }] },
        { hip: [88, 110], neck: [134, 91], legs: [FOOT], arms: [{ h: [112, 118], e: [-0.6, -1] }] }],
      scene: prop === 'smith' ? S.rails(126) : '',
    }),

    seated_row: () => ({
      frames: [
        { hip: [66, 160], neck: [78, 112], legs: [{ a: [140, 168], k: [0, -1] }], arms: [{ h: [126, 122], e: [0, 1] }] },
        { hip: [66, 160], neck: [66, 110], legs: [{ a: [140, 168], k: [0, -1] }], arms: [{ h: [94, 132], e: [-1, 0] }] }],
      scene: S.seat(44, 164, 40) + `<rect class="eq" x="140" y="150" width="6" height="30" rx="2"/>`,
      cable: [192, 132], band: [192, 132],
    }),

    facepull: () => ({
      frames: [
        { hip: [100, 104], neck: [98, 54], legs: [{ a: [112, 182] }, { a: [86, 182] }], arms: [{ h: [152, 48], e: [0, 1] }] },
        { hip: [100, 104], neck: [96, 54], legs: [{ a: [112, 182] }, { a: [86, 182] }], arms: [{ h: [114, 40], e: [-0.2, -1] }] }],
      cable: [194, 42], band: [194, 42],
    }),

    pullup: () => ({
      frames: [
        { hip: [100, 102], neck: [100, 52], legs: [{ a: [94, 174], t: [100, 180], k: [-1, 0] }], arms: [{ h: [108, -6], e: [0.5, 1] }] },
        { hip: [99, 62], neck: [98, 12], legs: [{ a: [93, 134], t: [99, 140], k: [-1, 0] }], arms: [{ h: [108, -6], e: [0.5, 1] }] }],
      scene: S.bar(-8),
    }),

    hangraise: () => ({
      frames: [
        { hip: [100, 102], neck: [100, 52], legs: [{ a: [94, 174], t: [100, 180], k: [-1, 0] }], arms: [{ h: [106, -6], e: [0.5, 1] }] },
        { hip: [98, 100], neck: [100, 52], legs: [{ a: [136, 138], t: [142, 146], k: [1, -1] }], arms: [{ h: [106, -6], e: [0.5, 1] }] }],
      scene: S.bar(-8),
    }),

    pulldown: () => ({
      frames: [
        { hip: [96, 136], neck: [98, 86], legs: [{ a: [130, 182], k: [1, -1] }], arms: [{ h: [108, 30], e: [1, 0] }] },
        { hip: [96, 136], neck: [94, 87], legs: [{ a: [130, 182], k: [1, -1] }], arms: [{ h: [110, 70], e: [-0.2, 1] }] }],
      scene: S.seat(78, 140, 40) + `<rect class="eq" x="104" y="126" width="22" height="7" rx="3"/>`,
      cable: [110, -24], band: [110, -24],
    }),

    curl: () => ({
      frames: [
        { ...STAND, legs: [FOOT], arms: [{ h: [104, 110], e: [-0.2, 1] }] },
        { ...STAND, legs: [FOOT], arms: [{ h: [118, 62], e: [-0.2, 1] }] }],
      cable: [150, 182], band: [104, GROUND],
    }),

    pushdown: () => ({
      frames: [
        { hip: [98, 104], neck: [104, 55], legs: [FOOT], arms: [{ h: [126, 72], e: [-0.4, 1] }] },
        { hip: [98, 104], neck: [104, 55], legs: [FOOT], arms: [{ h: [114, 110], e: [-0.4, 1] }] }],
      cable: [128, -24], band: [128, -24],
    }),

    ohext: () => ({
      frames: [
        { ...STAND, legs: [FOOT], arms: [{ h: [102, -2], e: [1, 0] }] },
        { ...STAND, legs: [FOOT], arms: [{ h: [86, 28], e: [0.6, -1] }] }],
    }),

    skull: () => ({
      frames: [
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [70, 76], e: [1, 0] }] },
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [46, 104], e: [0.3, -1] }] }],
      scene: S.bench(46, 140, 139),
    }),

    dip: () => ({
      frames: [
        { hip: [98, 96], neck: [100, 46], legs: [{ a: [76, 142], k: [1, 0.2] }], arms: [{ h: [106, 102], e: [-1, 0] }] },
        { hip: [97, 124], neck: [100, 74], legs: [{ a: [75, 170], k: [1, 0.2] }], arms: [{ h: [106, 102], e: [-1, -0.3] }] }],
      scene: `<line class="eqline" x1="92" y1="104" x2="132" y2="104"/><line class="rail" x1="128" y1="104" x2="128" y2="${GROUND}"/>`,
    }),

    raise: () => ({
      frames: [
        { ...STAND, legs: [FOOT], arms: [{ h: [104, 110], e: [0, 1] }] },
        { ...STAND, legs: [FOOT], arms: [{ h: [154, 56], e: [0, 1] }] }],
      cable: [60, 182], band: [100, GROUND],
    }),

    fly: () => ({
      frames: [
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [70, 76], e: [1, 0] }] },
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [84, 132], e: [0, -1] }] }],
      scene: S.bench(46, 140, 139),
    }),

    cable_fly: () => ({
      frames: [
        { hip: [100, 104], neck: [104, 55], legs: [{ a: [114, 182] }, { a: [84, 182] }], arms: [{ h: [112, 68], e: [-0.3, 1] }] },
        { hip: [100, 104], neck: [104, 55], legs: [{ a: [114, 182] }, { a: [84, 182] }], arms: [{ h: [150, 84], e: [0, 1] }] }],
      cable: [40, -12], band: [30, 60],
    }),

    bridge: () => ({
      frames: [
        { hip: [92, 178], neck: [44, 176], legs: [{ a: [126, 180], t: [138, 184], k: [0, -1] }], arms: [{ h: [82, 182], e: [0, 1] }] },
        { hip: [92, 154], neck: [44, 176], legs: [{ a: [126, 180], t: [138, 184], k: [0, -1] }], arms: [{ h: [82, 182], e: [0, 1] }] }],
    }),

    hipthrust: prop => ({
      frames: [
        { hip: [80, 176], neck: [52, 138], legs: [{ a: [130, 182], k: [0, -1] }], arms: [{ h: [84, 166], e: [0, -1] }] },
        { hip: [96, 136], neck: [52, 138], legs: [{ a: [130, 182], k: [0, -1] }], arms: [{ h: [98, 126], e: [0, -1] }] }],
      scene: S.bench(14, 60, 140) + (prop === 'smith' ? S.rails(96) : ''),
      propAt: 'hip',
    }),

    calf: prop => {
      const rel = holdFor(prop, { bar: [-5, 3], db: [2, 54], none: [2, 54] });
      const e = (prop === 'barbell' || prop === 'smith') ? [-1, 1] : [-1, 0];
      return {
        frames: [
          { hip: [100, 104], neck: [100, 54], legs: [{ a: [100, 182], t: [114, 184] }], arms: [{ h: add([100, 54], rel), e }] },
          { hip: [100, 94], neck: [100, 44], legs: [{ a: [101, 172], t: [114, 184] }], arms: [{ h: add([100, 44], rel), e }] }],
        scene: prop === 'smith' ? S.rails(96) : '',
      };
    },

    legpress: () => ({
      frames: [
        { hip: [72, 140], neck: [44, 100], legs: [{ a: [118, 110], t: [124, 98], k: [0, -1] }], arms: [{ h: [80, 150], e: [0, 1] }] },
        { hip: [72, 140], neck: [44, 100], legs: [{ a: [134, 94], t: [140, 82], k: [0, -1] }], arms: [{ h: [80, 150], e: [0, 1] }] }],
      scene: `<line class="eqthick" x1="78" y1="150" x2="38" y2="96"/>` + S.seat(56, 146, 40) + `<line class="rail" x1="104" y1="150" x2="184" y2="60"/>`,
      sled: true,
    }),

    legext: () => ({
      frames: [
        { hip: [90, 132], neck: [88, 82], legs: [{ a: [128, 172], k: [1, -1] }], arms: [{ h: [94, 142], e: [-1, 0] }] },
        { hip: [90, 132], neck: [88, 82], legs: [{ a: [168, 134], k: [1, -1] }], arms: [{ h: [94, 142], e: [-1, 0] }] }],
      scene: S.back(74, 76, 138) + S.seat(70, 138, 56),
      propAt: 'ankleFront',
    }),

    legcurl: () => ({
      frames: [
        { hip: [90, 132], neck: [88, 82], legs: [{ a: [168, 134], k: [1, -1] }], arms: [{ h: [94, 142], e: [-1, 0] }] },
        { hip: [90, 132], neck: [88, 82], legs: [{ a: [124, 174], k: [1, -1] }], arms: [{ h: [94, 142], e: [-1, 0] }] }],
      scene: S.back(74, 76, 138) + S.seat(70, 138, 56),
      propAt: 'ankleBack',
    }),

    plank: () => ({
      frames: [
        { hip: [80, 162], neck: [130, 158], legs: [{ a: [8, 172], t: [12, 184], k: [0, 1] }], arms: [{ h: [154, 182], e: [-0.3, 1] }] },
        { hip: [80, 159], neck: [130, 157], legs: [{ a: [8, 172], t: [12, 184], k: [0, 1] }], arms: [{ h: [154, 182], e: [-0.3, 1] }] }],
    }),

    crunch: () => ({
      frames: [
        { hip: [100, 176], neck: [52, 176], legs: [{ a: [140, 180], k: [0, -1] }], arms: [{ h: [68, 176], e: [0, -1] }] },
        { hip: [100, 176], neck: [62, 152], legs: [{ a: [140, 180], k: [0, -1] }], arms: [{ h: [76, 160], e: [0, -1] }] }],
    }),

    deadbug: () => ({
      frames: [
        { hip: [102, 176], neck: [52, 174], legs: [{ a: [140, 136], k: [0, -1] }, { a: [140, 136], k: [0, -1] }], arms: [{ h: [56, 118], e: [1, 0] }, { h: [56, 118], e: [1, 0] }] },
        { hip: [102, 176], neck: [52, 174], legs: [{ a: [178, 166], k: [0, -1] }, { a: [140, 136], k: [0, -1] }], arms: [{ h: [8, 162], e: [0, -1] }, { h: [56, 118], e: [1, 0] }] }],
    }),

    climber: () => {
      const back = { a: [14, 174], t: [20, 184], k: [0, 1] }, fwd = { a: [108, 168], t: [114, 176], k: [0.5, 1] };
      const base = { hip: [84, 140], neck: [132, 125], arms: [{ h: [134, 182], e: [-1, 0] }] };
      return { frames: [{ ...base, legs: [back, fwd] }, { ...base, legs: [fwd, back] }], dur: 700 };
    },

    birddog: () => ({
      frames: [
        { hip: [84, 140], neck: [132, 138], legs: [{ a: [44, 180], t: [34, 184], k: [0, 1] }, { a: [44, 180], t: [34, 184], k: [0, 1] }], arms: [{ h: [134, 182], e: [-1, 0] }, { h: [134, 182], e: [-1, 0] }] },
        { hip: [84, 140], neck: [132, 138], legs: [{ a: [8, 136], t: [0, 144], k: [0, 1] }, { a: [44, 180], t: [34, 184], k: [0, 1] }], arms: [{ h: [188, 126], e: [0, 1] }, { h: [134, 182], e: [-1, 0] }] }],
    }),

    superman: () => ({
      frames: [
        { hip: [100, 176], neck: [52, 176], legs: [{ a: [178, 180], t: [190, 182], k: [0, 1] }], arms: [{ h: [6, 178], e: [0, 1] }] },
        { hip: [100, 176], neck: [54, 168], legs: [{ a: [176, 166], t: [188, 168], k: [0, 1] }], arms: [{ h: [8, 150], e: [0, 1] }] }],
    }),

    wallsit: () => ({
      frames: [
        { hip: [72, 138], neck: [72, 88], legs: [{ a: [110, 182], k: [1, -1] }], arms: [{ h: [100, 134], e: [0, 1] }] },
        { hip: [72, 139], neck: [72, 89], legs: [{ a: [110, 182], k: [1, -1] }], arms: [{ h: [100, 135], e: [0, 1] }] }],
      scene: `<line class="eqthick" x1="60" y1="20" x2="60" y2="${GROUND}"/>`,
    }),

    run: prop => {
      const fast = { hip: [100, 104], neck: [106, 55] };
      const f = (la, lb, ha, hb, dy) => ({ hip: [100, 104 - dy], neck: [106, 55 - dy],
        legs: [la, lb], arms: [{ h: ha, e: [-0.6, 1] }, { h: hb, e: [-0.6, 1] }] });
      const c1 = { a: [126, 178], k: [1, 0] }, c2 = { a: [72, 160], t: [70, 172], k: [1, 0] };
      const m1 = { a: [100, 182], k: [1, 0] }, m2 = { a: [90, 146], k: [1, 0] };
      return {
        frames: [
          f(c1, c2, [80, 94], [128, 80], 0),
          f(m1, m2, [104, 100], [104, 100], 4),
          f(c2, c1, [128, 80], [80, 94], 0),
          f(m2, m1, [104, 100], [104, 100], 4)],
        mode: 'loop', dur: 900,
        scene: prop === 'treadmill' ? S.tread() : '',
      };
    },

    walk: prop => {
      const f = (la, lb, ha, hb) => ({ hip: [100, 104], neck: [102, 54], legs: [la, lb], arms: [{ h: ha, e: [-0.4, 1] }, { h: hb, e: [-0.4, 1] }] });
      const c1 = { a: [118, 182], k: [1, 0] }, c2 = { a: [80, 180], t: [90, 184], k: [1, 0] };
      const m1 = { a: [100, 182], k: [1, 0] }, m2 = { a: [96, 170], k: [1, 0] };
      return {
        frames: [f(c1, c2, [90, 104], [116, 100]), f(m1, m2, [102, 108], [102, 108]), f(c2, c1, [116, 100], [90, 104]), f(m2, m1, [102, 108], [102, 108])],
        mode: 'loop', dur: 1300, scene: prop === 'treadmill' ? S.tread() : '',
      };
    },

    bike: () => {
      const cx = 104, cy = 160, r = 16;
      const fr = ang => {
        const a1 = [cx + r * Math.cos(ang), cy + r * Math.sin(ang)], a2 = [cx - r * Math.cos(ang), cy - r * Math.sin(ang)];
        return { hip: [86, 106], neck: [116, 62], legs: [{ a: a1, k: [1, -0.3] }, { a: a2, k: [1, -0.3] }], arms: [{ h: [138, 94], e: [0, 1] }] };
      };
      return {
        frames: [0, 1, 2, 3].map(i => fr(i * Math.PI / 2)), mode: 'loop', dur: 1000,
        scene: `<line class="eqthick" x1="86" y1="114" x2="104" y2="160"/><line class="eqthick" x1="104" y1="160" x2="140" y2="96"/><line class="eqthick" x1="70" y1="${GROUND}" x2="150" y2="${GROUND}"/><line class="eqline" x1="104" y1="160" x2="104" y2="${GROUND}"/><circle class="eqline" cx="104" cy="160" r="5" fill="none"/><rect class="eq" x="76" y="108" width="22" height="6" rx="3"/>`,
      };
    },

    rowmachine: () => ({
      frames: [
        { hip: [104, 160], neck: [128, 114], legs: [{ a: [150, 166], t: [154, 154], k: [0, -1] }], arms: [{ h: [172, 132], e: [0, 1] }] },
        { hip: [70, 160], neck: [58, 112], legs: [{ a: [150, 166], t: [154, 154], k: [0, -1] }], arms: [{ h: [82, 126], e: [-1, 0] }] }],
      scene: `<line class="eqthick" x1="20" y1="172" x2="168" y2="172"/><circle class="eq" cx="176" cy="150" r="14"/>`,
      chain: [176, 150], dur: 2200,
    }),

    jumprope: () => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [{ a: [100, 182], t: [112, 184] }], arms: [{ h: [116, 104], e: [-0.4, 1] }] },
        { hip: [100, 94], neck: [100, 44], legs: [{ a: [100, 172], t: [112, 176] }], arms: [{ h: [116, 94], e: [-0.4, 1] }] }],
      rope: true, dur: 700,
    }),

    stairs: () => ({
      frames: [
        { hip: [100, 102], neck: [102, 52], legs: [{ a: [118, 150], k: [1, 0] }, { a: [96, 182], k: [1, 0] }], arms: [{ h: [126, 104], e: [0, 1] }] },
        { hip: [100, 100], neck: [102, 50], legs: [{ a: [96, 182], k: [1, 0] }, { a: [118, 150], k: [1, 0] }], arms: [{ h: [126, 104], e: [0, 1] }] }],
      scene: `<path class="eq" d="M60 ${GROUND} V168 H96 V184 Z"/><path class="eq" d="M104 ${GROUND} V152 H150 V184 Z"/><line class="eqline" x1="126" y1="104" x2="160" y2="${GROUND}"/>`,
      dur: 1400,
    }),

    // ---------- added with the expanded library ----------
    floorpress: () => ({
      frames: [
        { hip: [118, 176], neck: [66, 176], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [70, 120], e: [1, 0] }] },
        { hip: [118, 176], neck: [66, 176], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [76, 158], e: [1, -0.3] }] }],
    }),

    pullover: () => ({
      frames: [
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [70, 76], e: [0, -1] }] },
        { hip: [118, 132], neck: [66, 132], legs: [{ a: [150, 182], k: [0, -1] }], arms: [{ h: [16, 122], e: [0, -1] }] }],
      scene: S.bench(46, 140, 139),
    }),

    preacher: () => ({
      frames: [
        { hip: [84, 142], neck: [90, 92], legs: [{ a: [118, 182], k: [1, -1] }], arms: [{ h: [140, 124], e: [1, 0.5] }] },
        { hip: [84, 142], neck: [90, 92], legs: [{ a: [118, 182], k: [1, -1] }], arms: [{ h: [112, 74], e: [1, 0.5] }] }],
      scene: `<line class="eqthick" x1="104" y1="94" x2="136" y2="128"/>` + S.seat(66, 146, 40),
    }),

    goodmorning: () => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [95, 57], e: [-1, 1] }] },
        { hip: [86, 110], neck: [133, 93], legs: [FOOT], arms: [{ h: [128, 96], e: [-1, 1] }] }],
    }),

    situp: () => ({
      frames: [
        { hip: [100, 176], neck: [52, 176], legs: [{ a: [140, 180], k: [0, -1] }], arms: [{ h: [64, 172], e: [0, -1] }] },
        { hip: [100, 176], neck: [84, 130], legs: [{ a: [140, 180], k: [0, -1] }], arms: [{ h: [92, 146], e: [0, -1] }] }],
    }),

    legraise: () => ({
      frames: [
        { hip: [100, 176], neck: [52, 176], legs: [{ a: [178, 176], t: [180, 164], k: [0, -1] }], arms: [{ h: [92, 182], e: [0, 1] }] },
        { hip: [100, 176], neck: [52, 176], legs: [{ a: [110, 98], t: [122, 98], k: [1, 0] }], arms: [{ h: [92, 182], e: [0, 1] }] }],
    }),

    rollout: () => ({
      frames: [
        { hip: [88, 144], neck: [128, 114], legs: [{ a: [44, 180], t: [34, 184], k: [0, 1] }], arms: [{ h: [130, 172], e: [0, 1] }] },
        { hip: [104, 156], neck: [152, 146], legs: [{ a: [44, 180], t: [34, 184], k: [0, 1] }], arms: [{ h: [194, 172], e: [0, 1] }] }],
    }),

    wristcurl: () => ({
      frames: [
        { hip: [84, 142], neck: [96, 94], legs: [{ a: [124, 182], k: [1, -1] }], arms: [{ h: [134, 136], e: [0, 1] }] },
        { hip: [84, 142], neck: [96, 94], legs: [{ a: [124, 182], k: [1, -1] }], arms: [{ h: [136, 124], e: [0, 1] }] }],
      scene: S.seat(62, 146, 40), dur: 1600,
    }),

    twist: () => ({
      frames: [
        { hip: [96, 170], neck: [70, 126], legs: [{ a: [146, 160], k: [0.3, -1] }], arms: [{ h: [108, 140], e: [0, 1] }] },
        { hip: [96, 170], neck: [70, 126], legs: [{ a: [146, 160], k: [0.3, -1] }], arms: [{ h: [76, 156], e: [0, 1] }] }],
      dur: 1600,
    }),

    clam: () => ({
      frames: [
        { hip: [100, 176], neck: [52, 172], legs: [{ a: [74, 178], t: [70, 168], k: [1, -0.6] }, { a: [74, 179], t: [70, 170], k: [1, -0.6] }], arms: [{ h: [40, 156], e: [0.3, -1] }] },
        { hip: [100, 176], neck: [52, 172], legs: [{ a: [82, 166], t: [78, 156], k: [1, -0.6] }, { a: [74, 179], t: [70, 170], k: [1, -0.6] }], arms: [{ h: [40, 156], e: [0.3, -1] }] }],
    }),

    carry: () => {
      const f = (la, lb) => ({ hip: [100, 104], neck: [100, 54], legs: [la, lb], arms: [{ h: [102, 112], e: [-1, 0] }, { h: [98, 112], e: [-1, 0] }] });
      const c1 = { a: [118, 182], k: [1, 0] }, c2 = { a: [80, 180], t: [90, 184], k: [1, 0] };
      const m1 = { a: [100, 182], k: [1, 0] }, m2 = { a: [96, 170], k: [1, 0] };
      return { frames: [f(c1, c2), f(m1, m2), f(c2, c1), f(m2, m1)], mode: 'loop', dur: 1400 };
    },

    hang: () => ({
      frames: [
        { hip: [100, 102], neck: [100, 52], legs: [{ a: [94, 174], t: [100, 180], k: [-1, 0] }], arms: [{ h: [108, -6], e: [0.5, 1] }] },
        { hip: [101, 103], neck: [100, 53], legs: [{ a: [97, 175], t: [103, 181], k: [-1, 0] }], arms: [{ h: [108, -6], e: [0.5, 1] }] }],
      scene: S.bar(-8), dur: 3000,
    }),

    shrug: prop => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [103, 110], e: [-1, 0] }] },
        { hip: [100, 104], neck: [100, 46], legs: [FOOT], arms: [{ h: [103, 101], e: [-1, 0] }] }],
      scene: prop === 'smith' ? S.rails(103) : '', cable: [104, 182], dur: 1800,
    }),

    upright_row: () => ({
      frames: [
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [104, 110], e: [-1, -0.2] }] },
        { hip: [100, 104], neck: [100, 54], legs: [FOOT], arms: [{ h: [112, 70], e: [-1, -0.2] }] }],
      cable: [104, 182],
    }),

    kickback: () => ({
      frames: [
        { hip: [88, 110], neck: [134, 91], legs: [FOOT], arms: [{ h: [118, 134], e: [-1, 0] }] },
        { hip: [88, 110], neck: [134, 91], legs: [FOOT], arms: [{ h: [80, 113], e: [-1, 0] }] }],
    }),

    straightarm: () => ({
      frames: [
        { hip: [100, 104], neck: [106, 55], legs: [{ a: [112, 182] }, { a: [88, 182] }], arms: [{ h: [152, 24], e: [0, 1] }] },
        { hip: [100, 104], neck: [106, 55], legs: [{ a: [112, 182] }, { a: [88, 182] }], arms: [{ h: [116, 112], e: [0, 1] }] }],
      cable: [178, -24],
    }),

    seated_calf: () => ({
      frames: [
        { hip: [80, 140], neck: [82, 90], legs: [{ a: [120, 182], t: [132, 184], k: [1, -1] }], arms: [{ h: [116, 132], e: [0, 1] }] },
        { hip: [80, 140], neck: [82, 90], legs: [{ a: [121, 172], t: [132, 184], k: [1, -1] }], arms: [{ h: [116, 126], e: [0, 1] }] }],
      scene: S.seat(58, 144, 40) + `<rect class="eq" x="104" y="128" width="26" height="7" rx="3"/>`, dur: 1800,
    }),

    seated_hip: () => ({
      frames: [
        { hip: [86, 140], neck: [88, 90], legs: [{ a: [126, 178], k: [1, -1] }, { a: [126, 178], k: [1, -1] }], arms: [{ h: [92, 146], e: [-1, 0] }] },
        { hip: [86, 140], neck: [88, 90], legs: [{ a: [122, 176], k: [1, -1] }, { a: [130, 180], k: [1, -1] }], arms: [{ h: [92, 146], e: [-1, 0] }] }],
      scene: S.back(72, 80, 144) + S.seat(70, 144, 50), dur: 2000,
    }),

    jumpsquat: () => ({
      frames: [
        { hip: [78, 146], neck: [108, 106], legs: [FOOT], arms: [{ h: [92, 140], e: [-1, 0] }] },
        { hip: [100, 84], neck: [100, 34], legs: [{ a: [100, 162], t: [110, 168] }], arms: [{ h: [110, -12], e: [1, 0] }] }],
      dur: 1300,
    }),
  };

  // ---------- render ----------
  function frameSvg(def, fr, prop, t) {
    const J = solve(fr);
    let out = '';
    // back limbs
    if (J.legs[1]) out += pl([J.hip, J.legs[1].knee, J.legs[1].ankle, J.legs[1].toe], 'limb back');
    if (J.arms[1]) out += pl([J.neck, J.arms[1].elbow, J.arms[1].hand], 'limb back');
    if (def.chain) out += ln(J.arms[0].hand, def.chain, 'cable');
    out += ln(J.hip, J.neck, 'limb torso');
    out += pl([J.hip, J.legs[0].knee, J.legs[0].ankle, J.legs[0].toe], 'limb');
    if (def.sled) {
      const d = norm(sub(J.legs[0].ankle, J.hip)); const pr = [-d[1], d[0]];
      const c = add(J.legs[0].ankle, mul(d, 6));
      out += ln(add(c, mul(pr, 20)), add(c, mul(pr, -20)), 'eqthick');
    }
    // prop anchor
    let at = J.arms[0].hand;
    if (def.propAt === 'hip') at = add(J.hip, [0, -12]);
    if (def.propAt === 'ankleFront') at = add(J.legs[0].ankle, [7, -2]);
    if (def.propAt === 'ankleBack') at = add(J.legs[0].ankle, [-7, 0]);
    const propSvg = drawProp(prop, at, J, def);
    const heldBehind = prop === 'barbell' || prop === 'smith';
    if (heldBehind) out += propSvg;
    out += pl([J.neck, J.arms[0].elbow, J.arms[0].hand], 'limb');
    out += `<circle class="head" cx="${f1(J.head[0])}" cy="${f1(J.head[1])}" r="10"/>`;
    if (!heldBehind) out += propSvg;
    if (def.rope) {
      const h = J.arms[0].hand; const cy = lerp(-30, 214, t);
      out += `<path class="rope" d="M${f1(h[0])} ${f1(h[1])} Q${f1(h[0] + 34)} ${f1(cy)} ${f1(h[0] - 30)} ${f1(h[1])}"/>`;
    }
    return out;
  }

  const ease = x => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

  function frameAt(def, phase) {
    const fr = def.frames;
    if ((def.mode || 'pingpong') === 'pingpong') {
      const t = (1 - Math.cos(phase * Math.PI * 2)) / 2;
      return { fr: lerp(fr[0], fr[1], t), t };
    }
    const n = fr.length, pos = phase * n, i = Math.floor(pos) % n, local = pos - Math.floor(pos);
    return { fr: lerp(fr[i], fr[(i + 1) % n], ease(local)), t: phase };
  }

  function getDef(key, prop) {
    const make = POSES[key] || POSES.stand;
    return make(prop || 'none');
  }

  function shell(def, inner, label) {
    return `<svg class="demo-svg" viewBox="${VB}" role="img" aria-label="${label || 'Exercise demonstration'}"><line class="ground" x1="4" y1="${GROUND + 1}" x2="196" y2="${GROUND + 1}"/>${def.scene || ''}<g class="fig">${inner}</g></svg>`;
  }

  // static thumbnail: the "working" end of the movement
  function staticDemo(key, prop, label) {
    const def = getDef(key, prop);
    const pick = def.frames.length > 2 ? def.frames[0] : def.frames[1];
    return shell(def, frameSvg(def, pick, prop, 0.5), label);
  }

  // live demos, one shared animation loop
  const live = new Set();
  let raf = 0;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now) {
    live.forEach(d => {
      if (!d.el.isConnected) { live.delete(d); return; }
      if (d.paused) return;
      if (now - d.last < 30) return;
      d.last = now;
      const phase = ((((now - d.start) % d.dur) + d.dur) % d.dur) / d.dur;
      const { fr, t } = frameAt(d.def, phase);
      d.g.innerHTML = frameSvg(d.def, fr, d.prop, t);
    });
    raf = live.size ? requestAnimationFrame(tick) : 0;
  }
  function mountDemo(el, key, prop, label) {
    const def = getDef(key, prop);
    el.innerHTML = shell(def, '', label);
    const d = { el, def, prop, g: el.querySelector('.fig'), start: performance.now(), last: 0, dur: def.dur || 2600, paused: reduce };
    const { fr, t } = frameAt(def, 0.25);
    d.g.innerHTML = frameSvg(def, fr, prop, t);
    live.add(d);
    if (!raf) raf = requestAnimationFrame(tick);
    return {
      toggle() { d.paused = !d.paused; if (!d.paused) { d.start = performance.now(); if (!raf) raf = requestAnimationFrame(tick); } return !d.paused; },
      get playing() { return !d.paused; },
    };
  }

  function allFrames(key, prop) {
    const def = getDef(key, prop);
    return def.frames.map((fr, i) => shell(def, frameSvg(def, fr, prop, i / def.frames.length))).join('');
  }

  window.Demo = { mount: mountDemo, staticSvg: staticDemo, frames: allFrames, keys: Object.keys(POSES), reduced: reduce };
})();
