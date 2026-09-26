import { recordedAction } from './support/recorded-actions.js';
import { test, expect } from '@playwright/test'

test('project setup requires E2E details and preserves validation input', async ({page}) => {
 await page.goto('/projects/create')
 await expect(page.getByLabel('Playwright config path',{exact:true})).toHaveAttribute('required','')
 await recordedAction(page, page.getByLabel('Project name',{exact:true}), 'fill', 'My unfinished connection')
 await recordedAction(page, page.getByLabel('Repository directory',{exact:true}), 'fill', '/this/project/does-not-exist')
 await recordedAction(page, page.getByRole('button',{name:'Connect project',exact:true}), 'click')
 await expect(page.getByRole('alert')).toBeVisible()
 await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('My unfinished connection')
 await expect(page.getByLabel('Repository directory',{exact:true})).toHaveValue('/this/project/does-not-exist')
})
