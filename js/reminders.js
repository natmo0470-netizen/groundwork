/* Groundwork — reminder rules and weekly check-in.
   Rules run whenever the app opens or ticks; each returns at most one reminder.
   Phase 2 (store app) schedules them on the phone so they arrive with the app closed. */

function foodTotals(state, key) {
  const items = state.foodLog[key] || [];
  return items.reduce((t, i) => ({ kcal: t.kcal + i.kcal * i.servings, p: t.p + i.p * i.servings, c: t.c + i.c * i.servings, f: t.f + i.f * i.servings }), { kcal: 0, p: 0, c: 0, f: 0 });
}
function lastWeight(state) { return state.weights.length ? state.weights[state.weights.length - 1] : null; }

function avgWeight(state, fromKey, toKey) {
  const w = state.weights.filter(x => x.date >= fromKey && x.date <= toKey);
  if (!w.length) return null;
  return { avg: w.reduce((s, x) => s + x.kg, 0) / w.length, n: w.length };
}

function checkinStatus(state, now) {
  const today = dateKey(now || new Date());
  const last = state.checkins.length ? state.checkins[state.checkins.length - 1].date : state.startDate;
  const since = daysBetween(last, today);
  return { due: since >= 7, daysUntil: Math.max(0, 7 - since), since, last };
}

/* Compares this week's average weight with last week's and suggests a calorie change. */
function computeCheckin(state, adherence) {
  const today = todayKey();
  const thisWk = avgWeight(state, addDays(today, -6), today);
  const lastWk = avgWeight(state, addDays(today, -13), addDays(today, -7));
  const goal = state.profile.goal;
  const [lo, hi] = expectedRate(goal);
  const res = { date: today, adherence, thisAvg: thisWk && thisWk.avg, lastAvg: lastWk && lastWk.avg, change: null, rate: null, adjust: 0, message: '' };
  if (!thisWk || thisWk.n < 2) { res.message = 'Log your weight at least 2–3 times this week so the check-in can measure your trend. Calories stay the same for now.'; return res; }
  if (!lastWk) { res.message = 'This is your baseline week. Next week\'s check-in will compare against it.'; return res; }
  res.change = thisWk.avg - lastWk.avg;
  res.rate = res.change / lastWk.avg;
  if (adherence === 'no') { res.message = 'You were off plan most days, so the numbers aren\'t a fair test. Calories stay the same; aim for 5+ on-target days this week.'; return res; }
  if (res.rate < lo) res.adjust = goal === 'lose' ? 150 : 100;
  else if (res.rate > hi) res.adjust = goal === 'lose' ? -150 : -100;
  const dir = res.adjust > 0 ? 'up' : 'down';
  if (res.adjust === 0) res.message = 'Right on track. Keep calories where they are.';
  else if (goal === 'lose') res.message = res.adjust < 0 ? 'Weight is holding steady, so calories drop by 150 to restart progress.' : 'You\'re losing faster than is ideal for keeping muscle, so calories go up by 150.';
  else if (goal === 'muscle') res.message = res.adjust > 0 ? 'Weight isn\'t climbing, so calories go up by 100 to support muscle gain.' : 'You\'re gaining faster than needed, which is mostly fat. Calories go down by 100.';
  else res.message = `Your weight is drifting ${res.change > 0 ? 'up' : 'down'}, so calories go ${dir} by ${Math.abs(res.adjust)} to hold steady.`;
  return res;
}

