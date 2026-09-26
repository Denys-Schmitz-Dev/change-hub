import { recordedAction } from './support/recorded-actions.js';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const file = 'a'.repeat(64) + '.webm';
const example = (key, title, files) => ({ key, title, file: 'component.spec.ts', project: 'desktop', coveredFiles: files, outcome: 'expected', expectedStatus: 'passed', duration: 400, attempts: [{ status: 'passed', retry: 0, duration: 400, errors: [] }], attachments: [{ key: `${key}-video`, file, name: 'video', contentType: 'video/webm' }] });
function payload(afterTest) {
 const before = { id: 71, test_suite_id: 1, config: 'playwright.config.js', artifact_base: '/sessions/9300/baseline-artifacts/71/__FILE__', phase: 'before', status: 'complete', capture_video: true, created_at: '2026-09-26T00:00:00Z', report: { outcome: 'passed', tests: [example('home', 'Original component check', ['src/Home.tsx'])], contracts: { version: 1, warnings: [], categories: { ui: [{ file: 'src/Other.tsx' }] } } } };
 const after = { ...before, id: 72, artifact_base: undefined, phase: 'after', report: { outcome: 'passed', tests: [afterTest ?? example('home', 'Selected component check', ['src/Home.tsx'])] } };
 return { page: 'session', csrf: 'test', old: {}, errors: [], props: { active: false, session: { id: 9300, title: 'Shared video baseline', baseline: { suite_ids: [1], runs: [before] }, environment: { name: 'Local', project: { id: 1, name: 'Fixture' } }, suites: [{ id: 2, name: 'Later suite', config: 'playwright.config.js', selected_tests: null, runs: [after] }] } } };
}
async function render(page, data, video) {
 const asset = JSON.parse(readFileSync('public/build/manifest.json', 'utf8'))['resources/js/app.tsx'];
 await page.route('**/*.webm', route => route.fulfill({ path: video, contentType: 'video/webm' }));
 await page.route('**/sessions/9300?tab=videos', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${asset.css.map(file => `<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${asset.file}"></script></head><body><div id="root"></div><script id="hub-data" type="application/json">${JSON.stringify(data)}</script></body></html>` }));
 await page.goto('/sessions/9300?tab=videos');
}
async function videoFixture(browser, info) {
 const context = await browser.newContext({ recordVideo: { dir: info.outputPath('media'), size: { width: 640, height: 480 } } });
 const page = await context.newPage(); await page.setContent('<h1>Component recording</h1><button>Continue</button>'); await page.waitForTimeout(1000); const video = page.video(); await context.close(); return video.path();
}

test('video cleanup: one toolbar, maximized single views and fullscreen playback', async ({ page, browser }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/SuiteVideos.tsx' }, { type: 'covers', description: 'change-hub/resources/js/FullscreenComparison.tsx' }, { type: 'covers', description: 'change-hub/resources/css/hub.css' });
 const data = payload();
 const original = data.props.session.baseline.runs[0];
 data.props.session.baseline.runs.unshift({ ...original, id: 70, config: 'another.config.js', artifact_base: '/sessions/9300/baseline-artifacts/70/__FILE__' });
 await render(page, data, await videoFixture(browser, info));
 const viewer = page.locator('.fullscreen-comparison'); const toolbar = viewer.locator('.fullscreen-comparison-toolbar'); const stage = viewer.locator('.viewer-videos');
 await expect(page.getByRole('heading', { name: 'Selected component check', exact: true })).toHaveCount(0);
 await expect(toolbar.getByRole('button', { name: 'Play both', exact: true })).toBeVisible();
 const before = viewer.getByLabel('Before interaction video', { exact: true }); const after = viewer.getByLabel('After interaction video', { exact: true });
 await expect(before).toHaveAttribute('src', '/sessions/9300/baseline-artifacts/71/' + file);
 await expect.poll(() => before.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
 await recordedAction(page, toolbar.getByRole('button', { name: 'Play both', exact: true }), 'click');
 await expect.poll(() => after.evaluate(video => video.currentTime)).toBeGreaterThan(0);
 await recordedAction(page, toolbar.getByRole('button', { name: 'Pause', exact: true }), 'click');
 const select = toolbar.getByRole('combobox', { name: 'Video view' });
 await recordedAction(page, select, 'selectOption', 'before'); await expect(before).toBeVisible(); await expect(after).toBeHidden();
 expect((await before.boundingBox()).width / (await stage.boundingBox()).width).toBeGreaterThan(0.95);
 await recordedAction(page, toolbar.getByRole('button', { name: 'Play in fullscreen', exact: true }), 'click');
 await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
 await expect(after).toBeHidden(); await expect.poll(() => before.evaluate(video => video.currentTime)).toBeGreaterThan(0);
 await info.attach('fullscreen-before', { body: await page.screenshot(), contentType: 'image/png' });
 await recordedAction(page, toolbar.getByRole('button', { name: 'Exit fullscreen', exact: true }), 'click');
 await expect(toolbar.getByRole('button', { name: 'Play in fullscreen', exact: true })).toBeFocused();
 await recordedAction(page, select, 'selectOption', 'after'); await expect(before).toBeHidden(); await expect(after).toBeVisible();
 expect((await after.boundingBox()).width / (await stage.boundingBox()).width).toBeGreaterThan(0.95);
 await info.attach('maximized-after', { body: await page.screenshot(), contentType: 'image/png' });
 await recordedAction(page, toolbar.getByRole('button', { name: 'Play both', exact: true }), 'click'); await expect(select).toHaveValue('both'); await expect(before).toBeVisible(); await expect(after).toBeVisible();
 await page.setViewportSize({ width: 390, height: 844 });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
 await recordedAction(page, select, 'selectOption', 'before'); expect((await before.boundingBox()).width / (await stage.boundingBox()).width).toBeGreaterThan(0.95);
 await info.attach('mobile-before', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('video cleanup: new tests reuse existing component or default session baseline references', async ({ page, browser }, info) => {
 info.annotations.push({ type: 'covers', description: 'change-hub/resources/js/SuiteVideos.tsx' }, { type: 'covers', description: 'change-hub/resources/js/SuiteComparisons.tsx' });
 const video = await videoFixture(browser, info);
 const data = payload(example('new-home', 'New test for existing component', ['src/Home.tsx']));
 await render(page, data, video);
 await expect(page.locator('.video-pair')).toContainText('Component baseline');
 await expect(page.getByLabel('Before interaction video', { exact: true })).toHaveAttribute('src', '/sessions/9300/baseline-artifacts/71/' + file);
 await expect(page.getByRole('group', { name: 'Recordings' }).getByRole('button')).toHaveCount(1);
 data.props.session.suites[0].runs[0].report.tests = [example('other', 'New test for another existing component', ['src/Other.tsx'])];
 await page.reload(); await expect(page.locator('.video-pair')).toContainText('Session baseline reference');
 data.props.session.suites[0].runs[0].report.tests = [example('brand-new', 'New component', ['src/New.tsx'])];
 await page.reload(); await expect(page.getByLabel('Before interaction video', { exact: true })).toHaveCount(0);
 await recordedAction(page, page.getByRole('combobox', { name: 'Video view' }), 'selectOption', 'before');
 await expect(page.getByText('No before recording.', { exact: true })).toBeVisible();
 await expect(page.getByRole('button', { name: 'Play in fullscreen', exact: true })).toBeDisabled();
 await expect(page.getByRole('button', { name: 'Play both', exact: true })).toBeDisabled();
});
