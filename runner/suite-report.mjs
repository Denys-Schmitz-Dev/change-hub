import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { createHash } from 'node:crypto'
const digest = value => createHash('sha256').update(value).digest('hex')
// Only copy declared attachments from this execution's output tree. Never trust report paths.
export async function importSuiteReport(report, output) {
 const tests=[]
 const root=await realpath(join(output,'test-output'))
 await mkdir(join(output,'assets'),{recursive:true})
 async function visit(suite, parents=[]) {
  const names=[...parents,suite.title].filter(Boolean)
  for(const spec of suite.specs??[]) for(const test of spec.tests??[]) {
   const identity=JSON.stringify([spec.file,names,spec.title,test.projectName])
   const attempts=test.results??[]
   const result=attempts.at(-1)
   const item={key:digest(identity),title:[...names,spec.title].join(' › '),project:test.projectName??'',outcome:test.status,expectedStatus:test.expectedStatus,duration:attempts.reduce((sum,r)=>sum+(r.duration??0),0),attempts:attempts.map(r=>({status:r.status,retry:r.retry,duration:r.duration,errors:(r.errors??[]).map(e=>e.message??e.value??'Unknown failure')})),attachments:[]}
   const seen=new Map()
   for(const attachment of result?.attachments??[]) {
    const extension={'image/png':'png','application/zip':'zip','text/plain':'txt','video/webm':'webm'}[attachment.contentType]
    if(!extension)continue
    let bytes
    if(attachment.path) {
     const path=await realpath(attachment.path).catch(()=>null)
     if(!path||!path.startsWith(root+sep))continue
     bytes=await readFile(path)
    } else if(attachment.body) bytes=Buffer.from(attachment.body,'base64')
    if(!bytes||bytes.length>(extension==='webm'?100:30)*1024*1024)continue
    if(extension==='png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))continue
    if(extension==='webm'&&!bytes.subarray(0,4).equals(Buffer.from([26,69,223,163])))continue
    const occurrence=seen.get(attachment.name)??0;seen.set(attachment.name,occurrence+1)
    const key=digest(JSON.stringify([identity,attachment.name,occurrence]))
    const file=`${key}.${extension}`
    await writeFile(join(output,'assets',file),bytes)
    item.attachments.push({key,name:attachment.name,file,contentType:attachment.contentType})
   }
   tests.push(item)
  }
  for(const child of suite.suites??[])await visit(child,names)
 }
 for(const suite of report.suites??[])await visit(suite)
 return {tests,errors:(report.errors??[]).map(e=>e.message??e.value??'Unknown error'),stats:report.stats}
}