function computeReminders(state, now) {
  now = now || new Date();
  const R = state.reminders;
  if (!state.onboarded || !R.enabled) return [];
  const today = dateKey(now), hour = now.getHours();
  const out = [];
  const T = calcTargets(state);
  const totals = foodTotals(state, today);

  // Workout today
  const planned = workoutForDate(state, today);
  if (R.workout && planned && !workoutDoneOn(state, today) && !state.activeWorkout) {
    out.push({ id: 'workout', level: hour >= 18 ? 'high' : 'normal', title: hour >= 18 ? 'Still time for today\'s workout' : 'Workout today', body: `${planned.name}, about ${state.schedule.minutes} min. ${hour >= 18 ? 'Even a shorter session keeps your streak going.' : 'Tap to see the plan.'}`, action: 'start-today', actionLabel: 'Start workout', icon: 'dumbbell' });
  }
  // Training block finished
  const bi = blockInfo(state);
  if (bi && bi.done) out.push({ id: 'block', level: 'high', title: `Block ${bi.block} complete`, body: `${bi.len} weeks done. Start a fresh block: same main lifts, new accessory exercises.`, action: 'new-block', actionLabel: `Start block ${bi.block + 1}`, icon: 'trophy' });
  // Missed sessions this week
  if (R.missed && state.plan) {
    const ws = weekStart(today);
    let missed = 0;
    for (let k = ws; k < today; k = addDays(k, 1)) {
      if (k < state.startDate) continue;
      if (workoutForDate(state, k) && !workoutDoneOn(state, k)) missed++;
    }
    if (missed >= 1) out.push({ id: 'missed', level: missed >= 2 ? 'high' : 'normal', title: `${missed} missed session${missed > 1 ? 's' : ''} this week`, body: 'You can make one up on a rest day. Any session counts.', action: 'tab-train', actionLabel: 'See schedule', icon: 'calendar' });
  }
  // Weigh-in
  const lw = lastWeight(state);
  if (R.weighin && (!lw || daysBetween(lw.date, today) >= 3)) {
    out.push({ id: 'weighin', level: 'normal', title: lw ? `No weigh-in for ${daysBetween(lw.date, today)} days` : 'Log your first weigh-in', body: 'Weigh in the morning, after the bathroom, before eating. Your weekly check-in uses the trend.', action: 'log-weight', actionLabel: 'Log weight', icon: 'scale' });
  }
  // Check-in due
  const ci = checkinStatus(state, now);
  if (R.checkin && ci.due) {
    out.push({ id: 'checkin', level: 'high', title: 'Weekly check-in is ready', body: 'Takes 30 seconds. Your calorie target adjusts to your progress.', action: 'open-checkin', actionLabel: 'Check in', icon: 'check' });
  }
  // Meals not logged
  if (R.meals && hour >= 13 && totals.kcal === 0) {
    out.push({ id: 'meals', level: 'normal', title: 'Nothing logged today', body: 'Log what you\'ve eaten so far. Rough entries are fine.', action: 'tab-food', actionLabel: 'Log food', icon: 'fork' });
  }
  // Protein behind
  if (R.protein && hour >= 16 && totals.kcal > 0 && totals.p < T.protein * (hour >= 19 ? 0.8 : 0.55)) {
    const left = Math.round(T.protein - totals.p);
    out.push({ id: 'protein', level: 'normal', title: `Protein is behind: ${left} g to go`, body: 'Easy wins: Greek yogurt (17 g), a shake (24 g), 4 oz chicken (35 g).', action: 'tab-food', actionLabel: 'Add food', icon: 'fork' });
  }
  // Over target late in the day
  if (R.meals && hour >= 20 && totals.kcal > T.calories * 1.15) {
    out.push({ id: 'over', level: 'normal', title: `${Math.round(totals.kcal - T.calories)} kcal over today`, body: 'One day won\'t undo your progress. Your weekly trend is what matters.', action: 'tab-food', actionLabel: 'View log', icon: 'fork' });
  }
  return out.filter(r => state.dismissed[r.id] !== today);
}

/* Browser notifications: only while the app is open in this version. */
function notifySupported() { return typeof window !== 'undefined' && 'Notification' in window; }
function maybeNotify(state, list) {
  if (!state.reminders.browser || !notifySupported()) return false;
  let fired = false;
  try {
    if (Notification.permission !== 'granted') return false;
    const today = todayKey();
    list.filter(r => r.level === 'high').forEach(r => {
      const key = r.id + ':' + today;
      if (state.notified[key]) return;
      new Notification('Groundwork: ' + r.title, { body: r.body, tag: key });
      state.notified[key] = true; fired = true;
    });
  } catch (e) { /* notifications blocked in this context */ }
  return fired;
}
