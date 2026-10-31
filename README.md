# LeaveWise

LeaveWise is a mobile-first trip planner that recommends when to leave so you can arrive by a time you choose. Enter a trip in a short sentence or use the form, review the places and arrival time, and get a traffic-aware departure recommendation with a clear breakdown.

The app is built as an installable Progressive Web App (PWA). It has no user accounts. Trip history for calibration and evaluation stays in the current browser; saved push reminders use the configured server database.

## Features

- Traffic-aware route estimates through TomTom Routing, with a sample estimate fallback when routing is unavailable.
- TomTom place search and autocomplete, with sample suggestions when Search is unavailable.
- Leave-time recommendations for car, two-wheeler, and walking trips.
- Adjustable fixed buffers and three on-time confidence targets.
- Open-Meteo hourly rain forecast. Rain adds a small time penalty to walking and two-wheeler trips; no rain penalty is added for cars.
- Optional natural-language trip entry and concise explanations through Groq.
- A one-tap option to use the device’s current location when a trip description has no origin. The browser asks for location permission only after the user taps the option.
- Optional trip reminders with Web Push, VAPID, Supabase, and a protected scheduled recheck endpoint.
- Trip-duration logging, learned safety margins, recommendation evaluation, and CSV export.
- PWA manifest, icons, and service worker.

## Technology

- Next.js App Router and React
- TypeScript
- Tailwind CSS
- TomTom Search and Routing APIs
- Open-Meteo Forecast API
- Groq Chat Completions API (optional)
- Supabase and Web Push (optional reminders)

Third-party API requests that use secrets are made by server-side Next.js API routes. API keys must never be exposed through `NEXT_PUBLIC_*` variables or committed to Git.

## Run locally

### Requirements

- Node.js 22 or newer
- npm

### Start the development server

In a terminal, change to the project folder (the folder containing `package.json`) and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If you are using PowerShell, for example:

```powershell
cd "C:\Users\pc\Desktop\Coding\PSDT Project"
npm install
npm run dev
```

Running `npm run dev` from a different folder will fail if that folder does not contain the project’s `package.json`.

## Environment variables

Copy `.env.example` to `.env.local` in the project root. Add only the integrations you want to use. Restart the local server after changing environment variables.

