# Groundwork — v1.15

A beginner-friendly workout and nutrition web app. It runs entirely in the browser, with no server and no account. Data is saved on the device.

## Run it

- **On this computer:** double-click `index.html`. Chrome, Edge, Safari and Firefox all work.
- **On your phone:** open the published link, or host this folder on any static host (GitHub Pages, Netlify, Cloudflare Pages) and open that address.
- **Share with testers (and make it installable):** put this folder on GitHub Pages, Netlify or Cloudflare Pages (all free). Testers open the address on their phone and choose **Add to Home Screen** or **Install app**. It then opens full-screen like an app and works offline.
- To try it without setting up, tap **Explore with sample data** on the welcome screen. Use **Start fresh** to clear it.

## What's in v1

| Area | What it does |
| --- | --- |
| Onboarding | 5 steps: body stats (lb/ft or kg/cm), goal, experience + activity, training days (2–7) + session length, equipment (pick your gym chain, "Full gym", or individual items) |
| Experience views | Guided (beginners: screen tips, first-week checklist, 11 guides, calories + protein first, plain-language labels, logger helpers), Standard and Advanced; set from experience level, switchable in Settings |
| Advanced tools | Advanced view: reps in reserve per set (bigger weight jumps when sets were easy), warm-up and drop sets, supersets (rest after the pair), weekly sets per muscle vs. target ranges, more carbs on training days, refeed days, diet breaks (check-ins pause). Standard + Advanced: create your own workouts, edit sets/reps/rest on any exercise, plate calculator, strength trend per exercise, body measurements with estimated body fat |
| Phone and watch data (Phase 3) | Apple Health / Health Connect: reads steps, active calories, sleep, resting heart rate, weigh-ins and workouts from other apps and watches; writes your logged weight. Today shows an activity card with a step goal and a low-recovery warning (short sleep or raised resting heart rate); Progress shows 7-day steps, average sleep and other apps' workouts. Reminders have Open / Remind me in 1 hour buttons, and the rest timer sends a notification when rest ends; both appear on a paired watch. Garmin, Fitbit and Strava come later |
| Coach tools | Clients choose what their coach can see when they join (training, nutrition totals, body, phone and watch activity, pain and health flags, or pause all) and can change it any time; coaches can always send plans and nutrition goals for the client to accept. Coach mode adds a Clients tab: seat limit by plan (10/30/75), invite clients, assign a program, your own workouts and macro targets with a note, read client updates (adherence, weight trend, workouts with sets and RIR, daily food totals, measurements, pain reports, flags). Clients send weekly updates. All by shared files; after the invite they're encrypted (AES-256-GCM) with a key only coach and client hold |
| Safety | Health check (PAR-Q-based) with a doctor-clearance prompt; joint issues or pregnancy leave out high-impact moves; no deficit when pregnant or breastfeeding and a gentler one under 18; "Something hurts?" in the logger swaps the exercise and can rule it out of future plans; repeated-pain and low-intake warnings |
| Data accuracy and privacy | Food search shows USDA results first (verified) with source badges, and flags online foods whose calories don't match their macros; password-protected (encrypted) backups; "Something wrong with this demo?" on every exercise, plus a coach review page for all demos |
| Calorie calculator | Mifflin-St Jeor BMR × activity, goal adjustment, safety floor (1,200 / 1,500 kcal) |
| Macros | Recommended protein/carbs/fat per goal; switch to custom grams any time; reset to recommended |
| Food log | 167 built-in foods, online search of Open Food Facts, servings, 4 meals, quick add, custom foods, recents |
| Workout plan | Split chosen from days/week (2–7) and goal; exercises filtered by equipment and experience; swap any exercise |
| Programs | 12 ready-made programs (beginner full body, 5×5, power/size upper-lower, push/pull/legs, 5-day split, dumbbell-only, bodyweight, fat loss, glute focus, minimalist 2-day, old-school 6-day, 7-day hybrid); exercises adapt to your equipment; any number of days (sessions rotate) |
| Quick day switch | Tap any day (or Switch on Today) to change it to another session, a new session type, or rest, for just that date or every week; or trade two days |
| Gym presets | Typical equipment for 10 gym chains plus hotel, home-dumbbell and garage setups; adjust per club |
| Exercise guides | 358 exercises (chest, back, shoulders, arms, legs, glutes, calves, core, traps, forearms, cardio), each with an animated demo, step-by-step form cues and muscles worked |
| Logger | Weight × reps per set, previous-session column, rest timer, suggested next weight (double progression), PR detection |
| Progress | Weight trend (7-day average), weekly check-in that adjusts calories, 7-day calorie chart, PR board, history |
| Reminders | Workout day, missed sessions, food logging, protein behind, weigh-in, weekly check-in; optional browser notifications while open |
| Barcode scan | Camera scan (or photo, or typed number) looks the product up in Open Food Facts; unknown products can be saved with their barcode so they scan instantly next time |
| Training blocks | 6-week blocks (8 for beginners). The last week is a deload with fewer sets at about 90% weight. A new block keeps the main lifts and rotates accessories |
| Install + offline | App icon, home-screen install, offline cache (when hosted on https) |
| Phone app (Phase 2) | Android and iOS via Capacitor: reminders scheduled on the phone (arrive with the app closed; choose workout and food-log times), haptics, screen kept awake during workouts, backups through the share sheet, Android back button, bundled fonts, camera for barcode scanning |
| Tester feedback | Settings → Send feedback: ease rating, area, what's confusing or missing; copy all to send |
| Meal plans | Household: add family members (adults with editable calories; children and teens get a U.S. Dietary Guidelines recommendation by age, sex and activity, adjustable ±20%; which meals they eat, foods they avoid); everyone shares recipes in their own portion, grocery list covers all. 7-day plans from 71 built-in recipes, servings scaled to hit calorie and protein targets; diet styles, foods to avoid, meals and snacks per day, quick meals, cook-once-eat-twice leftovers, budget mode; swap, lock and log any meal |
| My meals | Build a meal from ingredients (built-in foods, grocery ingredient catalog, your foods, USDA / Open Food Facts, or your own label numbers) in g, oz, lb, cups, spoons, ml or servings; set how many servings it makes and the cooked weight; get calories and macros per serving and for the batch, plus how much to portion out; log it like any food; duplicate, edit, or save a meal-plan recipe to tweak |
| Grocery list | Built from the plan, grouped by aisle, amounts rounded to what you'd buy, cost estimate, pantry check, add your own items, copy/share, one-tap search links for Instacart, Walmart, Kroger and Amazon Fresh; whole-list Instacart hand-off ready to switch on (see server/README.md) |
| Data | Download a backup file or copy it as text; restore from file or text on another device; erase all |
| Coaches and plans | Coach tools need an active coach plan on the account (checked by the server); a coach sign-up flow (account → business profile → credentials → plan by client seats → invite your first client); free plans for friends and family granted by email (`server/supabase/admin.sql`); coaches' clients get Plus free |
| Account & sync | Optional email account (sign-up asks for consent to store health data; older accounts are asked once before syncing): private cloud backup, sync across phones with a version check (choose which copy to keep if two devices changed), password reset, delete account. Coaches invite with an 8-character code; client progress syncs live, limited by the client's sharing choices and enforced in the database; plans arrive in the client's app to accept or decline. Coaches send an invite link that walks the client through joining (who invited you → account → what to share → setup → Coach tab); Coach tab (Clients tab for coaches) with a message thread; new messages and plans show in the reminders bell, on the tab badge, and as a phone notification when the app is in the background |

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
js/meals.js         My meals: meal builder with unit conversion and per-serving macros
server/             optional Instacart and recipe-service functions (Cloudflare Workers)
server/supabase/    Phase 5 cloud database: schema with sharing enforced by row-level security, tests, setup notes
js/anim.js          animated exercise demos (stick-figure poses solved with inverse kinematics)
js/store.js         on-device storage (cloud.js syncs it when signed in)
js/calc.js          calorie/macro math and units
js/planner.js       plan builder, day switching, progression, personal records
js/programs.js      ready-made programs
js/guide.js         experience views, tips, first-week checklist, guides
js/advanced.js      advanced lifter tools
js/safety.js        health check, pain reports, encrypted backups, food-data checks
js/coach.js         coach mode and client linking (live with an account, or by file)
js/cloud-config.js  Supabase project URL and public key (empty = cloud features hidden)
js/cloud.js         accounts, backup and sync, live coaching (Supabase REST, no SDK)
js/join.js          invite links: the client's join flow
js/coachstart.js    becoming a coach: onboarding, waits for a coach plan, then invite your first client
js/native.js        phone features (no-op on the website)
js/health.js        Apple Health / Health Connect (phone app only)
scripts/android-config.js  Android project settings applied in the cloud build
privacy.html        privacy policy, including the consumer health data section (linked from the stores, welcome screen and Settings)
terms.html          terms of use (conduct rules for messages, coaching, not medical advice)
delete-account.html web page to delete an account and its data (required by Google Play)
store/              store screenshot script and Play feature graphic
native/             Android resources copied into the app build (notification icon)
.github/workflows/  Android APK + signed Play bundle, iOS build check, store screenshots
js/reminders.js     reminder rules and weekly check-in
js/ui.js, app.js, screens.js, actions.js   screens and interactions
```

## Known limits in v1

- Without an account, data lives in one browser on one device (move it with a backup file). With an account (Settings → Account & sync) it backs up and syncs; cloud features appear once `js/cloud-config.js` has the project URL and key.
- Browser notifications only fire while the app is open. Reminders with the app closed come with the Phase 2 store app.
- Online food search needs internet access and may be blocked inside some embedded viewers. The built-in list and Quick add always work.
- Live barcode scanning needs a camera and a secure page (https or the file opened on your computer). The published Claude link can't use the camera or reach the food database; use the hosted or local copy for scanning.
- Offline mode and install need the app hosted on an https address; opening `index.html` directly works but doesn't install.

The roadmap (app store → wearables → meal plans and grocery → cloud sync → subscription) is in the **Workout App Roadmap** doc.

This is general fitness guidance, not medical advice.
