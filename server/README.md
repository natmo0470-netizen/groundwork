# Optional server functions

Groundwork works without any server. These two small functions switch on extra services
while keeping your API keys secret (keys must never be put in the app itself).

| File | What it switches on | Needs |
| --- | --- | --- |
| `instacart-function.js` | "Send whole list to Instacart" button on the grocery list | Instacart Developer Platform API key (apply and get approved) |
| `recipes-function.js` | "Search more recipes online" on the meal Swap screen | Spoonacular API key (free tier available) |

Both run on Cloudflare Workers' free plan. Deploy one, then paste its URL into
`SERVICE_CONFIG` at the top of `js/mealplan.js` and push. Until then the app uses
store search links and the built-in recipe library.
