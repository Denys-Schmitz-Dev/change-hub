import { test, expect } from '@playwright/test'

test('project setup requires E2E details and preserves validation input', async ({page}) => {
 await page.goto('/projects/create')
 await expect(page.getByLabel('Playwright config path',{exact:true})).toHaveAttribute('required','')
 await page.getByLabel('Project name',{exact:true}).fill('My unfinished connection')
 await page.getByLabel('Repository directory',{exact:true}).fill('/this/project/does-not-exist')
 await page.getByRole('button',{name:'Connect project',exact:true}).click()
 await expect(page.getByRole('alert')).toBeVisible()
 await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('My unfinished connection')
 await expect(page.getByLabel('Repository directory',{exact:true})).toHaveValue('/this/project/does-not-exist')
})
