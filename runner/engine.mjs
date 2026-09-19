import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { devices, digest } from './profile.mjs'
const exec = promisify(execFile)
export async function gitState(cwd) {
  const git = args => exec('git', ['-c', `safe.directory=${cwd}`, ...args], { cwd, maxBuffer: 32 * 1024 * 1024 })
  const [head, diff, files, status] = await Promise.all([git(['rev-parse','HEAD']),git(['diff','HEAD','--binary']),git(['ls-files','-z','--others','--exclude-standard']),git(['status','--porcelain'])])
  const hash = createHash('sha256').update(head.stdout).update(diff.stdout)
  for (const path of files.stdout.split('\0').filter(Boolean).sort()) {
    hash.update(path)
    try { for await (const chunk of createReadStream(join(cwd,path))) hash.update(chunk) } catch (error) { if (error.code === 'ENOENT') hash.update('deleted'); else throw error }
  }
  return { commit: head.stdout.trim(), dirty: !!status.stdout.trim(), fingerprint: hash.digest('hex') }
}
function safeURL(value) { const url = new URL(value); return url.origin + url.pathname }
export async function captureSession({ session, run, directory, baseURL, repoRoot, progress }) {
  run.sourceBefore = await gitState(repoRoot)
  const browser = await chromium.launch()
  run.browserVersion = browser.version()
  try {
    for (const device of session.devices) for (const scenario of session.scenarios) {
      const key = `${device}-${scenario}`, folder = join(directory,key)
      await mkdir(folder,{recursive:true})
      const frame = { key, device, scenario, viewport: devices[device], status:'running', messages:[], network:[] }
      run.frames.push(frame); await progress()
      const context = await browser.newContext({ viewport: devices[device], deviceScaleFactor:1, isMobile:device==='mobile', hasTouch:device==='mobile', colorScheme:'dark', reducedMotion:'reduce', locale:'en-US', timezoneId:'UTC', serviceWorkers:'block' })
      try {
        await context.tracing.start({screenshots:true,snapshots:true,sources:false})
        await context.route('**/*', async route => {
          const url = new URL(route.request().url())
          if (session.adapter==='resume' && url.pathname.endsWith('/api/user')) return route.fulfill({status:scenario==='guest'?401:scenario==='unavailable'?503:200,json:{can_view_resume:scenario==='approved',resume_access_status:scenario==='guest'?null:scenario}})
          if (!session.allowedOrigins.includes(url.origin)) { if(frame.network.length<300) frame.network.push({method:route.request().method(),url:safeURL(url.href),status:'blocked'}); return route.abort() }
          return route.continue()
        })
        await context.routeWebSocket('**/*', socket => { const origin=new URL(socket.url()).origin.replace(/^ws/,'http'); if(session.allowedOrigins.includes(origin)) socket.connectToServer(); else socket.close() })
        const page=await context.newPage(); page.setDefaultTimeout(15_000)
        page.on('console',msg=>{if(['warning','error'].includes(msg.type())&&frame.messages.length<100) frame.messages.push({type:msg.type(),text:msg.text().slice(0,2000)})})
        page.on('pageerror',error=>{if(frame.messages.length<100) frame.messages.push({type:'exception',text:error.message.slice(0,2000)})})
        page.on('response',res=>{if(frame.network.length<300) frame.network.push({method:res.request().method(),url:safeURL(res.url()),status:res.status()})})
        const userResponse=session.adapter==='resume'?page.waitForResponse(res=>new URL(res.url()).pathname.endsWith('/api/user')):Promise.resolve()
        const [response]=await Promise.all([page.goto(new URL(session.path,baseURL).href,{waitUntil:'load',timeout:30_000}),userResponse])
        if(!response?.ok()) throw new Error(`Page returned HTTP ${response?.status()??'unknown'}`)
        await page.locator(session.readySelector||'body').first().waitFor({state:'visible'})
        if(session.adapter==='resume') await page.getByRole('button',{name:'Checking access…',exact:true}).waitFor({state:'hidden'})
        await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))})
        if(await page.locator('vite-error-overlay').count()) throw new Error('The target application has a compilation error.')
        const observation=await page.evaluate(()=>{
          const visible=el=>!!(el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden')
          const label=el=>(el.getAttribute('aria-label')||el.labels?.[0]?.innerText||el.innerText||el.getAttribute('title')||'').trim().replace(/\s+/g,' ')
          return {title:document.title,headings:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map(el=>({level:el.tagName,text:label(el)})),controls:[...document.querySelectorAll('button,input,select,textarea,[role="button"]')].filter(visible).map(el=>({role:el.getAttribute('role')||el.tagName.toLowerCase(),name:label(el),disabled:el.matches(':disabled')||el.getAttribute('aria-disabled')==='true'})),links:[...document.querySelectorAll('a[href]')].filter(visible).map(el=>{const url=new URL(el.href);return{name:label(el),href:url.origin+url.pathname}}),text:document.body.innerText.split('\n').map(t=>t.trim()).filter(Boolean),dimensions:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}}
        })
        if(!observation.text.length) throw new Error('No visible content was rendered.')
        await writeFile(join(folder,'observation.json'),JSON.stringify(observation,null,2))
        await writeFile(join(folder,'accessibility.yml'),await page.locator('body').ariaSnapshot())
        await page.screenshot({path:join(folder,'page.png'),fullPage:true,animations:'disabled',caret:'hide',timeout:20_000})
        frame.screenshotHash=digest(await readFile(join(folder,'page.png')));frame.observation=observation;frame.status='complete'
      } catch(error) {frame.status='failed';frame.error=error.message}
      finally {await writeFile(join(folder,'events.json'),JSON.stringify({messages:frame.messages,network:frame.network},null,2));await context.tracing.stop({path:join(folder,'trace.zip')}).catch(()=>{});await context.close();await progress()}
    }
  } finally {await browser.close();run.sourceAfter=await gitState(repoRoot)}
  if(run.frames.some(f=>f.status!=='complete')) throw new Error('Some views failed. Inspect the evidence and retry after fixing the environment.')
  if(run.sourceBefore.fingerprint!==run.sourceAfter.fingerprint) throw new Error('Repository contents changed during capture. Retry when the working tree is stable.')
}
