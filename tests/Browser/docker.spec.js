import { recordedAction } from './support/recorded-actions.js';
import { test, expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
const exec=promisify(execFile)
test('captures an existing Docker service over its network',async({page,request})=>{
 test.skip(process.env.HUB_DOCKER_TEST!=='1','Run with HUB_DOCKER_TEST=1 after installing the Playwright image.')
 const suffix=Date.now(),network=`hub-test-${suffix}`,container=`hub-target-${suffix}`,repository=mkdtempSync(join(process.cwd(),'storage/framework/hub-docker-repo-'))
 await exec('git',['init','-q'],{cwd:repository});writeFileSync(join(repository,'source.txt'),'Docker fixture');await exec('git',['add','.'],{cwd:repository});await exec('git',['-c','user.name=Hub Test','-c','user.email=test@example.invalid','commit','-qm','fixture'],{cwd:repository})
 await exec('docker',['network','create',network])
 try {
  await exec('docker',['run','-d','--rm','--name',container,'--network',network,'--mount',`type=bind,source=${resolve('tests/Fixtures/docker-target.mjs')},target=/target.mjs,readonly`,'mcr.microsoft.com/playwright:v1.63.0-noble','node','/target.mjs'])
  await page.goto('/projects/create');await recordedAction(page, page.getByLabel('Project name',{exact:true}), 'fill', 'Docker connection');await recordedAction(page, page.getByLabel('Repository directory',{exact:true}), 'fill', repository);await recordedAction(page, page.getByRole('button',{name:'Connect project',exact:true}), 'click')
  await recordedAction(page, page.getByLabel('Runner-visible URL',{exact:true}), 'fill', `http://${container}:8080`);await recordedAction(page, page.getByLabel('Browser execution',{exact:true}), 'selectOption', 'docker');await recordedAction(page, page.getByLabel('Docker network',{exact:false}), 'fill', network);await recordedAction(page, page.getByRole('button',{name:'Save environment',exact:true}), 'click')
  await recordedAction(page, page.getByLabel('Session title',{exact:true}), 'fill', 'Docker network capture');await recordedAction(page, page.getByLabel('Page path',{exact:true}), 'fill', '/');await recordedAction(page, page.getByLabel('Mobile · 390px',{exact:true}), 'uncheck');await recordedAction(page, page.getByRole('button',{name:'Create session',exact:true}), 'click');await recordedAction(page, page.getByRole('button',{name:'Capture before',exact:true}), 'click')
  await expect(page.getByRole('button',{name:'Baseline locked'})).toBeVisible({timeout:60000})
  const href=await page.getByRole('link',{name:'observation.json',exact:true}).getAttribute('href');const observation=await (await request.get(href)).json();expect(observation.headings[0].text).toBe('Existing Docker environment')
 } finally {await exec('docker',['rm','-f',container]).catch(()=>{});await exec('docker',['network','rm',network])}
})
