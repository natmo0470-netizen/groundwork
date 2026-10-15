/* Movla — Instacart shopping-list hand-off (Cloudflare Worker).
   Keeps your Instacart Developer Platform API key off users' phones.
   The app POSTs { title, line_items } here; this calls Instacart's "create shopping list page"
   endpoint and returns { url } for the app to open.

   Setup (free Cloudflare account):
     1. Apply for an Instacart Developer Platform key: https://www.instacart.com/company/business/developers
     2. npm create cloudflare@latest groundwork-instacart  → paste this file as src/index.js
     3. npx wrangler secret put INSTACART_API_KEY
     4. npx wrangler deploy  → copy the worker URL into SERVICE_CONFIG.instacartEndpoint in js/mealplan.js
   Check Instacart's current API docs before going live; endpoint paths and fields can change. */
const INSTACART_URL = 'https://connect.instacart.com/idp/v1/products/products_link'; // development: https://connect.dev.instacart.tools/...
const ALLOWED_ORIGIN = 'https://natmo0470-netizen.github.io';

export default {
  async fetch(request, env) {
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });
    let body;
    try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400, headers: cors }); }
    const items = (body.line_items || []).slice(0, 200).map(i => ({
      name: String(i.name || '').slice(0, 100),
      display_text: String(i.display_text || i.name || '').slice(0, 100),
      quantity: Number(i.quantity) || 1,
      unit: String(i.unit || 'each').slice(0, 20),
    })).filter(i => i.name);
    if (!items.length) return new Response('No items', { status: 400, headers: cors });
    const res = await fetch(INSTACART_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.INSTACART_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ title: String(body.title || 'Movla groceries').slice(0, 100), link_type: 'shopping_list', line_items: items }),
    });
    if (!res.ok) return new Response(JSON.stringify({ error: 'instacart', status: res.status }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    const data = await res.json();
    return new Response(JSON.stringify({ url: data.products_link_url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
