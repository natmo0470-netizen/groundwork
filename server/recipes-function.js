/* Groundwork — recipe service search (Cloudflare Worker, Spoonacular).
   Lets the meal plan's Swap screen search thousands of extra recipes. Returns recipes in the same
   shape as the built-in library. Spoonacular has a free tier with daily limits; paid plans cost more.

   Setup: get a key at https://spoonacular.com/food-api, then
     npx wrangler secret put SPOONACULAR_API_KEY
     npx wrangler deploy  → copy the URL into SERVICE_CONFIG.recipeEndpoint in js/mealplan.js */
const ALLOWED_ORIGIN = 'https://natmo0470-netizen.github.io';
const DIET_MAP = { vegetarian: 'vegetarian', pescatarian: 'pescetarian', glutenfree: 'gluten free' };

export default {
  async fetch(request, env) {
    const cors = { 'Access-Control-Allow-Origin': ALLOWED_ORIGIN };
    const u = new URL(request.url);
    const q = (u.searchParams.get('q') || '').slice(0, 80);
    const diets = (u.searchParams.get('diets') || '').split(',').filter(Boolean);
    const p = new URLSearchParams({ apiKey: env.SPOONACULAR_API_KEY, query: q, number: '12', addRecipeNutrition: 'true', addRecipeInformation: 'true', fillIngredients: 'true' });
    const diet = diets.map(d => DIET_MAP[d]).find(Boolean); if (diet) p.set('diet', diet);
    if (diets.includes('dairyfree')) p.set('intolerances', 'dairy');
    const res = await fetch('https://api.spoonacular.com/recipes/complexSearch?' + p);
    if (!res.ok) return new Response(JSON.stringify({ recipes: [] }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    const data = await res.json();
    const nut = (r, n) => Math.round(((r.nutrition && r.nutrition.nutrients) || []).find(x => x.name === n)?.amount || 0);
    const recipes = (data.results || []).map(r => ({
      id: 'sp_' + r.id, name: r.title, meals: ['lunch', 'dinner'], minutes: r.readyInMinutes || 30,
      kcal: nut(r, 'Calories'), p: nut(r, 'Protein'), c: nut(r, 'Carbohydrates'), f: nut(r, 'Fat'),
      cost: Math.round((r.pricePerServing || 300) / 100 * 100) / 100, flags: '', batch: false, source: 'Spoonacular',
      ingredients: (r.extendedIngredients || []).map(i => [i.name, Math.round((i.amount / (r.servings || 1)) * 100) / 100]),
      steps: ((r.analyzedInstructions && r.analyzedInstructions[0] && r.analyzedInstructions[0].steps) || []).map(s => s.step).slice(0, 8),
    }));
    return new Response(JSON.stringify({ recipes }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
