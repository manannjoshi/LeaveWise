# Leave On Time

A mobile-first trip planner built with Next.js App Router, TypeScript, and Tailwind. It uses TomTom for routes, Open-Meteo for rain forecasts, Supabase for saved trips and push subscriptions, and Web Push for trip reminders. Saved trips are linked to a browser's push subscription; there are no user accounts.

## Run it

1. Install Node.js 22 or newer (Node 22+ also runs the built-in TypeScript test command).
2. In this folder, run `npm install` and then `npm run dev` for normal development.
3. Open [http://localhost:3000](http://localhost:3000).
4. Copy `.env.example` to `.env.local` and fill in the service keys below. Restart the server after changing the file.
5. For PWA and push testing, use a production build: `npm run build`, then `npm start`. Push requires HTTPS; `localhost` is a secure context on the same device.

If PowerShell says it cannot find `npm-cli.js`, repair/reinstall Node.js LTS and reopen PowerShell. In this workspace, the temporary direct commands are `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" install` and `node "C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js" run dev`.

## File guide

- `package.json` — scripts plus Next.js, React, TypeScript, Tailwind, Supabase, and `web-push` dependencies.
- `package-lock.json` — exact dependency versions npm installed, so installs are repeatable.
- `tsconfig.json` — TypeScript checking and the `@/` import shortcut.
- `next-env.d.ts` — generated Next.js TypeScript references.
- `tsconfig.tsbuildinfo` — generated TypeScript build cache; Git ignores it.
- `next.config.ts` — Next.js configuration (kept minimal for this project).
- `postcss.config.mjs` — connects Tailwind CSS to Next.js through PostCSS.
- `.gitignore` — keeps generated files and private environment keys out of Git.
- `.env.example` — lists the TomTom, Supabase, VAPID, and cron server settings; copy it to `.env.local`.
- `public/manifest.json` — the app name and display settings used when installed from a browser.
- `public/icon.svg` — the simple install icon shown by browsers.
- `public/sw.js` — caches the app page for basic offline page loading.
- `app/layout.tsx` — shared HTML shell, page title, and PWA manifest link.
- `app/globals.css` — Tailwind import and a few global style defaults.
- `app/page.tsx` — the landing page and its introduction.
- `components/trip-form.tsx` — trip inputs, place suggestions, submit state, and the result card.
- `components/evaluation-dashboard.tsx` and `app/evaluation/page.tsx` — compare trip results and export the report as CSV.
- `components/service-worker-registration.tsx` — registers the offline page worker in browsers that support it.
- `lib/trip.ts` — shared TypeScript types for trips, places, and results.
- `lib/date-time.ts` — local time presets, datetime formatting, and arrive-by validation.
- `lib/calibration.ts` — chooses a confidence percentile from completed trip errors after five logs.
- `lib/trip-history.ts` — stores actual and predicted trip durations in this browser.
- `lib/evaluation.ts` — calculates evaluation metrics and creates the CSV contents.
- `lib/leave-time.ts` — pure leave-time calculation plus mode and buffer helpers.
- `lib/weather.ts` — hourly rain lookup and the mode-specific six-minute penalty rule.
- `lib/weather.test.ts` — unit tests for the rain lookup and penalty rules.
- `lib/leave-time.test.ts` — unit tests that provide mock travel durations without network calls.
- `lib/calibration.test.ts`, `lib/trip-history.test.ts`, and `lib/evaluation.test.ts` — tests for learned margins, trip logging, evaluation, and CSV export.
- `app/api/places/route.ts` — server-side TomTom place suggestions, with an offline sample fallback.
- `app/api/leave-time/route.ts` — validates trip input, refines departure estimates, and returns a live or sample plan.
- `app/api/trips/route.ts` — saves a trip, its browser push subscription, and the three reminder checkpoints.
- `app/api/push/vapid-public-key/route.ts` — gives the browser the public VAPID key; the private key stays server-side.
- `app/api/cron/rechecks/route.ts` — bearer-protected cron handler that claims due checks, replans, and sends notifications.
- `components/save-trip-button.tsx` — asks for notification permission and saves the current trip.
- `lib/plan-trip.ts` — shared server-side planner used by the form API and scheduled re-checks.
- `lib/validate-trip.ts` — validates trip coordinates, travel mode, importance, and optional buffer.
- `lib/supabase-admin.ts` — creates a server-only Supabase client using the secret key.
- `lib/push-server.ts` — configures VAPID signing for server-side Web Push.
- `supabase/schema.sql` — creates the push-subscription, trip, and scheduled-recheck tables plus a safe job-claim function.
- `supabase/phase4.sql` — adds learned-margin fields to an existing Phase 3 trips table.
- `public/icon-192.png`, `public/icon-512.png`, and `public/apple-touch-icon.png` — install icons for Android/desktop and iOS Home Screen.

## Calculation notes

The route handler queries departure-time traffic three times because travel duration changes with departure time. Before five completed live-routing trips, the formula adds a 5% / 15% / 30% safety margin, with a 3-minute minimum for important and critical trips. After five, the selected confidence (80% / 95% / 99%) uses that percentile of the browser's logged `actual duration - predicted duration` values instead. Sample-route logs do not calibrate live routing. This student project does not have enough data to guarantee the selected on-time probability.

The arrive-by field keeps the browser-native date/time picker and adds one-tap relative-time shortcuts. After traveling, enter the actual minutes and press **I arrived**. Logs stay in that browser's local storage; no account or server sync is used. The `/evaluation` page compares arrival error if each strategy starts at its recommended time: the app's allowance versus raw ETA + 10 minutes. It calculates metrics from completed live-route logs and includes every log in the CSV export.

For selected real places, the server also requests hourly rain and showers from Open-Meteo at the origin around the planned leave time. Rain adds six minutes for walking and two-wheeler trips; car trips receive no extra rain penalty. A missing forecast adds no penalty. Open-Meteo's free API permits educational non-commercial use, is rate limited, and requires CC BY 4.0 attribution; the app credits it in the page footer.

Run the calculation tests with `npm test` (or `node --experimental-strip-types --test` on Node.js 22+).

## Supabase and push setup

1. Create a Supabase project. In **Project Settings → API Keys**, copy the project URL and a server-only **secret** key into `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in `.env.local`. Never use this key in browser code.
2. In Supabase **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql). It creates three tables: `push_subscriptions` stores the browser endpoint and encryption keys; `trips` stores coordinates, arrive-by time, time zone, current leave estimate, and status; `trip_rechecks` stores the T-60, T-30, and T-15 jobs with their due time, baseline, and status. Row Level Security is enabled with no browser policies; only the server secret can access these tables.
3. For an existing Phase 3 database, also run [`supabase/phase4.sql`](supabase/phase4.sql) once to add the learned-margin fields used by saved trips and re-checks.
4. In PowerShell, generate VAPID keys with `.\node_modules\.bin\web-push.cmd generate-vapid-keys`. Put the public and private values in `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to a contact such as `mailto:you@example.com`.
5. Set `CRON_SECRET` to a long random value. The endpoint `/api/cron/rechecks` accepts GET or POST only when the `Authorization` header is `Bearer <CRON_SECRET>`.
6. Configure a cron service to call `https://your-domain/api/cron/rechecks` every minute with that Authorization header. The route safely claims due rows so overlapping cron calls don't process the same trip checkpoint at once. A late poll can make a notification arrive up to about a minute after its target.

Only future checkpoints are scheduled when a trip is saved. After each re-check, the app recalculates the recommendation and moves the remaining checkpoints to T-60, T-30, and T-15 relative to the updated leave time. If the new recommendation says to leave now, it sends that notification and stops the remaining checks.

## Test push on phones

- **Android:** use a deployed HTTPS URL, open it in Chrome, install the app, launch it from the home screen, calculate a trip, and tap **Save trip & enable reminders**. Allow notifications. Keep the external cron running; use a trip whose next checkpoint is soon, then check that a push arrives with Chrome closed.
- **iPhone:** use iOS/iPadOS 16.4 or later. Open the deployed HTTPS site in Safari, choose **Share → Add to Home Screen**, launch the installed app from its icon, then save a trip and allow notifications. iOS Web Push is supported for Home Screen web apps; a normal Safari tab is not enough. ([Apple's Web Push requirements](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers?language=objc))
- For a quick cron check, call the endpoint with `Authorization: Bearer <CRON_SECRET>`; without the correct header it must return HTTP 401. Configure the scheduler separately; the project does not create a cron-service account.

## Get a TomTom key

Create or sign into a TomTom account, open **API & SDK Keys**, and copy the key TomTom has created for you. Put it in `.env.local` as `TOMTOM_API_KEY=...`; do not prefix it with `NEXT_PUBLIC_`. TomTom's current key instructions are [here](https://docs.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key).

## Manual checks

- Submit a trip with both sample locations and no key; confirm the result is labeled as a sample estimate.
- Try car, two-wheeler, and walk; check default buffers of 8, 5, and 0 minutes and edit a buffer.
- Try casual, important, and critical; check the target labels of 80%, 95%, and 99%, and confirm safety minutes increase.
- Confirm the arrive-by field starts at tomorrow at 9:00 AM and rejects a past time with an inline message.
- Try the one-tap arrival presets and confirm each updates the date/time picker.
- Complete five live-route logs, then plan another trip and confirm the safety margin is labeled learned; sample-route logs should not count toward the five.
- Open `/evaluation`, compare app and baseline metrics, and export the CSV. Mock-route logs should appear in the CSV but be excluded from live-route metrics.
- Search for locations with a TomTom key, select suggestions, and verify the route uses the selected places.
- With a key, confirm live routes work; temporarily use a bad key or disable the network and confirm the sample result still appears.
- Enter the same arrival time and duration in the unit tests to confirm leave time equals arrival minus travel duration, safety margin, and fixed buffer.
"# LeaveWise" 
