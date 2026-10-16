// Movla — instacart-list: turns a grocery list into an Instacart shopping-list page.
// The app calls
//   GET  <project>/functions/v1/instacart-list            → { ready: true|false }  (is a key set?)
//   POST <project>/functions/v1/instacart-list  { title, line_items: [{ name, display_text, quantity, unit }] }
//                                                          → { url }  (open it; the person picks a store and checks out)
// The Instacart Developer Platform key lives only in this function's secrets (INSTACART_API_KEY), never in the app.
// INSTACART_ENV = 'production' uses connect.instacart.com; anything else uses the development host.
// Orders placed from these pages earn the Instacart Developer Platform commission (paid through Impact).

const KEY = Deno.env.get('INSTACART_API_KEY') ?? '';
const HOST = (Deno.env.get('INSTACART_ENV') ?? '').toLowerCase() === 'production'
  ? 'https://connect.instacart.com' : 'https://connect.dev.instacart.tools';
const LINKBACK = 'https://movla.app/';
const PER_MINUTE = 6;   // lists per IP address per minute
const hits = new Map<string, number[]>();
const UNITS = new Set(['each', 'cup', 'cups', 'oz', 'ounce', 'ounces', 'fl oz', 'lb', 'lbs', 'pound', 'pounds', 'g', 'gram', 'grams', 'kg',
  'ml', 'l', 'liter', 'liters', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons', 'gallon', 'gallons', 'quart',
  'quarts', 'pint', 'pints', 'can', 'cans', 'package', 'packages', 'bunch', 'bunches', 'head', 'heads', 'clove', 'cloves', 'dozen']);

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
const str = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method === 'GET') return reply(200, { ready: !!KEY, env: HOST.includes('dev') ? 'development' : 'production' });
  if (req.method !== 'POST') return reply(405, { error: 'GET or POST only' });
  if (!KEY) return reply(503, { error: 'INSTACART_API_KEY is not set' });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return reply(429, { error: 'Too many lists. Try again in a minute.' });
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  let body: any;
  try { body = await req.json(); } catch { return reply(400, { error: 'Bad JSON' }); }
  const line_items = (Array.isArray(body?.line_items) ? body.line_items : []).slice(0, 150).map((i: any) => {
    let quantity = Math.min(1000, Math.max(0.01, Number(i?.quantity) || 1));
    let unit = str(i?.unit, 20).toLowerCase() || 'each';
    // Units Instacart understands keep their amount; anything else ("avocado", "slices") becomes a whole count.
    if (!UNITS.has(unit)) { unit = 'each'; quantity = Math.ceil(quantity); }
    return {
      name: str(i?.name, 100),
      display_text: str(i?.display_text || i?.name, 100),
      line_item_measurements: [{ quantity, unit }],
    };
  }).filter((i: any) => i.name);
  if (!line_items.length) return reply(400, { error: 'No items' });

  const title = str(body?.title, 100) || 'Movla groceries';
  const call = (items: unknown[]) => fetch(`${HOST}/idp/v1/products/products_link`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ title, link_type: 'shopping_list', expires_in: 30, line_items: items, landing_page_configuration: { partner_linkback_url: LINKBACK } }),
    signal: AbortSignal.timeout(10000),
  });
  try {
    let res = await call(line_items);
    // A unit Instacart doesn't recognise (e.g. "slices") rejects the whole list; retry with plain counts.
    if (res.status === 400) res = await call(line_items.map((i: any) => ({ name: i.name, display_text: i.display_text, line_item_measurements: [{ quantity: Math.max(1, Math.ceil(i.line_item_measurements[0].quantity)), unit: 'each' }] })));
    if (!res.ok) return reply(502, { error: 'Instacart returned ' + res.status, detail: (await res.text()).slice(0, 300) });
    const data = await res.json();
    if (!data?.products_link_url) return reply(502, { error: 'Instacart sent no link' });
    return reply(200, { url: data.products_link_url });
  } catch (_e) {
    return reply(504, { error: 'Instacart did not answer in time' });
  }
});
