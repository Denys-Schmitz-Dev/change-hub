import { test } from '@playwright/test';

const pacedTests = new WeakSet();

// Both capture phases use the same presentation timing. Ordinary tests stay fast.
export async function recordedAction(page, target, action, ...args) {
    if (!page.video()) return target[action](...args);

    const info = test.info();
    if (!pacedTests.has(info)) {
        info.slow();
        pacedTests.add(info);
    }
    await target.scrollIntoViewIfNeeded();
    await target.evaluate((element, action) => {
        const bounds = element.getBoundingClientRect();
        const label = element.getAttribute('aria-label') || element.labels?.[0]?.textContent || element.textContent || element.getAttribute('placeholder') || element.tagName.toLowerCase();
        const cue = document.createElement('div');
        cue.dataset.recordingCue = 'true';
        cue.setAttribute('aria-hidden', 'true');
        cue.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
        const highlight = document.createElement('div');
        highlight.style.cssText = `position:absolute;left:${bounds.left - 3}px;top:${bounds.top - 3}px;width:${bounds.width + 6}px;height:${bounds.height + 6}px;border:3px solid #0088ff;border-radius:6px;box-shadow:0 0 0 3px white;box-sizing:border-box;`;
        const caption = document.createElement('div');
        const names = { click: 'Click', fill: 'Fill', selectOption: 'Select', check: 'Check', uncheck: 'Uncheck', press: 'Press key' };
        caption.textContent = `${names[action] ?? action}: ${label.trim().replace(/\s+/g, ' ').slice(0, 120)}`;
        caption.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);width:max-content;padding:12px 16px;border:2px solid white;border-radius:6px;background:#142433;color:white;font:600 16px/1.4 sans-serif;text-align:center;overflow-wrap:anywhere;';
        cue.append(highlight, caption);
        (element.closest('dialog[open]') || document.fullscreenElement || document.body).append(cue);
    }, action);
    try {
        await page.waitForTimeout(info.annotations.some(item => item.type === 'compact-recording') ? 180 : 900);
        const result = await target[action](...args);
        await page.waitForTimeout(info.annotations.some(item => item.type === 'compact-recording') ? 120 : 700);
        return result;
    } finally {
        if (!page.isClosed()) await page.locator('[data-recording-cue]').evaluateAll(cues => cues.forEach(cue => cue.remove()));
    }
}
