import { test, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

test('connects an existing project, captures a change, and keeps its baseline across versions',async({page})=>{
 const repository=mkdtempSync(join(tmpdir(),'hub-target-'))
 const git=args=>execFileSync('git',args,{cwd:repository})
 git(['init','-q']);writeFileSync(join(repository,'page.txt'),'Before title');git(['add','page.txt']);git(['-c','user.name=Hub Test','-c','user.email=test@example.invalid','commit','-qm','fixture'])
 let title='Before title'
 const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(`<html><head><title>Fixture</title></head><body><main><h1>${title}</h1><button>Example action</button></main></body></html>`)})
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const url=`http://127.0.0.1:${server.address().port}`
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 try{
  await page.goto('/projects/create');await page.getByLabel('Project name',{exact:true}).fill('Attached fixture');await page.getByLabel('Repository directory',{exact:true}).fill(repository);await page.getByRole('button',{name:'Connect project',exact:true}).click()
  await page.getByLabel('Environment name',{exact:true}).fill('Existing local server');await page.getByLabel('Runner-visible URL',{exact:true}).fill(url);await page.getByRole('button',{name:'Save environment',exact:true}).click()
  await page.getByLabel('Session title',{exact:true}).fill('Change the heading');await page.getByLabel('Page path',{exact:true}).fill('/');await page.getByRole('button',{name:'Create session',exact:true}).click()
  await page.getByRole('button',{name:'Capture before',exact:true}).click();await expect(page.getByRole('button',{name:'Baseline locked'})).toBeVisible({timeout:45000})
  const beforeUrl=await page.getByAltText('Before: desktop-live',{exact:true}).getAttribute('src')
  title='After title';writeFileSync(join(repository,'page.txt'),title)
  await page.getByRole('button',{name:'Capture after',exact:true}).click();await expect(page.getByAltText('After: desktop-live',{exact:true})).toBeVisible({timeout:45000})
  await expect(page.getByText('Screenshot files differ;', {exact:false})).toBeVisible()
  await page.locator('summary').filter({hasText:'Headings'}).click();await expect(page.locator('pre').filter({hasText:'After title'}).first()).toContainText('Before title')
  await expect(page.getByAltText('Before: desktop-live',{exact:true})).toHaveAttribute('src',beforeUrl)
  await page.getByRole('button',{name:'Overlay',exact:true}).click();await page.getByRole('slider',{name:'After image opacity'}).fill('80');await expect(page.locator('#after-image')).toHaveCSS('opacity','0.8')
  await page.reload();await expect(page.getByRole('button',{name:'Baseline locked'})).toBeDisabled()
  await page.getByRole('button',{name:'Capture after',exact:true}).click();await expect(page.locator('[data-refresh]')).toHaveCount(0,{timeout:45000});await expect(page.locator('select[name=run] option')).toHaveCount(2)
  await page.getByRole('combobox',{name:'View',exact:true}).selectOption('mobile-live');await page.getByRole('button',{name:'Show view',exact:true}).click();await expect(page.getByAltText('After: mobile-live',{exact:true})).toBeVisible()
  await page.screenshot({path:'test-results/laravel-hub.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([])
 }finally{await new Promise(resolve=>server.close(resolve))}
})

test('React form displays Laravel validation and preserves entered values', async ({page}) => {
 await page.goto('/projects/create')
 await page.getByLabel('Project name',{exact:true}).fill('My unfinished connection')
 await page.getByLabel('Repository directory',{exact:true}).fill('/this/project/does-not-exist')
 await page.getByRole('button',{name:'Connect project',exact:true}).click()
 await expect(page.getByRole('alert')).toBeVisible()
 await expect(page.getByLabel('Project name',{exact:true})).toHaveValue('My unfinished connection')
 await expect(page.getByLabel('Repository directory',{exact:true})).toHaveValue('/this/project/does-not-exist')
})
