# Working on Change Hub yourself

## Start here

This repository contains the standalone Hub. Run the project you want to review separately, with its own dependencies.

Open two terminals in `change-hub`:

```sh
# Terminal 1: Laravel dashboard + capture worker
php artisan hub:start

# Terminal 2: React development server with hot reload
npm run dev
```

Browse **http://127.0.0.1:4320**, not the Vite port. Laravel serves the page and Vite serves the React code during development. Keep the project you want to review running separately.

If the hub is already running, use that instance. Stop it with Ctrl+C before starting another. After changing queue/job PHP code, restart `hub:start` so the worker loads your change.

For normal use without Vite running:

```sh
npm run build
php artisan hub:start
```

Stop Vite with Ctrl+C. If it crashes and Laravel tries to load an unavailable Vite server, remove the stale `public/hot` file and build again.

## Where to edit

| File | What you change here |
| --- | --- |
| `resources/js/app.tsx` | React entry, shared layout, projects dashboard |
| `resources/js/forms.tsx` | Project, environment, and session forms |
| `resources/js/Comparison.tsx` | Before/after images, state/version selectors, overlay, history |
| `resources/js/types.ts` | TypeScript shapes for the Laravel page data |
| `resources/css/hub.css` | Styling and responsive layout |
| `routes/web.php` | Laravel URLs |
| `app/Http/Controllers/Controller.php` | Shared server-to-React page payload |
| `app/Http/Controllers/SessionController.php` | Frozen settings, selected captures, content differences |
| `app/Http/Requests/` | Form validation |
| `app/Services/CaptureService.php` | Capture ordering and queue dispatch |
| `app/Jobs/CaptureEnvironment.php` | Worker job; imports runner results into the database |
| `app/Services/BrowserRunner.php` | Starts local Node or Docker browser runner |
| `runner/engine.mjs` | Playwright capture logic and simulated auth states |

All screen markup is React. `resources/views/hub/app.blade.php` is only the HTML mount point and safely encoded initial JSON payload; you do not need Blade to build the UI.

This is a React frontend served by Laravel, using normal page navigation and forms. It is not a separate REST API or client-side router. GET controllers pass typed page props to React. POST forms include Laravel's CSRF token and use existing validation/redirects. Invalid input comes back as `errors` and `old` values. React owns the interactive overlay and form state. Captures in progress trigger a page refresh every 2.5 seconds.

## First small exercise

Change the dashboard heading in `app.tsx` and a color in `hub.css`. With `npm run dev` running, you should see them update at port 4320. Then try adding a clearer auth-state label in the View selector in `Comparison.tsx`; preserve each option's existing value (`desktop-guest`, etc.).

## Before/after workflow

1. Create a session and capture before, before editing your target project.
2. Make your change in that project's editor.
3. Capture after. Each after run is a new version.
4. Select the same desktop/mobile and visitor state for both sides using View.
5. Use Overlay and content differences to review the result.

The saved personal-site session is `/sessions/1`. Its guest/pending/approved states are simulated API responses, not live Google accounts. The mobile Portfolio button is inside a drawer; page-load screenshots will not show an opened drawer. The navigation E2E test covers the actual interaction.

## Playwright suites inside a comparison

Open your comparison and scroll to **Playwright suite comparisons** → **Add a Playwright suite**.

- **Suite name:** Portfolio navigation
- **Suite config path:** `frontend/playwright.config.ts` (relative to the connected repository)
- **Test title filter:** `Portfolio` (optional Playwright regex; leave blank for the whole suite)

Click **Run suite before**, edit the feature, then **Run suite after**. Each suite has its own baseline and after versions, independent of the page captures above it. Adding a suite today cannot reconstruct screenshots from yesterday's code. Add another suite to start a new baseline or use a different filter/config.

Tests run against the **current working tree**, not a checkout of an older capture. Keep source stable while running. Source fingerprints and timestamps are retained with each suite run. A completed before run locks even if assertions failed, so you can compare a failing before state to a fixed after state. Startup/config/no-tests/source-change errors remain retryable. Assertions, skips, flaky results, retry errors, and trace attachments remain visible.

