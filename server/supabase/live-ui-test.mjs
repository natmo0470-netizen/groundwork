// Live check of the real app against the Supabase project: sign up in the UI, sync, restore on a
// second "phone", then delete the account. Needs playwright and the site served on :8080.
import { chromium } from 'playwright';
const tag = Date.now().toString(36), email = `gw-ui-${tag}@example.com`, pw = 'Ui-test-' + tag;
const out = []; let failed = 0; const check = (n, ok, x) => { out.push(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok || x === undefined ? '' : '  → ' + JSON.stringify(x)}`); if (!ok) failed++; };
const b = await chromium.launch();
const page = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await c.newPage(); p._e = []; p.on('pageerror', e => p._e.push(e.message)); await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(500); return p; };
try {
  const A = await page();
  await A.evaluate(() => { seedDemo(); S.demo = false; S.profile.name = 'UI Test'; save(); render(); ACT['acct-open']({ dataset: { mode: 'signup' } }); });
  await A.fill('#acct-email', email); await A.fill('#acct-pw', pw); await A.click('[data-act=acct-submit]');
  await A.waitForFunction(() => Cloud.signedIn() && !UI.sheet, null, { timeout: 20000 }).catch(() => null);
  check('sign up in the app', await A.evaluate(() => Cloud.signedIn()), await A.evaluate(() => UI.sheet && UI.sheet.error));
  await A.evaluate(() => Cloud.syncNow());
  const st = await A.evaluate(() => ({ s: Cloud.status.state, e: Cloud.status.error, v: Cloud.meta().version, n: S.workouts.length }));
  check('first backup', st.s === 'ok' && st.v >= 1, st);
  const B = await page();
  await B.evaluate(() => ACT['acct-open']({ dataset: { mode: 'signin' } }));
  await B.fill('#acct-email', email); await B.fill('#acct-pw', pw); await B.click('[data-act=acct-submit]');
  await B.waitForFunction(() => S.onboarded, null, { timeout: 20000 }).catch(() => null);
  check('restore on a second phone', await B.evaluate(n => S.onboarded && S.workouts.length === n && S.profile.name === 'UI Test', st.n));
  await B.evaluate(() => { S.profile.name = 'UI Test 2'; save(); }); await B.waitForTimeout(3500);
  await A.evaluate(() => Cloud.syncNow());
  check('change syncs to the first phone', await A.evaluate(() => S.profile.name === 'UI Test 2'));
  await A.screenshot({ path: 'live-today.png' });
  await A.evaluate(() => ACT['acct-delete']()); await A.click('[data-act=confirm-ok]'); await A.waitForTimeout(3000);
  check('delete account', await A.evaluate(() => !Cloud.signedIn()));
  check('no page errors', !A._e.length && !B._e.length, [A._e, B._e]);
} catch (e) { check('run', false, e.message); }
console.log(out.join('\n')); if (process.env.GITHUB_ACTIONS) console.log(`::notice title=App checks::` + out.join('%0A')); console.log(failed ? `\n${failed} check(s) failed` : '\nAll live app checks passed');
await b.close(); process.exit(failed ? 1 : 0);
