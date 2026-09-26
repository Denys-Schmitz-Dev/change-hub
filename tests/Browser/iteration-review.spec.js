import { recordedAction } from './support/recorded-actions.js';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function renderReview(page, payload, path = '/iteration-fixture') {
    const asset = JSON.parse(readFileSync('public/build/manifest.json', 'utf8'))['resources/js/app.tsx'];
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${(asset.css ?? []).map(file => `<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${asset.file}"></script></head><body><div id="root"></div><script id="hub-data" type="application/json">${JSON.stringify(payload)}</script></body></html>`;
    await page.route(`**${path}*`, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
    await page.goto(path);
}

function reviewPayload() {
    const testCase = (title) => ({ key: 'checkout', title, file: 'checkout.spec.ts', project: 'desktop', outcome: 'expected', expectedStatus: 'passed', duration: 120, attempts: [{ status: 'passed', retry: 0, duration: 120, errors: [] }], attachments: [] });
    const run = (id, phase, title) => ({ id, phase, status: 'complete', created_at: '2026-09-26T00:00:00Z', capture_video: true, report: { outcome: 'passed', tests: [testCase(title)] } });
    return { page: 'session', csrf: 'fixture', old: {}, errors: [], props: { active: false, session: {
        id: 9000, title: 'Change Hub review', environment: { name: 'Local development', project: { id: 2, name: 'Change Hub', playwright_config: 'playwright.config.js' } },
        suites: [{ id: 9000, name: 'Checkout workflow', config: 'playwright.config.js', selected_tests: null, runs: [run(1, 'before', 'Original checkout'), run(2, 'after', 'First checkout revision'), run(3, 'after', 'Latest checkout revision')] }],
    } } };
}

test('iteration 01: browser history follows session review tabs', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'covers', description: 'change-hub/resources/js/Comparison.tsx' }, { type: 'covers', description: 'change-hub/resources/js/app.tsx' });
    await page.goto('/');
    await renderReview(page, reviewPayload());
    await recordedAction(page, page.getByRole('tab', { name: 'Videos', exact: true }), 'click');
    await recordedAction(page, page.getByRole('tab', { name: 'Dev details', exact: true }), 'click');
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Videos', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
    await expect(page).toHaveURL(/tab=videos/);
    await page.goBack();
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.goForward();
    await expect(page.getByRole('tab', { name: 'Videos', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Videos', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('iteration 02: search stays within the selected project sessions', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'covers', description: 'change-hub/resources/js/app.tsx' });
    const project = { id: 2, name: 'Change Hub', repository_path: '/workspace/change-hub', environments: [] };
    const other = { ...project, id: 3, name: 'Portfolio' };
    const session = (id, title, environment, owner = project) => ({ id, title, environment: { name: environment, project: owner }, profile: { path: '/' }, runs: [] });
    const payload = { page: 'home', csrf: 'fixture', old: {}, errors: [], props: { projects: [project, other], sessions: [session(11, 'Fullscreen comparison', 'Desktop'), session(10, 'Session navigation', 'Mobile'), session(9, 'Suite editing', 'Desktop'), session(8, 'Fullscreen portfolio', 'Desktop', other)] } };
    await renderReview(page, payload, '/iteration-search-fixture');
    await page.goto('/iteration-search-fixture?view=projects&project=2');
    await expect(page.locator('.session-row')).toHaveCount(3);
    const search = page.getByRole('searchbox', { name: 'Find a change session', exact: true });
    await expect(search).toBeVisible({ timeout: 3000 });
    await recordedAction(page, search, 'fill', 'fullscreen');
    await expect(page.locator('.session-row')).toHaveCount(1);
    await expect(page.locator('.session-row')).toContainText('Fullscreen comparison');
    await recordedAction(page, search, 'fill', 'mobile');
    await expect(page.locator('.session-row')).toHaveCount(1);
    await expect(page.locator('.session-row')).toContainText('Session navigation');
    await recordedAction(page, search, 'fill', 'missing session');
    await expect(page.getByText('No change sessions match your search.', { exact: true })).toBeVisible();
    await expect(page.locator('.session-row')).toHaveCount(0);
    await recordedAction(page, page.getByRole('button', { name: 'Clear session search', exact: true }), 'click');
    await expect(search).toHaveValue('');
    await expect(page.locator('.session-row')).toHaveCount(3);
    await expect(page.getByRole('status')).toContainText('3 of 3 sessions');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('iteration 03: preserve the reviewed capture version across reloads', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'covers', description: 'change-hub/resources/js/SuiteComparisons.tsx' });
    const payload = reviewPayload();
    const original = payload.props.session.suites[0];
    payload.props.session.suites.push({ ...original, id: 9001, name: 'Account workflow' });
    await renderReview(page, payload);
    await recordedAction(page, page.getByRole('combobox', { name: 'Test suite', exact: true }), 'selectOption', '9000');
    await recordedAction(page, page.getByRole('tab', { name: 'Dev details', exact: true }), 'click');
    const version = page.getByRole('combobox', { name: 'Review after version', exact: true });
    await recordedAction(page, version, 'selectOption', '2');
    const output = page.getByLabel('Selected test output');
    await expect(output).toContainText('First checkout revision');
    await page.reload();
    await expect(version).toHaveValue('2', { timeout: 3000 });
    await expect(output).toContainText('First checkout revision');
    await recordedAction(page, page.getByRole('combobox', { name: 'Review suite', exact: true }), 'selectOption', '9001');
    await expect(output).toContainText('Latest checkout revision');
    await recordedAction(page, page.getByRole('combobox', { name: 'Review suite', exact: true }), 'selectOption', '9000');
    await expect(version).toHaveValue('2');
    await expect(output).toContainText('First checkout revision');
    await recordedAction(page, version, 'selectOption', { label: 'Latest after run' });
    await expect(output).toContainText('Latest checkout revision');
    await page.reload();
    await expect(version).toHaveValue('');
    await expect(output).toContainText('Latest checkout revision');
});

test('critic pass 1: test search never shows evidence outside its results', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'covers', description: 'change-hub/resources/js/TestExplorer.tsx' });
    const payload = reviewPayload();
    const report = payload.props.session.suites[0].runs[2].report;
    const original = report.tests[0];
    report.tests = [
        { ...original, key: 'checkout', title: 'Checkout confirmation', attachments: [{ key: 'checkout-trace', name: 'Checkout trace', file: 'a'.repeat(64) + '.zip', contentType: 'application/zip' }] },
        { ...original, key: 'account', title: 'Account profile', attachments: [{ key: 'account-trace', name: 'Account trace', file: 'b'.repeat(64) + '.zip', contentType: 'application/zip' }] },
    ];
    await renderReview(page, payload);
    await recordedAction(page, page.getByRole('tab', { name: 'Dev details', exact: true }), 'click');
    const explorer = page.getByRole('region', { name: 'Test explorer', exact: true });
    const search = explorer.getByRole('searchbox', { name: 'Find a test', exact: true });
    await recordedAction(page, search, 'fill', 'account');
    await expect.soft(explorer.getByLabel('Selected test output')).toContainText('Account profile', { timeout: 3000 });
    await expect.soft(explorer.getByRole('link', { name: 'Account trace', exact: true })).toBeVisible({ timeout: 3000 });
    await recordedAction(page, search, 'fill', 'no-match');
    await expect.soft(explorer.getByLabel('Selected test output')).toContainText('No tests match this search.', { timeout: 3000 });
    await expect.soft(explorer.getByRole('link', { name: 'Checkout trace', exact: true })).toHaveCount(0, { timeout: 3000 });
    await expect(explorer.getByRole('link', { name: 'Account trace', exact: true })).toHaveCount(0);
    await recordedAction(page, search, 'fill', '');
    await expect(explorer.getByRole('group', { name: 'Tests', exact: true }).getByRole('button')).toHaveCount(2);
    await expect(explorer.getByLabel('Selected test output')).toContainText('Checkout confirmation');
});

