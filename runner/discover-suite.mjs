import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { suiteTests } from './suite-report.mjs'

let input=''
for await (const chunk of process.stdin) input+=chunk
const request=JSON.parse(input)
const output=await mkdtemp(join(tmpdir(),'hub-test-list-'))
try {
 const repository=await realpath(request.repository)
 const config=await realpath(join(repository,request.config))
 if(!config.startsWith(repository+sep))throw new Error('Config must stay inside the repository.')
 const cli=createRequire(config).resolve('@playwright/test/cli')
 const reportPath=join(output,'report.json')
 const args=[cli,'test','--config',config,'--list','--reporter=json']
 if(request.grep)args.push('--grep',request.grep)
 await promisify(execFile)(process.execPath,args,{cwd:dirname(config),timeout:30000,maxBuffer:2*1024*1024,env:{...process.env,HUB_BASE_URL:request.baseURL,PLAYWRIGHT_JSON_OUTPUT_FILE:reportPath}})
 const report=JSON.parse(await readFile(reportPath,'utf8'))
 if(report.errors?.length)throw new Error(report.errors.map(error=>error.message).join('\n'))
 process.stdout.write(JSON.stringify(suiteTests(report).map(({key,file,title,project})=>({key,file,title,project}))))
} catch(error) { process.stderr.write(String(error.stderr||error.message).slice(0,4000));process.exitCode=1 }
finally { await rm(output,{recursive:true,force:true}) }
