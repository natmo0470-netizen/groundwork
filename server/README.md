# Optional server functions

Movla works without any server. These two small functions switch on extra services
while keeping your API keys secret (keys must never be put in the app itself).

| File | What it switches on | Needs |
| --- | --- | --- |
| `supabase/functions/instacart-list` | "Send whole list to Instacart" button on the grocery list. Deployed by the *Deploy edge functions* workflow; switches on when the `INSTACART_API_KEY` repository secret is set (`INSTACART_ENV` = `production` once your production key is active) | Instacart Developer Platform key (free; dashboard.instacart.com) |
| `instacart-function.js` | Older Cloudflare Worker version of the same thing. Not needed now that the Supabase function exists | — |
| `recipes-function.js` | "Search more recipes online" on the meal Swap screen | Spoonacular API key (free tier available) |

Both run on Cloudflare Workers' free plan. Deploy one, then paste its URL into
`SERVICE_CONFIG` at the top of `js/mealplan.js` and push. Until then the app uses
store search links and the built-in recipe library.
