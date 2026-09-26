import { recordedAction } from './support/recorded-actions.js';
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('home provides actions, five recent projects and sessions, and workspace navigation', async ({ page }) => {
    const asset = JSON.parse(readFileSync('public/build/manifest.json', 'utf8'))['resources/js/app.tsx'];
    const projects = Array.from({ length: 7 }, (_, index) => ({
        id: index + 1, name: `Project ${index + 1}`, repository_path: `/projects/project-${index + 1}`,
        environments: [{ id: index + 1, name: 'Local', base_url: 'http://localhost:3000', runner_mode: 'local' }],
    }));
    const sessions = Array.from({ length: 7 }, (_, index) => ({
        id: index + 1, title: `Change ${index + 1}`, environment: { name: 'Local', project: projects[index === 5 ? 4 : index] },
        profile: { path: '/' }, runs: [],
    }));
    const payload = { page: 'home', csrf: 'test', old: {}, errors: [], props: { projects, sessions } };
    await page.route(/\/(\?view=projects(?:&project=\d+)?)?$/, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${asset.css.map(file => `<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${asset.file}"></script></head><body><div id="root"></div><script id="hub-data" type="application/json">${JSON.stringify(payload)}</script></body></html>` }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await expect(page.locator('.home-actions a')).toHaveCount(2);
    await expect(page.getByRole('table', { name: 'Last five connected projects' }).locator('tbody tr')).toHaveCount(5);
    await expect(page.getByRole('table', { name: 'Last five connected projects' }).locator('tbody tr').first()).toContainText('Project 7');
    await expect(page.getByRole('table', { name: 'Last five connected projects' }).locator('tbody tr').last()).toContainText('Project 3');
    await expect(page.getByRole('table', { name: 'Last five connected projects' }).locator('tbody tr').first().getByRole('link', { name: 'New session · Local' })).toHaveAttribute('href', '/sessions/create?environment=7');
    const recentSessions = page.getByRole('table', { name: 'Last five change sessions' });
    await expect(recentSessions.locator('tbody tr')).toHaveCount(5);
    await expect(recentSessions.locator('tbody tr').first()).toContainText('Change 7');
    await expect(recentSessions.locator('tbody tr').last()).toContainText('Change 3');
    await expect(recentSessions.getByRole('link', { name: 'Change 7', exact: true })).toHaveAttribute('href', '/sessions/7');
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await recordedAction(page, page.getByRole('table', { name: 'Last five connected projects' }).locator('tbody tr').first().getByRole('link', { name: 'View change sessions', exact: true }), 'click');
    await expect(page.getByRole('heading', { name: 'Project 7 change sessions', exact: true })).toBeVisible();
    await expect(page.locator('.session-row')).toHaveCount(1);
    await expect(page.locator('.session-row')).toContainText('Change 7');
    await expect(page.locator('.session-row').getByRole('link', { name: 'Change 7', exact: true })).toHaveAttribute('href', '/sessions/7');
    await recordedAction(page, page.locator('.session-row').getByRole('button', { name: 'Delete session', exact: true }), 'click');
    await expect(page.locator('.session-row')).toContainText('Delete permanently?');
    await recordedAction(page, page.locator('.session-row').getByRole('button', { name: 'Cancel', exact: true }), 'click');
    await page.reload();
    await expect(page.locator('.session-row')).toHaveCount(1);
    await page.goto('/?view=projects&project=6');
    await expect(page.getByText('No change sessions for this project yet.', { exact: true })).toBeVisible();
    await expect(page.locator('.session-row')).toHaveCount(0);
    await page.goto('/?view=projects&project=999');
    await expect(page.getByRole('heading', { name: 'Project not found', exact: true })).toBeVisible();
    await expect(page.locator('.session-row')).toHaveCount(0);
    await recordedAction(page, page.getByRole('link', { name: 'All projects and sessions', exact: true }), 'click');
    await recordedAction(page, page.locator('.card').filter({ hasText: 'Project 7' }).getByRole('button', { name: 'Delete project', exact: true }), 'click');
    await expect(page.locator('.card').filter({ hasText: 'Project 7' })).toContainText('Delete permanently?');
    await recordedAction(page, page.locator('.card').filter({ hasText: 'Project 7' }).getByRole('button', { name: 'Cancel', exact: true }), 'click');
    await recordedAction(page, page.getByRole('navigation').getByRole('link', { name: 'Projects and sessions' }), 'click');
    await expect(page.locator('.cards .card')).toHaveCount(7);
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Projects and sessions' })).toHaveAttribute('aria-current', 'page');
    await recordedAction(page, page.getByRole('navigation').getByRole('link', { name: 'Home', exact: true }), 'click');
    await expect(page.getByRole('table', { name: 'Last five connected projects' }).locator('tbody tr')).toHaveCount(5);
});
