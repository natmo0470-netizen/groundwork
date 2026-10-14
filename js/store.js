/* Groundwork — storage adapter.
   v1 keeps everything in this browser (localStorage). Phase 5 swaps this one file for a
   cloud adapter (e.g. Supabase) with the same load/save/clear interface. */
const Store = (() => {
  const KEY = 'groundwork.v1';
  let memory = null; // fallback when browser storage is blocked (private mode, sandboxed previews)

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable */ }
    return memory ? JSON.parse(JSON.stringify(memory)) : null;
  }
  function save(state) {
    memory = state;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; } catch (e) { return false; }
  }
  function clear() {
    memory = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  }
  function available() {
    try { localStorage.setItem(KEY + '.probe', '1'); localStorage.removeItem(KEY + '.probe'); return true; } catch (e) { return false; }
  }
  return { load, save, clear, available };
})();

function defaultState() {
  return {
    version: 1,
    onboarded: false,
    profile: { name: '', sex: 'male', age: 30, heightCm: 175, weightKg: 80, goal: 'muscle', experience: 'beginner', activity: 'light', units: 'imperial' },
    schedule: { days: [1, 3, 5], minutes: 45 },
    equipment: { fullGym: true, items: [], gym: null },
    program: null,
    plan: null,
    macros: { mode: 'auto', custom: null },
    calorieAdjust: 0,
    foodLog: {},
    customFoods: [],
    recentFoods: [],
    weights: [],
    workouts: [],
    activeWorkout: null,
    checkins: [],
    feedback: [],
    mealPrefs: null,
    mealPlan: null,
    grocery: { checked: {}, extra: [], store: 'instacart', range: 'week' },
    extraRecipes: [],
    household: [],
    startDate: todayKey(),
    reminders: { enabled: true, workout: true, meals: true, protein: true, weighin: true, checkin: true, missed: true, browser: false },
    dismissed: {},
    notified: {},
  };
}

/* ---------- dates ---------- */
function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function todayKey() { return dateKey(new Date()); }
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(k, n) { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); }
function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 864e5); }
function weekStart(k) { const d = parseKey(k); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return dateKey(d); }
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function prettyDate(k) { const d = parseKey(k); return `${DOW[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`; }
function shortDate(k) { const d = parseKey(k); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
