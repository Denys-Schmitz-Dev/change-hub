import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coverageSummary } from '../../resources/js/coverage-summary.ts'

const caseOf = (key, outcome='expected', statuses=['passed'], extra={}) => ({key,title:key,project:'desktop',outcome,expectedStatus:'passed',attempts:statuses.map(status=>({status,retry:0,errors:[]})),attachments:[],...extra})
const snapshot = entries => ({version:1,warnings:[],categories:{ui:entries}})
const entry = (key,file,hash) => ({key,file,hash,label:key,signature:hash,line:1})
const run = (tests,contracts,status='complete') => ({id:1,status,report:{tests,contracts,outcome:'passed'}})

test('counts tests rather than retry attempts and separates flaky, skipped and expected failures', () => {
 const before=run([caseOf('pass'),caseOf('gone')])
 const after=run([caseOf('pass'),caseOf('failed','unexpected',['failed','failed']),caseOf('skip','skipped',['skipped']),caseOf('flaky','flaky',['failed','passed']),caseOf('known','expected',['failed'],{expectedStatus:'failed'})])
 const result=coverageSummary(before,after,[])
 assert.deepEqual([result.executed,result.passed,result.failed,result.skipped,result.flaky,result.expectedFailures],[4,1,1,1,1,1])
 assert.equal(result.added.length,4)
 assert.equal(result.removed.length,1)
 assert.equal(result.paired,0)
})

test('missing baselines and pending after runs never imply passing or full comparisons', () => {
 assert.equal(coverageSummary(undefined,run([caseOf('new')]),null).added,null)
 const result=coverageSummary(run([caseOf('old')]),{id:2,status:'queued',report:null},null)
 assert.equal(result.hasReport,false)
 assert.equal(result.executed,0)
 assert.equal(result.comparableContracts,false)
 const partial=coverageSummary(run([caseOf('old')]),run([caseOf('new')],undefined,'failed'),null)
 assert.equal(partial.added,null)
})

test('video selection affects only video counts and distinguishes paired from one-sided recordings', () => {
 const video=key=>({key,contentType:'video/webm'})
 const before=run([caseOf('a','expected',['passed'],{attachments:[video('paired'),video('before')]}),caseOf('b','expected',['passed'],{attachments:[video('other')]})])
 const after=run([caseOf('a','expected',['passed'],{attachments:[video('paired'),video('after')]}),caseOf('b','unexpected',['failed'])])
 const result=coverageSummary(before,after,['a'])
 assert.deepEqual([result.paired,result.beforeOnly,result.afterOnly],[1,1,1])
 assert.equal(result.executed,2)
 assert.equal(result.failed,1)
})

test('changed files without executed declarations remain unidentified, including removals', () => {
 const before=run([],snapshot([entry('home','src/Home.tsx','old'),entry('gone','src/Removed.tsx','old')]))
 const after=run([caseOf('home','expected',['passed'],{coveredFiles:['src/Home.tsx']}),caseOf('skip','skipped',['skipped'],{coveredFiles:['src/New.tsx']})],snapshot([entry('home','src/Home.tsx','new'),entry('new','src/New.tsx','new')]))
 const result=coverageSummary(before,after,[])
 assert.equal(result.areas.length,3)
 assert.equal(result.missingEvidence,2)
 assert.equal(result.areas.find(area=>area.file==='src/Home.tsx').linkedTests.length,1)
 assert.equal(result.areas.find(area=>area.file==='src/New.tsx').linkedTests.length,0)
 assert.equal(coverageSummary(before,run([],undefined),null).comparableContracts,false)
})
