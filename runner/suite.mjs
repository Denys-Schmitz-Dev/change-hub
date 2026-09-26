import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises'
import { join, dirname, sep } from 'node:path'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { gitState } from './engine.mjs'
import { importSuiteReport } from './suite-report.mjs'
import { snapshotContracts } from './contracts.mjs'
import { withVideoConfig } from './video-config.mjs'
const request=JSON.parse(await readFile(process.argv[2],'utf8'))
const report={status:'running',tests:[],startedAt:new Date().toISOString(),captureVideo:request.captureVideo !== false}
await mkdir(request.output,{recursive:true})
try {
 const repository=await realpath(request.repository)
 const config=await realpath(join(repository,request.config))
 if(!config.startsWith(repository+sep))throw new Error('Config must stay inside the repository.')
 const cli=createRequire(config).resolve('@playwright/test/cli')
 const output=join(request.output,'test-output')
 await mkdir(output,{recursive:true})
 const args=[cli,'test','--config',config,'--reporter=json','--output',output,'--trace=on','--workers=1','--global-timeout=180000']
 if(request.grep)args.push('--grep',request.grep)
 if(request.testSelection?.length) {
  const list=join(request.output,'selected-tests.txt')
  await writeFile(list,request.testSelection.map(test=>test.listEntry).join('\n'))
  args.push('--test-list',list)
 }
 report.command=['node',...args]
 report.sourceBefore=await gitState(repository)
 report.contracts=await snapshotContracts(repository)
 let exitCode=0
 try {await withVideoConfig(config,report.captureVideo,async wrapper=>{
  const actualArgs=[...args];actualArgs[actualArgs.indexOf('--config')+1]=wrapper
  await promisify(execFile)(process.execPath,actualArgs,{cwd:dirname(config),timeout:210000,maxBuffer:8*1024*1024,env:{...process.env,PLAYWRIGHT_JSON_OUTPUT_FILE:join(request.output,'playwright.json'),CHANGE_PHASE:request.phase,HUB_BASE_URL:request.baseURL}})
 })}
 catch(error){exitCode=typeof error.code==='number'?error.code:1;report.runnerError=String(error.stderr||error.message).slice(0,4000)}
 report.exitCode=exitCode
 const raw=JSON.parse(await readFile(join(request.output,'playwright.json'),'utf8'))
 Object.assign(report,await importSuiteReport(raw,request.output,{captureVideo:report.captureVideo}))
 if(request.testSelection?.some(selected=>!report.tests.some(test=>test.key===selected.key)))throw new Error('Some selected tests were not found. Refresh the test selection before capturing again.')
 report.sourceAfter=await gitState(repository)
 if(report.sourceBefore.fingerprint!==report.sourceAfter.fingerprint)throw new Error('Source changed during this suite run. Retry with a stable working tree.')
 if(report.errors.length || report.tests.some(t=>t.attempts.some(a=>a.status==='interrupted')))throw new Error(report.errors.join('\n')||'Suite execution was interrupted.');
 if(!report.tests.length)throw new Error(report.errors.join('\n')||'No tests matched. Check the config and title filter.')
 // Failed assertions are useful before/after evidence and do not discard the run.
 report.outcome=exitCode===0&&!report.tests.some(t=>t.outcome==='unexpected')?'passed':'failed'
 report.status='complete'
} catch(error){report.status='failed';report.error=error.message;process.exitCode=1}
finally{report.completedAt=new Date().toISOString();await writeFile(join(request.output,'result.json'),JSON.stringify(report,null,2))}
