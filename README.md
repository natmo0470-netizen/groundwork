# Groundwork — v1.2

A beginner-friendly workout and nutrition web app. It runs entirely in the browser, with no server and no account. Data is saved on the device.

## Run it

- **On this computer:** double-click `index.html`. Chrome, Edge, Safari and Firefox all work.
- **On your phone:** open the published link, or host this folder on any static host (GitHub Pages, Netlify, Cloudflare Pages) and open that address.
- **Share with testers (and make it installable):** put this folder on GitHub Pages, Netlify or Cloudflare Pages (all free). Testers open the address on their phone and choose **Add to Home Screen** or **Install app**. It then opens full-screen like an app and works offline.
- To try it without setting up, tap **Explore with sample data** on the welcome screen. Use **Start fresh** to clear it.

## What's in v1

| Area | What it does |
| --- | --- |
| Onboarding | 5 steps: body stats (lb/ft or kg/cm), goal, experience + activity, training days + session length, equipment ("Full gym" or pick items) |
| Calorie calculator | Mifflin-St Jeor BMR × activity, goal adjustment, safety floor (1,200 / 1,500 kcal) |
| Macros | Recommended protein/carbs/fat per goal; switch to custom grams any time; reset to recommended |
| Food log | 167 built-in foods, online search of Open Food Facts, servings, 4 meals, quick add, custom foods, recents |
| Workout plan | Split chosen from days/week (2–6) and goal; exercises filtered by equipment and experience; swap any exercise |
| Exercise guides | 118 exercises, each with an animated demo, step-by-step form cues and muscles worked |
| Logger | Weight × reps per set, previous-session column, rest timer, suggested next weight (double progression), PR detection |
| Progress | Weight trend (7-day average), weekly check-in that adjusts calories, 7-day calorie chart, PR board, history |
| Reminders | Workout day, missed sessions, food logging, protein behind, weigh-in, weekly check-in; optional browser notifications while open |
| Barcode scan | Camera scan (or photo, or typed number) looks the product up in Open Food Facts; unknown products can be saved with their barcode so they scan instantly next time |
| Training blocks | 6-week blocks (8 for beginners). The last week is a deload with fewer sets at about 90% weight. A new block keeps the main lifts and rotates accessories |
| Install + offline | App icon, home-screen install, offline cache (when hosted on https) |
| Tester feedback | Settings → Send feedback: ease rating, area, what's confusing or missing; copy all to send |
| Meal plans | Household: add family members (age group or custom calories, which meals they eat, foods they avoid); everyone shares recipes in their own portion, grocery list covers all. 7-day plans from 71 built-in recipes, servings scaled to hit calorie and protein targets; diet styles, foods to avoid, meals and snacks per day, quick meals, cook-once-eat-twice leftovers, budget mode; swap, lock and log any meal |
| Grocery list | Built from the plan, grouped by aisle, amounts rounded to what you'd buy, cost estimate, pantry check, add your own items, copy/share, one-tap search links for Instacart, Walmart, Kroger and Amazon Fresh; whole-list Instacart hand-off ready to switch on (see server/README.md) |
| Data | Download a backup file or copy it as text; restore from file or text on another device; erase all |

## Files

```
index.html          page shell
css/styles.css      design tokens (light + dark) and components
js/exercises.js     exercise library + equipment list
js/scanner.js       barcode scanning (built-in detector or ZXing from a CDN)
manifest.webmanifest, sw.js, icons/   install-as-app and offline support
js/foods.js         built-in food list + Open Food Facts search
js/recipes.js       ingredient catalog (nutrition, price, diet flags) + recipe library
js/mealplan.js      meal plan generator, grocery list, store links, optional services config
js/mealui.js        meal plan + grocery screens
server/             optional Instacart and recipe-service functions (Cloudflare Workers)
js/anim.js          animated exercise demos (stick-figure poses solved with inverse kinematics)
js/store.js         storage adapter (swap for a cloud database in Phase 5)
js/calc.js          calorie/macro math and units
js/planner.js       plan builder, progression, personal records
js/reminders.js     reminder rules and weekly check-in
js/ui.js, app.js, screens.js, actions.js   screens and interactions
```

## Known limits in v1

- Data lives in one browser on one device. To move it: Settings → Back up → Download backup file, send the file to the other device, then Settings → Restore there. Cloud sync arrives in Phase 5.
- Browser notifications only fire while the app is open. Reminders with the app closed come with the Phase 2 store app.
- Online food search needs internet access and may be blocked inside some embedded viewers. The built-in list and Quick add always work.
- Live barcode scanning needs a camera and a secure page (https or the file opened on your computer). The published Claude link can't use the camera or reach the food database; use the hosted or local copy for scanning.
- Offline mode and install need the app hosted on an https address; opening `index.html` directly works but doesn't install.

The roadmap (app store → wearables → meal plans and grocery → cloud sync → subscription) is in the **Workout App Roadmap** doc.

This is general fitness guidance, not medical advice.
