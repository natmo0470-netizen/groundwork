// Movla — revenuecat: keeps Plus and coach plans in step with App Store / Google Play subscriptions.
//
//   POST from RevenueCat (webhook, Authorization: <REVENUECAT_WEBHOOK_AUTH>)
//        → for every Movla account in the event, ask RevenueCat what's active now and save it.
//   POST from the app right after a purchase or restore (Authorization: Bearer <user's sign-in token>)
//        → the same for that person, so access opens immediately instead of waiting for the webhook.
//   GET  → { ready } (whether the keys are set)
//
// Secrets (Edge Functions → Secrets, set by the "Deploy edge functions" workflow):
//   REVENUECAT_SECRET_KEY    RevenueCat secret API key (sk_…), project settings → API keys. Never in the app.
//   REVENUECAT_WEBHOOK_AUTH  any long random string; paste the same value in RevenueCat → Integrations → Webhooks → Authorization header.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
//
// RevenueCat setup this expects (see server/README.md):
//   entitlements  plus · coach_starter · coach_growth · coach_pro · coach_studio
//   App User ID   the Movla account id (the app calls logIn with it)

const RC_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';
const HOOK_AUTH = Deno.env.get('REVENUECAT_WEBHOOK_AUTH') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_KEY') ?? '';

const COACH_SEATS: Record<string, number> = { starter: 5, growth: 15, pro: 40, studio: 100 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

const db = (fn: string, body: unknown) => fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
  method: 'POST',
  headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

function safeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* What's active for this person in the stores right now, as Movla plans. */
async function storePlans(userId: string) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { authorization: `Bearer ${RC_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error('RevenueCat returned ' + res.status);
  const sub = (await res.json())?.subscriber ?? {};
  const subs = sub.subscriptions ?? {}, now = Date.now(), rows: Record<string, unknown>[] = [];
  for (const [id, e] of Object.entries<any>(sub.entitlements ?? {})) {
    const ends = [e.expires_date, e.grace_period_expires_date].filter(Boolean).map((d: string) => Date.parse(d));
    const end = ends.length ? Math.max(...ends) : null;            // null = doesn't expire (lifetime / promo)
    if (end !== null && end <= now) continue;
    const s = subs[e.product_identifier] ?? {};
    const note = [s.store, s.is_sandbox ? 'sandbox' : '', s.unsubscribe_detected_at ? 'cancelled, runs to end of period' : '', s.billing_issues_detected_at ? 'billing issue' : '']
      .filter(Boolean).join(' · ');
    const ends_at = end === null ? null : new Date(end).toISOString();
    if (id === 'plus') rows.push({ kind: 'plus', plan: 'plus', ends_at, note });
    else if (id.startsWith('coach_') && COACH_SEATS[id.slice(6)]) rows.push({ kind: 'coach', plan: id.slice(6), seats: COACH_SEATS[id.slice(6)], ends_at, note });
  }
  // Only the biggest coach plan counts if someone somehow has two.
  const coach = rows.filter(r => r.kind === 'coach').sort((a: any, b: any) => b.seats - a.seats);
  return rows.filter(r => r.kind !== 'coach').concat(coach.slice(0, 1));
}

async function sync(userId: string) {
  const rows = await storePlans(userId);
  const r = await db('apply_store_entitlements', { p_user: userId, p_rows: rows });
  if (!r.ok) throw new Error('Database returned ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') return reply(200, { ready: !!(RC_KEY && SB_KEY) });
  if (req.method !== 'POST') return reply(405, { error: 'GET or POST only' });
  if (!RC_KEY || !SB_KEY) return reply(503, { error: 'RevenueCat is not set up yet' });

  const auth = req.headers.get('authorization') ?? '';

  // ---- webhook from RevenueCat ----
  if (HOOK_AUTH && (safeEqual(auth, HOOK_AUTH) || safeEqual(auth, 'Bearer ' + HOOK_AUTH))) {
    let body: any; try { body = await req.json(); } catch { return reply(400, { error: 'Bad JSON' }); }
    const ev = body?.event ?? {};
    if (ev.type === 'TEST') return reply(200, { ok: true, test: true });
    const ids = [...new Set([ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])]
      .filter((x: unknown) => typeof x === 'string' && UUID.test(x as string)))] as string[];
    await db('log_billing_event', {
      p_id: String(ev.id ?? crypto.randomUUID()), p_user: ids[0] ?? null, p_type: String(ev.type ?? 'UNKNOWN'),
      p_product: ev.new_product_id ?? ev.product_id ?? null, p_store: ev.store ?? null, p_env: ev.environment ?? null,
      p_detail: { period: ev.period_type ?? null, reason: ev.cancel_reason ?? ev.expiration_reason ?? null, entitlements: ev.entitlement_ids ?? null },
    }).catch(() => null);
    // Always re-read the current state (safe to repeat when RevenueCat retries).
    const errors: string[] = [];
    for (const id of ids) { try { await sync(id); } catch (e) { errors.push(String((e as Error).message)); } }
    // A failure here returns 500 so RevenueCat retries later.
    return errors.length ? reply(500, { error: errors[0] }) : reply(200, { ok: true, users: ids.length });
  }

  // ---- the app, right after a purchase or restore ----
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in first' });
  const who = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, authorization: `Bearer ${token}` } });
  if (!who.ok) return reply(401, { error: 'Sign in again' });
  const user = await who.json();
  if (!user?.id || !UUID.test(user.id)) return reply(401, { error: 'Sign in again' });
  try {
    const rows = await sync(user.id);
    await db('log_billing_event', { p_id: 'sync:' + crypto.randomUUID(), p_user: user.id, p_type: 'APP_SYNC', p_product: null, p_store: null, p_env: null, p_detail: { active: rows.length } }).catch(() => null);
    return reply(200, { ok: true, active: rows.map(r => ({ kind: r.kind, plan: r.plan, ends_at: r.ends_at })) });
  } catch (e) {
    return reply(502, { error: (e as Error).message });
  }
});
