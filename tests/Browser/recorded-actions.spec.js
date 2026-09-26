import { test, expect } from '@playwright/test';
import { recordedAction } from './support/recorded-actions.js';

test.use({ video: 'on' });

test.describe('recording actions', () => {
    test('shows a readable cue during the action and removes it afterwards', async ({ page }, info) => {
        const video = !!page.video();
        await page.setContent('<button>Save changes</button><input aria-label="Search tests">');
        await page.evaluate(() => {
            document.querySelector('button').onclick = () => {
                window.cueAtClick = document.querySelector('[data-recording-cue]')?.textContent ?? null;
            };
        });
        const start = Date.now();
        await recordedAction(page, page.getByRole('button'), 'click');
        expect(await page.evaluate(() => window.cueAtClick)).toBe(video ? 'Click: Save changes' : null);
        if (video) expect(Date.now() - start).toBeGreaterThanOrEqual(1600);
        await expect(page.locator('[data-recording-cue]')).toHaveCount(0);
        await recordedAction(page, page.getByRole('textbox'), 'fill', 'checkout');
        await expect(page.getByRole('textbox')).toHaveValue('checkout');
        await expect(page.locator('[data-recording-cue]')).toHaveCount(0);
    });
    test('cleans up the cue when an action fails', async ({ page }) => {
        await page.setContent('<button disabled>Save changes</button>');
        await expect(recordedAction(page, page.getByRole('button'), 'click', { timeout: 100 })).rejects.toThrow();
        await expect(page.locator('[data-recording-cue]')).toHaveCount(0);
    });
});


test.describe('recording highlights in fullscreen', () => {
    test('keeps the cue visible above fullscreen content', async ({ page }, info) => {
        await page.setContent('<main><button>Save changes</button></main>');
        await page.locator('main').evaluate(element => element.requestFullscreen());
        await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
        await page.getByRole('button').evaluate(element => {
            element.addEventListener('click', () => {
                const cue = document.querySelector('[data-recording-cue]');
                window.visibleCue = !!cue && document.fullscreenElement.contains(cue);
            });
        });
        const action = recordedAction(page, page.getByRole('button'), 'click');
        await expect(page.locator('[data-recording-cue]')).toBeVisible();
        await info.attach('fullscreen-action-highlight', { body: await page.screenshot(), contentType: 'image/png' });
        await action;
        expect(await page.evaluate(() => window.visibleCue)).toBe(true);
        await expect(page.locator('[data-recording-cue]')).toHaveCount(0);
    });
});
