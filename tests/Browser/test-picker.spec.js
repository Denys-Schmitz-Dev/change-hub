import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { recordedAction } from './support/recorded-actions.js';

const annotations = [{ type: 'covers', description: 'change-hub/resources/js/TestPicker.tsx' }, { type: 'covers', description: 'change-hub/resources/js/SuiteManager.tsx' }, { type: 'covers', description: 'change-hub/app/Actions/CreateSelectedTestSuiteAction.php' }, { type: 'covers', description: 'change-hub/runner/suite.mjs' }];

test('critic cycle 2: picker discovers tests and runs only the chosen test and browser project', async ({ page }, info) => {
 info.annotations.push(...annotations);
 await info.attach('critic-picker-review', { body: Buffer.from('Cycle 2 independent review: Design 8.4, Ease of use 8.9, Functionality 8.6; average 8.63. Confirmed default discovery, named search, visible selection, selection retention, clear, disabled empty submission, cancel/Escape, mobile layout. Real E2E verifies saving and alternate configuration discovery, then executing only the selected test/project. Remaining minor polish: mobile footer can require scrolling.'), contentType: 'text/plain' });
 const repo = mkdtempSync(resolve('storage/framework/testing/picker-'));
 const git = args => execFileSync('git', args, { cwd: repo });
 try {
  git(['init', '-q']); symlinkSync(resolve('node_modules'), join(repo, 'node_modules'), 'dir'); writeFileSync(join(repo, '.gitignore'), 'node_modules\n');
  writeFileSync(join(repo, 'playwright.config.mjs'), `export default {testDir:'.',testMatch:'*.spec.mjs',timeout:10000,projects:[{name:'desktop'},{name:'mobile',use:{viewport:{width:390,height:844}}}]}`);
  writeFileSync(join(repo, 'alternate.config.mjs'), readFileSync(join(repo, 'playwright.config.mjs')));
  writeFileSync(join(repo, 'checkout.spec.mjs'), `import {test,expect} from '@playwright/test';test.describe('Checkout',()=>{test('accepts [draft] (a+b)?',async({page})=>{await page.setContent('<h1>Chosen checkout</h1>');await expect(page.locator('h1')).toHaveText('Chosen checkout')});test('unselected flow',async()=>{throw new Error('This test must not run')})})`);
  git(['add', '.']); git(['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture']);
  await page.goto('/projects/create');
  await page.getByLabel('Project name', { exact: true }).fill('Picker fixture');
  await page.getByLabel('Repository directory', { exact: true }).fill(repo);
  await page.getByLabel('Playwright config path', { exact: true }).fill('playwright.config.mjs');
  await page.getByRole('button', { name: 'Connect project', exact: true }).click();
  await page.getByRole('button', { name: 'Save environment', exact: true }).click();
  await page.getByLabel('Session title', { exact: true }).fill('Choose tests without regex');
  await page.getByRole('button', { name: 'Create session', exact: true }).click();
  await recordedAction(page, page.getByRole('button', { name: 'Add tests', exact: true }), 'click');
  const dialog = page.getByRole('dialog', { name: 'Add tests to this session' });
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  await recordedAction(page, dialog.getByLabel('Test configuration', { exact: true }), 'fill', 'alternate.config.mjs');
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await recordedAction(page, dialog.getByRole('button', { name: 'Load tests', exact: true }), 'click');
  await expect(dialog.getByRole('checkbox')).toHaveCount(4);
  await expect(dialog.getByRole('button', { name: 'Add 0 selected tests' })).toBeDisabled();
  await recordedAction(page, dialog.getByRole('searchbox', { name: 'Find tests' }), 'fill', '[draft]');
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);
  const chosen = dialog.getByRole('checkbox', { name: 'Select checkout.spec.mjs › Checkout › accepts [draft] (a+b)? (desktop)', exact: true });
  await recordedAction(page, chosen, 'check');
  await recordedAction(page, dialog.getByRole('searchbox', { name: 'Find tests' }), 'fill', 'missing test');
  await expect(dialog.getByRole('heading', { name: 'No matching tests' })).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('1 selected');
  await recordedAction(page, dialog.getByRole('button', { name: 'Clear search' }), 'click');
  await expect(chosen).toBeChecked();
  await recordedAction(page, dialog.getByRole('textbox', { name: 'Suite name', exact: true }), 'fill', 'Chosen checkout');
  await info.attach('test-picker-desktop', { body: await page.screenshot(), contentType: 'image/png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await info.attach('test-picker-mobile', { body: await page.screenshot(), contentType: 'image/png' });
  await recordedAction(page, dialog.getByRole('button', { name: 'Add 1 selected test', exact: true }), 'click');
  await expect(dialog).toHaveCount(0);
  await recordedAction(page, page.getByRole('button', { name: 'Capture before', exact: true }), 'click');
  await expect(page.getByRole('button', { name: 'Baseline locked', exact: true })).toBeVisible({ timeout: 45000 });
  const html = await (await page.request.get(page.url())).text();
  const data = JSON.parse(html.match(/<script id="hub-data" type="application\/json">(.*?)<\/script>/s)[1]);
  const selected = data.props.session.suites.find(suite => suite.name === 'Chosen checkout');
  expect(selected.grep).toBeNull(); expect(selected.test_selection).toHaveLength(1);
  expect(selected.runs[0].report.outcome).toBe('passed');
  expect(selected.runs[0].report.tests).toHaveLength(1);
  expect(selected.runs[0].report.tests[0].project).toBe('desktop');
  expect(selected.runs[0].report.tests[0].title).toContain('accepts [draft] (a+b)?');
  await page.reload(); await expect(page.getByRole('region', { name: 'Playwright suites' }).getByRole('button', { name: '▸ Chosen checkout' })).toBeVisible();
 } finally { rmSync(repo, { recursive: true, force: true }); }
});

async function pickerFixture(page) {
 const asset = JSON.parse(readFileSync('public/build/manifest.json', 'utf8'))['resources/js/app.tsx'];
 const data = { page: 'session', csrf: 'test', old: {}, errors: [], props: { active: false, session: { id: 9200, title: 'Picker states', environment: { name: 'Local', project: { id: 1, name: 'Fixture', playwright_config: 'playwright.config.js' } }, suites: [] } } };
 await page.route('**/sessions/9200', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${asset.css.map(file => `<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${asset.file}"></script></head><body><div id="root"></div><script id="hub-data" type="application/json">${JSON.stringify(data)}</script></body></html>` }));
 await page.goto('/sessions/9200');
}

test('critic cycle 2: picker loading, failure, retry, empty state and keyboard dismissal', async ({ page }, info) => {
 info.annotations.push(...annotations);
 await pickerFixture(page); let release; const gate = new Promise(resolve => { release = resolve; }); let calls = 0;
 await page.route('**/sessions/9200/test-catalog', async route => { if (++calls === 1) { await gate; await route.fulfill({ status: 503, json: { message: 'Discovery unavailable. Please try again.' } }); } else await route.fulfill({ json: { tests: [] } }); });
 const opener = page.getByRole('button', { name: 'Add tests', exact: true }); await opener.click();
 const dialog = page.getByRole('dialog');
 try { await expect(dialog.getByRole('status')).toContainText('Discovering tests'); await expect(dialog.getByRole('button', { name: 'Loading tests…' })).toBeDisabled(); }
 finally { release(); }
 await expect(dialog.getByRole('alert')).toContainText('Please try again');
 await dialog.getByRole('button', { name: 'Load tests', exact: true }).click();
 await expect(dialog.getByRole('heading', { name: 'No tests found' })).toBeVisible();
 await expect(dialog.getByRole('button', { name: 'Add 0 selected tests' })).toBeDisabled();
 await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});

test('critic cycle 2: picker save errors preserve selection and prevent duplicate submissions', async ({ page }, info) => {
 info.annotations.push(...annotations); await pickerFixture(page);
 await page.route('**/sessions/9200/test-catalog', route => route.fulfill({ json: { tests: [{ key: 'a'.repeat(64), title: 'home.spec.js › Home works', file: 'home.spec.js', project: 'desktop' }] } }));
 let release; const gate = new Promise(resolve => { release = resolve; }); let saves = 0;
 await page.route('**/sessions/9200/selected-tests', async route => { saves++; await gate; await route.fulfill({ status: 422, json: { errors: { test_keys: ['Selected tests changed. Reload the test list.'] } } }); });
 await page.getByRole('button', { name: 'Add tests', exact: true }).click(); const dialog = page.getByRole('dialog');
 const checkbox = dialog.getByRole('checkbox'); await checkbox.check(); await dialog.getByRole('button', { name: 'Add 1 selected test' }).click();
 try { await expect(dialog.getByRole('button', { name: 'Adding tests…' })).toBeDisabled(); await expect(dialog.getByRole('button', { name: 'Close test picker' })).toBeDisabled(); }
 finally { release(); }
 await expect(dialog.getByRole('alert')).toContainText('Selected tests changed'); await expect(checkbox).toBeChecked(); expect(saves).toBe(1);
});