test('critic pass 1: assertion output is readable without terminal control codes', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'covers', description: 'change-hub/resources/js/TestExplorer.tsx' }, { type: 'covers', description: 'change-hub/resources/js/TestResults.tsx' });
    const payload = reviewPayload();
    const run = payload.props.session.suites[0].runs[2];
    const diagnostic = '\u001b[31mExpected confirmation\u001b[39m\n\u001b[2mCall log:\u001b[22m\ncheckout.spec.ts:12\n\u001b]8;;https://example.invalid\u0007Source link\u001b]8;;\u0007';
    run.report.outcome = 'failed';
    run.report.errors = ['\u001b[33mRunner warning\u001b[0m'];
    run.report.tests[0].outcome = 'unexpected';
    run.report.tests[0].attempts = [{ status: 'failed', retry: 0, duration: 100, errors: [diagnostic] }];
    await renderReview(page, payload);
    const failures = page.getByRole('region', { name: 'Failure output', exact: true });
    await expect.soft(failures).not.toContainText('\u001b', { timeout: 3000 });
    await expect(failures).toContainText('Expected confirmation');
    await expect(failures).toContainText('Call log:');
    await expect(failures).toContainText('checkout.spec.ts:12');
    await expect(failures).toContainText('Source link');
    await recordedAction(page, page.getByRole('tab', { name: 'Dev details', exact: true }), 'click');
    const output = page.getByLabel('Selected test output');
    await expect.soft(output).not.toContainText('\u001b', { timeout: 3000 });
    await expect(output).toContainText('Expected confirmation');
    await expect(output).toContainText('checkout.spec.ts:12');
    await expect.soft(page.locator('.explorer-run-error')).not.toContainText('\u001b', { timeout: 3000 });
});

test('critic pass 1: a capture has one identity across all review tabs', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'covers', description: 'change-hub/resources/js/SuiteComparisons.tsx' });
    await renderReview(page, reviewPayload());
    const overviewVersion = page.getByRole('combobox', { name: 'After version for Checkout workflow', exact: true });
    await recordedAction(page, overviewVersion, 'selectOption', '2');
    const selected = overviewVersion.locator('option:checked');
    await expect.soft(selected).toHaveText(/^#2 · /, { timeout: 3000 });
    const label = await selected.textContent();
    for (const tab of ['Videos', 'Dev details']) {
        await recordedAction(page, page.getByRole('tab', { name: tab, exact: true }), 'click');
        await expect.soft(page.getByRole('combobox', { name: 'Review after version', exact: true }).locator('option:checked')).toHaveText(label, { timeout: 3000 });
    }
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Review after version', exact: true })).toHaveValue('2');
});
