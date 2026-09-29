# Change Hub

A local Laravel application for capturing and comparing the before and after states of an existing web project. React and TypeScript render the dashboard, bundled by Vite. SQLite stores projects, environments, sessions, and queued jobs. Playwright runs in a local process or in a browser container on an existing Docker network.

## Clone and run on your device

Requirements:

- Linux, macOS, or Windows through WSL2. Native Windows is not currently supported by the process/signal runner. This extraction was verified on Linux; macOS and WSL2 still need platform testing.
- PHP 8.4+ with SQLite (`pdo_sqlite`), `pcntl`, and the extensions checked by Composer; Composer 2.
- Node.js 24+ and npm; Git.
- Internet access for the first dependency and Chromium download.
- Docker is optional, only for Docker browser mode.

```sh
git clone https://github.com/Denys-Schmitz-Dev/change-hub.git
cd change-hub
composer run setup
php artisan hub:start
```

Open **http://127.0.0.1:4320**. Stop the dashboard and worker with Ctrl+C. If that port is in use, start with `php artisan hub:start --port=4322` instead.

Setup installs dependencies and Chromium, creates your private `.env` and application key, initializes SQLite, runs migrations, and builds the UI. It does not require the personal website, an account, or an API key. On Linux, if Chromium reports missing system libraries, run `npx playwright install --with-deps chromium` (system package installation may require administrator access).

Then start the project you want to review, connect its local Git repository (with at least one commit), and add its running URL as an environment. See **Connect your project** below.

For development with hot reload, use `php artisan hub:start --frontend`; see [DEVELOPMENT.md](DEVELOPMENT.md) for the code map. The `./hub-run` Bash helper starts this same development mode on Linux.

This is an independent Git repository. It has its own `.env`, `database/database.sqlite`, dependencies, and private artifact storage. Do not commit `.env`, SQLite files, dependencies, or capture artifacts. Your sessions remain on your device.

## Updating an installation

Stop `hub-run`, back up `database/database.sqlite` and `storage/app/private`, and commit or stash your local source edits before updating. From this repository:

```sh
git pull --ff-only
composer install --no-interaction
npm ci
php artisan migrate --force
npm run build
npx playwright install chromium
php artisan hub:start
```

Do not rerun `composer run setup` for updates: it generates a new application key. Keep the existing `.env` and application key.

Develop and push Hub changes in this repository. Publish GitHub releases with user-facing notes when an update is ready. The personal website links to this repository and its releases page; new releases appear there without a website redeploy. The portfolio screenshot and description are maintained separately in the personal-site repository.

## Connect your project

1. Start the target application as you normally do.
2. **Connect a project** using its absolute local Git repository path.
3. Add an environment with the origin reachable by the browser runner, such as `http://127.0.0.1:5175`.
4. Optionally enter a ready selector and additional API/asset origins.
5. Create a session with a page path and viewport selection.
6. **Capture before**, make your change, then **Capture after**.

Successful baselines are locked. After captures are versioned. Failures remain visible and can be retried. The repository, environment URL, adapter, origins, and viewport settings are frozen per session. A source fingerprint detects changes during a capture.

The hub does not create worktrees, check out branches, start or rebuild the target app, migrate its database, deploy it, or implement features. You can attach Playwright suites to a comparison and run their tests locally; their own configuration may start a target server.

## Local and Docker browsers

**Local** uses the hub's installed Playwright package and Chromium. An application already running in Docker can be reached through a published host port without another browser container.

**Docker** starts only a short-lived Playwright container, joins the selected existing network, mounts the project read-only for Git metadata, and saves evidence to the hub. Use service URLs such as `http://web:80`; `localhost` in this mode refers to the browser container. The network and application services must already exist.

Prepare the shared image once:

```sh
docker pull mcr.microsoft.com/playwright:v1.63.0-noble
```

`HUB_DOCKER_IMAGE` can override the image, but its browser version must match the exact Playwright dependency. The image is reused across projects. The runner code and Node dependencies are mounted read-only from this app; no per-project dependency installation is performed. Docker is controlled by the local worker, and the dashboard is not intended for public hosting.

## Capture profiles and evidence

- **Real page state** opens the configured page in a fresh browser context. Existing browser logins are not inherited.
- **Personal site / simulated résumé access** supplies guest, pending, approved, denied, or unavailable user-status responses. This does not verify live OAuth or backend authorization.

Each view records a full-page screenshot, visible headings/controls/links/text, accessibility snapshot, console/network summaries, and a Playwright trace. Network summaries omit query strings, request bodies, headers, and cookies; trace archives contain richer browser evidence. External origins are blocked unless explicitly allowed. Capture navigation can trigger the target page's normal side effects.

Side-by-side and overlay comparisons show the same configured view. Visible-content changes use set comparisons; categories can overlap. Screenshot hashes indicate file equality, not pixel-difference percentages or test results. Keep test data reproducible and do not edit source during a capture. The hub serializes its own jobs but cannot lock out external editors.

Artifacts are served from private capture storage through Laravel. The DB and artifacts persist across restarts. On restart, interrupted running jobs are marked failed so they can be retried. Run one `hub:start` per storage directory; do not separately start additional workers against it.

## Tests

```sh
npm run build
php artisan test --compact
npm run test:browser
# Include the Docker integration check (requires the image above):
HUB_DOCKER_TEST=1 npm run test:browser
```

The browser test creates an isolated Laravel DB/storage and a tiny existing target application in a temporary Git repository. It verifies project registration, real captures, changed content, baseline preservation, after versions, overlays, reload persistence, and mobile layout. It does not modify the personal website.

## Suite screenshots and test results

Open a comparison → **Add a Playwright suite**. Choose a repository-relative config and optional test-title regex. Run suite before, edit your feature, then run suite after. Each suite retains its own locked baseline, after versions, assertions, and named PNG attachments for side-by-side/overlay review. See [DEVELOPMENT.md](DEVELOPMENT.md#playwright-suites-inside-a-comparison) for a component screenshot example and execution details. Suites run locally using the project’s installed Playwright, with one worker and a three-minute timeout.

## Prior prototype

The old prototype's evidence is left in its original directory in the personal-site workspace. This app does not yet import legacy JSON sessions. Creating a new session captures the currently running app, not an earlier Git revision. Automated E2E generation, agent execution, Git/worktree management, and deployment are later milestones.