The runner uses the project's installed `@playwright/test`, starts in the config directory, overrides the reporter/output directory, and runs one worker with a three-minute suite timeout. Configured browser projects, auth mocks, and web-server settings apply. The suite does not inherit the page capture's simulated auth or origin blocking. Suites currently run locally; Docker page capture mode does not move tests into Docker. Config and test code may start the app server just as a normal Playwright run does. `HUB_BASE_URL` is available if your config wants to attach to the registered environment; existing configs are not rewritten.

### Full interaction videos

Set `use: { video: 'on' }` in the project's Playwright config (enabled for the personal site). Playwright records each test's browser pages, including clicks, menus, and navigation. The hub imports WebM attachments up to 100 MB and shows **Interaction videos** above suite screenshots.

Select a test/browser recording, play or scrub either side, or use **Play both from start** and **Pause both**. Choose 0.25× or 0.5× to inspect fast interactions. The recordings start at the same elapsed time; actions are not automatically aligned. Multiple-page videos pair by attachment name/occurrence, so maintain consistent page creation order.

Existing screenshot-only runs stay unchanged. To get before video, add a new suite and record its baseline on today's code. The final retry's videos are retained, alongside its screenshots and traces. Native player controls support seeking and fullscreen. Custom browser contexts must configure video recording and close before the test ends.

Reference: [Playwright videos](https://playwright.dev/docs/videos). UI code: `resources/js/SuiteVideos.tsx`.

### Named component/step screenshots

Attach screenshots using Playwright's `testInfo.attach`. The hub supports PNG screenshots, ZIP traces, and plain-text attachments up to 30 MB each. Files must come from the run's output tree, or be attached as an in-memory body. Only the final retry's attachments are compared; all attempt outcomes/errors are retained.

```ts
import { test, expect } from '@playwright/test'

test('opens feature', async ({ page }, testInfo) => {
  await page.goto('/my-feature')
  await page.getByRole('button', { name: 'Open feature' }).click()
  const component = page.getByRole('dialog')
  await expect(component).toBeVisible()
  await testInfo.attach('feature-open', {
    body: await component.screenshot(),
    contentType: 'image/png',
  })
})
```

For a whole page use `page.screenshot({ fullPage: true })`. Attach multiple names for multiple flow steps. Attach a screenshot before the assertion if you want it preserved when that assertion fails.

Images pair by spec path, suite/test title, Playwright project name, attachment name, and duplicate-name occurrence. Keep those names stable across changes. New or removed tests/screenshots appear only on their available side. The screenshot selector and suite overlay let you inspect each pair. Your existing Portfolio test now attaches `portfolio-navigation` and `portfolio-home`.

Relevant code:

| File | Responsibility |
| --- | --- |
| `resources/js/SuiteComparisons.tsx` | Add suite, run controls, paired screenshots, results and history |
| `app/Http/Controllers/TestSuiteController.php` | Config validation, queueing, artifact serving |
| `app/Jobs/RunTestSuite.php` | Executes jobs with the shared browser lock |
| `app/Services/SuiteRunner.php` | Starts the Node runner |
| `runner/suite.mjs` | Runs project Playwright and records source identity |
| `runner/suite-report.mjs` | Imports nested test results and copies bounded attachments |
| `app/Models/TestSuite.php`, `SuiteRun.php` | Suite definitions and versioned runs |

Suite evidence lives under `storage/app/private/suites`. Back this up alongside page captures and SQLite. This app does not generate test code or automatically judge visual differences.

Playwright reference: [testInfo.attach](https://playwright.dev/docs/api/class-testinfo#test-info-attach).

## Checks and persistence

```sh
node --test tests/Runner/*.test.mjs
npm run typecheck
npm run build
php artisan test --compact
npm run test:browser
# Optional: installed Docker image and working Docker daemon required
HUB_DOCKER_TEST=1 npm run test:browser
```

Build before browser tests; they exercise the compiled React UI. Browser tests create their own database and target fixture. They do not reset your workspace database.

Your real data lives in `database/database.sqlite` and `storage/app/private/captures`. Stop the hub before copying these for a backup. Do not run `migrate:fresh` against your real database. Dependencies, secrets, compiled assets, test fixtures, and evidence are ignored by Git.
