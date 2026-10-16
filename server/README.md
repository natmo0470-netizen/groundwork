# Optional server functions

Movla works without any server. These two small functions switch on extra services
while keeping your API keys secret (keys must never be put in the app itself).

| File | What it switches on | Needs |
| --- | --- | --- |
| `supabase/functions/instacart-list` | "Send whole list to Instacart" button on the grocery list. Deployed by the *Deploy edge functions* workflow; switches on when the `INSTACART_API_KEY` repository secret is set (`INSTACART_ENV` = `production` once your production key is active) | Instacart Developer Platform key (free; dashboard.instacart.com) |
| `supabase/functions/revenuecat` | App Store / Google Play subscriptions: RevenueCat's webhook, and the app's "I just bought something" check. Saves Plus and coach plans on the account (migration 011) | RevenueCat secret API key + a webhook password (GitHub secrets `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH`) |
| `instacart-function.js` | Older Cloudflare Worker version of the same thing. Not needed now that the Supabase function exists | — |
| `recipes-function.js` | "Search more recipes online" on the meal Swap screen | Spoonacular API key (free tier available) |

Both run on Cloudflare Workers' free plan. Deploy one, then paste its URL into
`SERVICE_CONFIG` at the top of `js/mealplan.js` and push. Until then the app uses
store search links and the built-in recipe library.


## Subscriptions (RevenueCat)

The app sells Plus and coach plans with the stores' own checkout. RevenueCat sits between the stores and Movla.
Everything below is done once, after the Apple and Google developer accounts exist.

**Products to create** (same IDs in App Store Connect and Google Play; prices are yours to set)

| Product ID | What | Suggested |
| --- | --- | --- |
| `movla_plus_monthly` / `movla_plus_annual` | Movla Plus | $2.99 / month, $19.99 / year |
| `movla_coach_starter` | Coach Starter, 5 clients | $12 / month, 14-day free trial |
| `movla_coach_growth` | Coach Growth, 15 clients | $25 / month, 14-day free trial |
| `movla_coach_pro` | Coach Pro, 40 clients | $49 / month, 14-day free trial |
| `movla_coach_studio` | Coach Studio, 100 clients | $99 / month, 14-day free trial |

Apple: put all coach products in one subscription group ("Coach plans") so moving between tiers is an upgrade, and
Plus in its own group. Google: one subscription per product with a monthly (and for Plus, yearly) base plan; the
free trial is an offer on the coach base plans.

**In RevenueCat**
1. Create a project "Movla"; add the App Store app (`app.movla.fitness`) and the Play Store app (same ID), with
   their store credentials (App Store Connect API key; Google service account), as RevenueCat's guide shows.
2. Entitlements: `plus`, `coach_starter`, `coach_growth`, `coach_pro`, `coach_studio`. Attach each product to its
   entitlement (both Plus products → `plus`).
3. Offerings: `default` (mark as current) with packages Monthly and Annual → the Plus products;
   `coach` with four custom packages named `starter`, `growth`, `pro`, `studio` → the coach products.
4. API keys: copy the **public** App Store key (`appl_…`) and Google Play key (`goog_…`) into
   `PURCHASES_CONFIG` at the top of `js/purchases.js`. Copy the **secret** key (`sk_…`) into the GitHub secret
   `REVENUECAT_SECRET_KEY` (never into the app).
5. Make up a long random password, save it as the GitHub secret `REVENUECAT_WEBHOOK_AUTH`, then in RevenueCat →
   Integrations → Webhooks add `https://eavcynlwjpwigrvfuvzd.supabase.co/functions/v1/revenuecat` with that same
   value as the Authorization header. Run the *Deploy edge functions* workflow, then press "Send test event".
6. Run `migrations/011_store_billing.sql` in the Supabase SQL Editor (once).

**Test** with sandbox / licence-tester accounts on a phone build. A test purchase shows up in Settings and in
`billing_events`; sandbox plans are marked "sandbox" in the plan's note. Turn test checkout off before launch
(admin console → System).
