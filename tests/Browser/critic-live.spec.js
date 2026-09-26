import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

function payload(active = false) {
 const testCase = { key: 'flow', title: 'Checkout confirmation', file: 'checkout.spec.ts', project: 'desktop', outcome: 'expected', expectedStatus: 'passed', duration: 20, attempts: [{ status: 'passed', retry: 0, duration: 20, errors: [] }], attachments: [] };
 return { page: 'session', csrf: 'fixture', old: {}, errors: [], props: { active, session: { id: 9100, title: 'Critic interaction review', environment: { name: 'Local', project: { id: 2, name: 'Change Hub', playwright_config: 'playwright.config.js' } }, suites: [{ id: 9100, name: 'Review workflow', config: 'playwright.config.js', selected_tests: null, test_catalog: [], runs: [{ id: 1, phase: 'before', status: 'complete', created_at: '2026-09-26T00:00:00Z', report: { outcome: 'passed', tests: [testCase] } }] }] } } };
}
function html(data) {
 const asset = JSON.parse(readFileSync('public/build/manifest.json', 'utf8'))['resources/js/app.tsx'];
 return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${asset.css.map(file => `<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${asset.file}"></script></head><body><div id="root"></div><script id="hub-data" type="application/json">${JSON.stringify(data)}</script></body></html>`;
}
async function fixture(page, data) {
 await page.route('**/sessions/9100*', route => route.fulfill({ contentType: 'text/html', body: html(data) }));
 await page.goto('/sessions/9100');
}

test('critic cycle 1: active runs update without losing review state or reloading', async ({ page }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/app.tsx' }, { type: 'covers', description: 'change-hub/resources/js/Comparison.tsx' });
 await info.attach('critic-review', { body: Buffer.from('Independent live UI review. Initial: Design 7.7, Ease 6.8, Functionality 7.7; average 7.4. Cycle 1: Design 8.4, Ease 8.7, Functionality 8.4; average 8.5. Verified async refresh, error recovery, retained expanded settings, collapsed failure output, code-review shortcuts, suite status badges, and 390px layout. Remaining: dense suite settings, mobile path wrapping, no human approval workflow. E2E fixtures exercise UI states; existing suite integration checks exercise actual Laravel actions.'), contentType: 'text/plain' });
 const data = payload(true); let documents = 0; let updates = 0;
 page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
 await page.route('**/sessions/9100*', async route => {
  if (!route.request().isNavigationRequest()) { updates++; data.props.active = false; }
  await route.fulfill({ contentType: 'text/html', body: html(data) });
 });
 await page.goto('/sessions/9100?tab=dev');
 const search = page.getByRole('searchbox', { name: 'Find a test' });
 await search.fill('checkout');
 await expect.poll(() => updates, { timeout: 8000 }).toBeGreaterThan(0);
 await expect(page.locator('[data-refresh]')).toHaveCount(0);
 await expect(search).toHaveValue('checkout');
 expect(documents).toBe(1);
 await info.attach('in-place-run-update', { body: await page.screenshot(), contentType: 'image/png' });
});

test('critic cycle 1: refreshing tests shows progress and preserves expanded settings', async ({ page }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/forms.tsx' }, { type: 'covers', description: 'change-hub/resources/js/VideoTestSelection.tsx' });
 const data = payload(); await fixture(page, data);
 let release; const pending = new Promise(resolve => { release = resolve; });
 await page.route('**/suites/9100/tests', async route => { await pending; data.props.session.suites[0].test_catalog = [{ key: 'new', title: 'New discovered test', file: 'new.spec.ts', project: 'desktop' }]; await route.fulfill({ contentType: 'text/html', body: html(data) }); });
 await page.getByRole('button', { name: '▸ Review workflow', exact: true }).click();
 const button = page.getByRole('button', { name: 'Refresh test list', exact: true });
 await button.click();
 try { await expect(button).toBeDisabled({ timeout: 3000 }); await expect(page.getByRole('status').filter({ hasText: /Refreshing/ })).toBeVisible({ timeout: 3000 }); }
 finally { release(); }
 await expect(page.getByRole('button', { name: '▸ new.spec.ts', exact: true })).toBeVisible();
 await expect(button).toBeEnabled();
 await expect(page.getByRole('button', { name: '▾ Review workflow', exact: true })).toHaveAttribute('aria-expanded', 'true');
 await info.attach('test-discovery-result', { body: await page.screenshot(), contentType: 'image/png' });
});

test('critic cycle 1: failed actions retain context and can be retried', async ({ page }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/forms.tsx' });
 const data = payload(); await fixture(page, data); let calls = 0;
 await page.route('**/suites/9100/tests', route => ++calls === 1 ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.fulfill({ contentType: 'text/html', body: html(data) }));
 await page.getByRole('button', { name: '▸ Review workflow', exact: true }).click();
 const button = page.getByRole('button', { name: 'Refresh test list', exact: true }); await button.click();
 await expect(page.getByRole('alert')).toContainText('try again', { timeout: 3000 });
 await expect(button).toBeEnabled(); await button.click();
 await expect(page.getByRole('alert')).toHaveCount(0); expect(calls).toBe(2);
});

test('critic cycle 1: overview review and failure details are discoverable on mobile', async ({ page }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/SuiteComparisons.tsx' }, { type: 'covers', description: 'change-hub/resources/js/TestResults.tsx' }, { type: 'covers', description: 'change-hub/resources/js/DevDetails.tsx' });
 const data = payload(); const testCase = data.props.session.suites[0].runs[0].report.tests[0];
 testCase.outcome = 'unexpected'; testCase.attempts[0] = { status: 'failed', retry: 0, duration: 4935, errors: ['Expected confirmation\n' + 'Long diagnostic output\n'.repeat(25)] };
 await fixture(page, data); await page.setViewportSize({ width: 390, height: 844 });
 const failure = page.getByRole('region', { name: 'Failure output' }).locator('details');
 await expect(failure).not.toHaveAttribute('open'); await failure.locator('summary').click();
 await expect(failure.locator('pre')).toBeVisible(); await failure.locator('summary').click();
 await expect(page.getByRole('link', { name: 'Return to capture controls' })).toBeVisible();
 await expect(page.getByRole('region', { name: 'Change review' })).toContainText('Missing or incomplete runs cannot establish verification');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await info.attach('mobile-code-review', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('critic cycle 1: live update errors preserve evidence and retry successfully', async ({ page }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/app.tsx' });
 const data = payload(true); let updates = 0;
 await page.route('**/sessions/9100*', route => {
  if (!route.request().isNavigationRequest() && ++updates === 1) return route.fulfill({ status: 503, body: 'Unavailable' });
  if (updates > 1) data.props.active = false;
  return route.fulfill({ contentType: 'text/html', body: html(data) });
 });
 await page.goto('/sessions/9100?tab=dev'); const search = page.getByRole('searchbox', { name: 'Find a test' }); await search.fill('checkout');
 await expect(page.getByRole('alert')).toContainText('Live updates paused');
 await page.getByRole('button', { name: 'Retry live updates' }).click();
 await expect(page.locator('[data-refresh]')).toHaveCount(0); await expect(search).toHaveValue('checkout');
 await expect(page.getByRole('alert')).toHaveCount(0);
});

test('critic cycle 1: session badges reflect suite baselines and completed after runs', async ({ page }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/app.tsx' }, { type: 'covers', description: 'change-hub/app/Http/Controllers/HubController.php' });
 const session = payload().props.session; const project = { ...session.environment.project, environments: [], repository_path: '/workspace' };
 const data = { page: 'home', csrf: 'fixture', old: {}, errors: [], props: { projects: [project], sessions: [{ ...session, runs: [], profile: { path: '/' } }] } };
 await page.route('**/?view=projects', route => route.fulfill({ contentType: 'text/html', body: html(data) }));
 await page.goto('/?view=projects'); await expect(page.locator('.session-row')).toContainText('Baseline captured');
 session.suites[0].runs.push({ ...session.suites[0].runs[0], id: 2, phase: 'after' }); await page.reload();
 await expect(page.locator('.session-row')).toContainText('Ready to review');
});
