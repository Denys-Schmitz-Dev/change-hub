import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changeReview } from '../../resources/js/change-review.ts';
const entry = (hash, file='src/App.tsx') => ({key:file,file,hash,label:'Component',signature:hash,line:1});
const run = (entries, tests=[], status='complete') => ({id:1,status,report:{contracts:{version:1,warnings:[],categories:{ui:entries}},tests}});
const linked = (extra={}) => ({key:'test',coveredFiles:['src/App.tsx'],outcome:'expected',attempts:[{status:'passed'}],attachments:[{contentType:'image/png'}],diagnostics:{console:[],network:[],warnings:[]},...extra});
test('pending or missing snapshots do not imply zero gaps or verification', () => {
 assert.equal(changeReview(undefined, run([])).comparable, false);
 assert.equal(changeReview(run([entry('a')]),run([entry('b')],[],'failed')).comparable,false);
});
test('passed file declarations expose evidence without claiming contract verification', () => {
 const result=changeReview(run([entry('a')]),run([entry('b')],[linked()]));
 assert.equal(result.changed,1); assert.equal(result.areas[0].tests.length,1); assert.deepEqual(result.areas[0].gaps,[]);
 assert.equal(result.needsAttention,0);
});
test('failed, skipped and partial diagnostics remain visible gaps', () => {
 const result=changeReview(run([entry('a')]),run([entry('b')],[linked({outcome:'unexpected',diagnostics:undefined,attachments:[]}),linked({key:'skip',outcome:'skipped',attempts:[{status:'skipped'}]})]));
 assert.deepEqual(result.areas[0].gaps,['Failed test','Unexecuted test','Incomplete runtime evidence','Missing visual evidence']);
 assert.equal(result.needsAttention,1);
});
test('removed files and absent test declarations remain reviewable', () => {
 const result=changeReview(run([entry('a')]),run([]));
 assert.equal(result.areas[0].contracts[0].status,'Removed');
 assert.deepEqual(result.areas[0].gaps,['No linked test']);
});
test('skipped declarations are retained and flaky tests are not clean evidence', () => {
 const before=run([entry('a')]);
 const skipped=changeReview(before,run([entry('b')],[linked({outcome:'skipped',attempts:[{status:'skipped'}]})]));
 assert.equal(skipped.areas[0].tests.length,1);
 assert.ok(skipped.areas[0].gaps.includes('Linked tests not executed'));
 const flaky=changeReview(before,run([entry('b')],[linked({outcome:'flaky'})]));
 assert.ok(flaky.areas[0].gaps.includes('Flaky test'));
});
test('source warnings are preserved even when no scanned changes exist', () => {
 const before=run([]), after=run([]);
 after.report.contracts.warnings=['Scan truncated'];
 const review=changeReview(before,after);
 assert.equal(review.comparable,true);
 assert.deepEqual(review.warnings,['Scan truncated']);
});