| Variable | Needed for | Where to get it |
| --- | --- | --- |
| `TOMTOM_API_KEY` | Live place search and traffic-aware routing | [TomTom developer portal](https://docs.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key) |
| `GROQ_API_KEY` | Natural-language trip entry and AI-written result explanations | [GroqCloud API keys](https://console.groq.com/keys) |
| `SUPABASE_URL` | Saving trips and push subscriptions | Supabase project settings |
| `SUPABASE_SECRET_KEY` | Server access to saved-trip tables | Supabase project API keys; keep it server-only |
| `VAPID_PUBLIC_KEY` | Browser Web Push subscription | Generate a VAPID key pair |
| `VAPID_PRIVATE_KEY` | Signing server-side Web Push messages | Generate a VAPID key pair; keep it secret |
| `VAPID_SUBJECT` | Contact identifier required for Web Push | Use a contact such as `mailto:you@example.com` |
| `CRON_SECRET` | Protecting `/api/cron/rechecks` | Generate a long random secret |

TomTom and Groq are optional for running the app. Without TomTom, the app uses sample places or route estimates. Without Groq, use the normal trip form and deterministic explanation. Supabase, VAPID, and a cron service are needed for saved push reminders.

Open-Meteo does not require an API key for this project’s forecast requests.

### Keep secrets private

- Put local secrets in `.env.local`; it is ignored by Git.
- In Vercel, add secrets under **Project → Settings → Environment Variables**. Select the environments you use, such as Production and Preview, then redeploy.
- Use the exact variable names above. Do not prefix server secrets with `NEXT_PUBLIC_`.
- Never paste API keys into source files, screenshots, GitHub, or chat.

## Install and test the PWA

The service worker registers in production mode. To test the installable version locally:

```bash
npm run build
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in a supported browser. For phone testing, deploy the site to HTTPS and open the deployed address on the phone.

On iPhone, open the site in Safari, tap **Share → Add to Home Screen**, and launch LeaveWise from the new Home Screen icon. Web Push on iPhone requires the installed Home Screen web app; push is not available from a regular Safari tab. Android users can install from a supported browser’s install option. Push reminders also require the server and cron setup below.

## How the recommendation works

The planner estimates duration at the candidate departure time, then updates that candidate and asks TomTom for another route estimate. It makes up to three routing requests because traffic can change with departure time.

The default calculation is:

```text
recommended leave time = arrive-by time
                        - estimated travel duration
                        - safety margin
                        - fixed buffer
                        - applicable rain penalty
```

Default fixed buffers are 8 minutes for car, 5 for two-wheeler, and 0 for walking. The default safety margins are 5% for casual trips, 15% for important trips, and 30% for critical trips. Important and critical trips have a 3-minute minimum safety margin.

After at least five completed trips have been logged, the app can use the selected confidence percentile of `actual duration - predicted duration` residuals instead of the percentage margin. Only completed trips with live TomTom routing are used for this calibration. It is a small personal sample and does not guarantee the displayed on-time confidence.

Rain adds 6 minutes for walking and two-wheeler trips. Cars receive no extra rain penalty because the routing estimate already uses live traffic. When the weather forecast is unavailable, no rain penalty is applied.

## Natural-language trip entry

The optional Groq integration extracts the trip fields on the server. The server validates the result, checks that the arrival time is in the future, and interprets local times using the browser’s timezone. Groq does not receive the device’s current GPS coordinates.

If the description has no starting point, the app asks whether to use the device’s current location. Location permission is requested only after the user taps **Use my location**. If permission is declined or unavailable, the user can enter an origin manually. Place search and route planning still require valid selected coordinates.

If Groq is unavailable, the API key is missing, or parsing fails, the normal trip form remains available. The result calculation has a deterministic explanation fallback.

## Saved trips and push reminders

Push reminders require a Supabase project, the database schema, VAPID keys, and an external cron service.

1. Create a Supabase project. Add its project URL to `SUPABASE_URL` and the server-only secret key to `SUPABASE_SECRET_KEY` in local or Vercel environment variables.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. It creates tables for push subscriptions, saved trips, and scheduled rechecks, plus a function to safely claim due work.
3. If upgrading an existing Phase 3 database, also run [`supabase/phase4.sql`](supabase/phase4.sql) once to add fields used for learned margins.
4. Generate a VAPID key pair with the installed web-push command:

   ```powershell
   .\node_modules\.bin\web-push.cmd generate-vapid-keys
   ```

   Put the generated values into `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`, and set `VAPID_SUBJECT` to a contact address. Keep the private key secret.

5. Set `CRON_SECRET` to a long random value.
6. Configure an external cron service to call `https://YOUR-DOMAIN/api/cron/rechecks` every minute with the header `Authorization: Bearer YOUR_CRON_SECRET`.

When a trip is saved, the app schedules checks at T-60, T-30, and T-15 minutes before the planned leave time. A recheck recalculates the route and can send an updated leave reminder. If the recommendation becomes “leave now,” the app sends that notification and stops the remaining checks. The cron route accepts GET or POST only with the correct bearer secret.

## Trip history and evaluation

The user can tap **I left · start timer** and **I arrived** to log actual duration. These personal logs are stored in the current browser’s local storage; they are not synced between devices or linked to an account.

Open `/evaluation` to compare the app recommendation with a baseline of raw TomTom ETA plus a fixed 10-minute buffer. The page reports on-time rate and mean error using completed live-route logs. The CSV export includes saved logs for a project report; sample-route entries are marked as sample and excluded from live-route metrics.

## Project structure

| Path | Purpose |
| --- | --- |
| `app/page.tsx` | Main trip-planner page. |
| `app/evaluation/page.tsx` | Evaluation page. |
| `app/api/places/route.ts` | Server-side TomTom place search and sample fallback. |
| `app/api/parse-trip/route.ts` | Optional Groq parsing, time normalization, and field validation. |
| `app/api/leave-time/route.ts` | Validates the trip and returns the leave-time plan. |
| `app/api/trips/route.ts` | Saves a trip and its push subscription. |
| `app/api/cron/rechecks/route.ts` | Protected scheduled recheck endpoint. |
| `components/trip-form.tsx` | Mobile-first form, location flow, result card, and trip timer. |
| `components/save-trip-button.tsx` | Push permission and save-trip controls. |
| `components/evaluation-dashboard.tsx` | Evaluation metrics and CSV download. |
| `lib/leave-time.ts` | Pure leave-time and buffer calculation. |
| `lib/plan-trip.ts` | Routing, weather lookup, fallback, and plan assembly. |
| `lib/groq.ts` | Server-only Groq REST helper; no Groq SDK dependency. |
| `lib/plan-explanation.ts` | AI explanation with numeric validation and fallback. |
| `lib/trip-history.ts` | Browser history and active-trip storage. |
| `lib/calibration.ts` | Learned safety margin from completed trip residuals. |
| `lib/evaluation.ts` | Baseline metrics and CSV generation. |
| `lib/weather.ts` | Rain forecast interpretation and penalty rules. |
| `public/manifest.json` | PWA name and installation settings. |
| `public/sw.js` | Service worker for basic offline page loading and push events. |
| `supabase/schema.sql` | Database objects for saved trips, subscriptions, and rechecks. |

## Tests and checks

Run the existing unit tests with:

```bash
npm test
```

The tests cover leave-time math, date-time helpers, weather, calibration, trip history, and evaluation/export. Build the production app with:

```bash
npm run build
```

### Manual checklist

- With no TomTom key, confirm sample locations or estimates are clearly marked as samples.
- With TomTom configured, search for places, select the intended results, and confirm routing uses a live estimate.
- Try all three travel modes and check their default fixed buffers.
- Try casual, important, and critical confidence settings and confirm safety margins change as expected.
- Confirm the arrival-time control defaults to tomorrow at 9:00 AM, accepts quick time buttons, and rejects past times.
- Describe a trip with an origin, destination, and arrival time. Confirm the details are filled and reviewed before planning.
- Describe a trip with destination and time but no origin. Confirm the app asks whether to use current location; test allow, deny, and manual-entry paths.
- Check that car trips show no added rain penalty and that walking/two-wheeler trips add the configured penalty when rain is forecast.
- Start and finish a trip timer; confirm the actual duration is recorded.
- After at least five completed live-route trips, check that the learned safety margin is used.
- Open `/evaluation`, compare metrics, and download the CSV.
- For push testing, verify Supabase, VAPID, and cron configuration first; test on Android and an installed iPhone Home Screen web app.

## Deployment on Vercel

1. Push the project to GitHub and import the repository into Vercel as a Next.js project.
2. Add the environment variables required by the features you plan to use. Keep all secrets server-side.
3. Deploy. Vercel automatically builds the Next.js app when the configured branch is updated.
4. When changing environment variables, save them and redeploy so the deployment receives the new values.
5. Check Vercel runtime logs for API route failures. The application may intentionally fall back to sample results when an external service is unavailable.

No custom `vercel.json` is required for the standard Next.js deployment.
