import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {importSuiteReport} from '../../runner/suite-report.mjs'
test('pairs named attachments independently of outcome, preserves retries and skips, rejects outside paths',async()=>{
 const root=await mkdtemp(join(tmpdir(),'suite-import-'))
 try {
 await mkdir(join(root,'test-output'));const png=Buffer.from([137,80,78,71,13,10,26,10]);await writeFile(join(root,'outside.png'),png)
 const result={status:'passed',retry:1,attachments:[{name:'dialog',contentType:'image/png',body:png.toString('base64')},{name:'video',contentType:'video/webm',body:Buffer.from([26,69,223,163,0]).toString('base64')},{name:'invalid-video',contentType:'video/webm',body:png.toString('base64')},{name:'outside',contentType:'image/png',path:join(root,'outside.png')}]}
 const report={suites:[{title:'feature.spec.ts',suites:[{title:'feature',specs:[{file:'feature.spec.ts',title:'opens',tests:[{projectName:'mobile',status:'flaky',expectedStatus:'passed',results:[{status:'failed',retry:0,errors:[{message:'first failure'}]},result]}]},{file:'feature.spec.ts',title:'later',tests:[{projectName:'mobile',status:'skipped',results:[{status:'skipped'}]}]}]}]}]}
 const first=await importSuiteReport(report,root)
 assert.equal(first.tests[0].attempts.length,2);assert.equal(first.tests[0].outcome,'flaky');assert.equal(first.tests[1].outcome,'skipped');assert.equal(first.tests[0].attachments.length,2)
 report.suites[0].suites[0].specs[0].tests[0].status='expected'
 const second=await importSuiteReport(report,root);assert.equal(second.tests[0].attachments[0].key,first.tests[0].attachments[0].key)
 }finally{await rm(root,{recursive:true,force:true})}
})
