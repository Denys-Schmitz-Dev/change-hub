import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('overview shows failure output without opening passed tests', async ({ page }) => {
 const asset = JSON.parse(readFileSync('public/build/manifest.json','utf8'))['resources/js/app.tsx'];
 const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">${(asset.css??[]).map(file=>`<link rel="stylesheet" href="/build/${file}">`).join('')}<script type="module" src="/build/${asset.file}"></script></head><body><div id="root"></div><script id="hub-data" type="application/json"></script></body></html>`;
 const testCase = (key, outcome, attempts) => ({key,title:key,project:'desktop',outcome,expectedStatus:'passed',duration:10,attachments:[],attempts});
 const attempt = (status, errors=[], retry=0) => ({status,errors,retry,duration:10});
 const run = {id:2,phase:'after',status:'complete',capture_video:true,report:{outcome:'failed',errors:['Runner diagnostic'],tests:[
  testCase('Successful checkout','expected',[attempt('passed')]),
  testCase('Broken checkout','unexpected',[attempt('failed',['Expected confirmation, received error'])]),
  testCase('Retry checkout','flaky',[attempt('timedOut',['Checkout timed out']),attempt('passed',[],1)])
 ]}};
 const payload = {page:'session',csrf:'test',old:{},errors:[],props:{active:false,session:{id:1,title:'Overview fixture',environment:{name:'Local',project:{name:'Fixture'}},suites:[{id:1,name:'Checkout',config:'playwright.config.ts',selected_tests:null,runs:[run]}]}}};
 await page.route('**/overview-fixture*', route => route.fulfill({contentType:'text/html',body:html.replace(/(<script id="hub-data"[^>]*>)[\s\S]*?(<\/script>)/,(_,start,end)=>start+JSON.stringify(payload)+end)}));
 await page.goto('/overview-fixture?tab=dev');
 const output = page.getByRole('region',{name:'Failure output',exact:true}).first();
 await expect(output.getByText('Expected confirmation, received error',{exact:true})).toBeVisible();
 await expect(output.getByText('Checkout timed out',{exact:true})).toBeVisible();
 await expect(output.getByText('Runner diagnostic',{exact:true})).toBeVisible();
 await expect(output.getByText('Successful checkout',{exact:true})).toHaveCount(0);
 await page.getByText('Test results',{exact:true}).click();
 await expect(page.locator('.test-result-row').filter({hasText:'Successful checkout'}).first()).toContainText('Passed');
 await expect(page.locator('.test-result-row details')).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/failure-overview-mobile.png',fullPage:true});
});
