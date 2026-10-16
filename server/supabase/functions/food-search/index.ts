// Movla — food-search: USDA FoodData Central search, with the API key kept on the server.
// The app calls  GET <project>/functions/v1/food-search?q=chicken+breast
// The key lives only in this function's secrets as USDA_API_KEY (Edge Functions → Secrets), never in the app.
// Anyone can search without an account, so the function limits each IP address and caches popular searches
// to stay well inside USDA's 1,000 requests an hour.

const KEY = (Deno.env.get('USDA_API_KEY') ?? '').trim();   // a pasted key can carry a newline, which USDA's server rejects
const PER_MINUTE = 20;                 // searches per IP address per minute
const CACHE_MS = 6 * 60 * 60 * 1000;   // keep a result for 6 hours
const cache = new Map<string, { at: number; body: string }>();
const hits = new Map<string, number[]>();

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'GET, OPTIONS',
};
const reply = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

// Only the fields the app reads, so responses stay small.
const NUTRIENTS = new Set(['203', '204', '205', '208', '957', '958']);
function trim(data: any) {
  return {
    foods: (data?.foods ?? []).map((f: any) => ({
      fdcId: f.fdcId,
      description: f.description,
      foodNutrients: (f.foodNutrients ?? [])
        .filter((n: any) => NUTRIENTS.has(String(n.nutrientNumber)))
        .map((n: any) => ({ nutrientNumber: String(n.nutrientNumber), nutrientName: n.nutrientName, value: n.value })),
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return reply(405, { error: 'GET only' });
  if (!KEY) return reply(503, { error: 'USDA_API_KEY is not set' });

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (q.length < 2) return reply(400, { error: 'Search for at least 2 characters' });

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return reply(429, { error: 'Too many searches. Try again in a minute.' });
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();

  const k = q.toLowerCase();
  const hit = cache.get(k);
  if (hit && now - hit.at < CACHE_MS) return reply(200, hit.body);

  // Commas in dataType must stay as commas: USDA rejects an encoded list (%2C) with HTTP 400.
  const url = 'https://api.nal.usda.gov/fdc/v1/foods/search?pageSize=15&dataType=Foundation,SR%20Legacy,Survey%20(FNDDS)&query=' + encodeURIComponent(q);
  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': KEY, accept: 'application/json', 'user-agent': 'Movla/1.0 (+https://movla.app)' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return reply(502, { error: 'USDA returned ' + res.status, detail: (await res.text()).replace(/[A-Za-z0-9]{40}/g, '…').slice(0, 300) });
    const body = JSON.stringify(trim(await res.json()));
    cache.set(k, { at: now, body });
    if (cache.size > 1000) cache.delete(cache.keys().next().value!);
    return reply(200, body);
  } catch (_e) {
    return reply(504, { error: 'USDA did not answer in time' });
  }
});
