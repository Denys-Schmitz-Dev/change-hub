import {test,expect} from '@playwright/test'
import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
test('suite screenshots and assertions compare across immutable before and versioned after runs',async({page})=>{
 test.setTimeout(120000)
 const repo=mkdtempSync(resolve('storage/framework/testing/suite-'))
 const git=args=>execFileSync('git',args,{cwd:repo})
 try {
 git(['init','-q']);symlinkSync(resolve('node_modules'),join(repo,'node_modules'),'dir');writeFileSync(join(repo,'.gitignore'),'node_modules\n')
 writeFileSync(join(repo,'state.txt'),'Before feature')
 writeFileSync(join(repo,'playwright.config.mjs'),`export default {testDir:'.',testMatch:'feature.spec.mjs',timeout:10000,use:{video:'on'},expect:{timeout:500},projects:[{name:'desktop'},{name:'mobile',use:{viewport:{width:390,height:844}}}]}`)
 writeFileSync(join(repo,'feature.spec.mjs'),`import {test,expect} from '@playwright/test';import {readFileSync} from 'node:fs';test.describe('Feature',()=>{test('opens component',async({page},info)=>{await page.setContent('<main><h1>'+readFileSync(new URL('./state.txt',import.meta.url),'utf8')+'</h1><button>Save</button></main>');await info.attach('component-open',{body:await page.locator('main').screenshot(),contentType:'image/png'});await info.attach('save-button',{body:await page.getByRole('button').screenshot(),contentType:'image/png'});await expect(page.locator('h1')).toHaveText('After feature');});test.skip('later feature',()=>{});});`)
 git(['add','.']);git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture'])
 await page.goto('/projects/create');await page.getByLabel('Project name',{exact:true}).fill('Suite fixture');await page.getByLabel('Repository directory',{exact:true}).fill(repo);await page.getByRole('button',{name:'Connect project',exact:true}).click();await page.getByRole('button',{name:'Save environment',exact:true}).click();await page.getByLabel('Session title',{exact:true}).fill('Feature comparison');await page.getByRole('button',{name:'Create session',exact:true}).click()
 await page.getByText('Add a Playwright suite',{exact:true}).click();await page.getByLabel('Suite name',{exact:true}).fill('Feature suite');await page.getByLabel('Suite config path',{exact:true}).fill('playwright.config.mjs');await page.getByRole('button',{name:'Add suite',exact:true}).click()
 const suite=page.getByRole('region',{name:'Suite Feature suite',exact:true})
 await suite.getByRole('button',{name:'Run suite before',exact:true}).click();await expect(suite.getByRole('button',{name:'Suite baseline locked',exact:true})).toBeVisible({timeout:45000})
 const before=suite.getByAltText('Before suite: component-open',{exact:true});await expect(before).toBeVisible();const beforeURL=await before.getAttribute('src')
 await expect(suite.getByText(/opens component — unexpected/).first()).toBeVisible();await expect(suite.getByText(/later feature — skipped/).first()).toBeVisible()
 writeFileSync(join(repo,'state.txt'),'After feature')
 await suite.getByRole('button',{name:'Run suite after',exact:true}).click();await expect(suite.getByAltText('After suite: component-open',{exact:true})).toBeVisible({timeout:45000})
 await expect.poll(()=>suite.getByLabel('Before interaction video',{exact:true}).evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1)
 await expect.poll(()=>suite.getByLabel('After interaction video',{exact:true}).evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(1)
 await suite.getByRole('button',{name:'Play both from start',exact:true}).click()
 await expect.poll(()=>suite.getByLabel('After interaction video',{exact:true}).evaluate(v=>v.currentTime)).toBeGreaterThan(0)
 await suite.getByRole('button',{name:'Pause both',exact:true}).click()
 await expect.poll(()=>suite.getByLabel('Before interaction video',{exact:true}).evaluate(v=>v.paused)).toBe(true)
 await expect(before).toHaveAttribute('src',beforeURL);await expect(suite.getByText(/opens component — expected/).first()).toBeVisible()
 await suite.getByRole('button',{name:'Suite overlay',exact:true}).click();await suite.getByRole('slider',{name:'Suite after image opacity'}).fill('80');await expect(suite.getByAltText('Suite after overlay',{exact:true})).toHaveCSS('opacity','0.8')
 await page.reload();await expect(suite.getByRole('button',{name:'Suite baseline locked',exact:true})).toBeDisabled()
 await suite.getByRole('button',{name:'Run suite after',exact:true}).click();await expect(suite.getByRole('button',{name:'Run suite after',exact:true})).toBeEnabled({timeout:45000});await expect(suite.getByRole('combobox',{name:'After version for Feature suite'}).locator('option')).toHaveCount(2)
 await suite.getByRole('combobox',{name:'Screenshot for Feature suite'}).selectOption({index:3});await expect(suite.getByAltText('Before suite: save-button',{exact:true})).toBeVisible()
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 }finally{rmSync(repo,{recursive:true,force:true})}
})
