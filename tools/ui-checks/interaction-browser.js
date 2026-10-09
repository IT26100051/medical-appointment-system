/* Real Chromium checks. Install playwright and run `npx playwright install chromium`. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const BASE = process.env.CLINIC || 'http://localhost:8080';
(async () => {
 const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
 let checks=0; const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m);};
 try {
  const page=await browser.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE); await page.locator('#portalBtn').hover();
  await page.waitForTimeout(650);
  const hover=await page.locator('#portalBtn').evaluate(el=>{const s=getComputedStyle(el);return {color:s.color,fill:s.webkitTextFillColor,opacity:s.opacity,filter:s.filter,sheen:getComputedStyle(el,'::after').content};});
  ok(hover.color==='rgb(255, 255, 255)' && hover.fill===hover.color && hover.opacity==='1' && hover.filter==='none','sign-in label stays white and opaque on hover');
  ok(hover.sheen==='none','no moving overlay over button text');
  await page.emulateMedia({reducedMotion:'reduce'});
  ok(await page.locator('#portalBtn').evaluate(el=>getComputedStyle(el).transform==='none'),'reduced-motion hover does not move');
  await page.evaluate(()=>{
   document.body.innerHTML='<main style="padding:30px"><label for="test-picker">Doctor</label><select id="test-picker"><option value="">Choose a doctor</option><option value="silva">Anura Silva — Cardiology</option><option value="fernando">Ruvini Fernando — General medicine</option><option value="disabled" disabled>Unavailable</option></select><button id="outside" style="position:fixed;right:30px;bottom:30px">Next field</button></main>';
   window.picker=MedCare.search.enhanceSelect(document.querySelector('select'),{allowEmpty:false});
  });
  await page.locator('.combo-face').click();
  await page.locator('.combo-input').fill('Anura Slva');
  ok(await page.locator('.combo-item').count()===1,'misspelled doctor name finds one result');
  ok((await page.locator('.combo-item').textContent()).includes('Anura Silva'),'typo result is the correct doctor');
  await page.locator('.combo-input').press('ArrowDown');
  ok(!!await page.locator('.combo-input').getAttribute('aria-activedescendant'),'keyboard result announced with active descendant');
  await page.locator('.combo-input').press('Enter');
  ok(await page.locator('#test-picker').inputValue()==='silva','Enter selects doctor');
  await page.locator('.combo-face').click();
  await page.locator('.combo-input').fill('zzzzzzzzzz');
  ok(await page.locator('.combo-empty').isVisible(),'no-match state visible');
  await page.locator('.combo-input').press('Enter');
  ok(await page.locator('#test-picker').inputValue()==='silva','empty result cannot select stale row');
  await page.locator('.combo-input').press('Escape');
  ok(await page.locator('.combo-face').evaluate(el=>el===document.activeElement),'Escape returns focus');
  await page.locator('.combo-face').click();
  ok(await page.locator('.combo-item[data-value="disabled"]').count()===0,'disabled choices excluded');
  await page.locator('#outside').click();
  ok(await page.locator('#outside').evaluate(el=>el===document.activeElement),'outside click keeps intended focus');
  ok(!await page.locator('.combo').evaluate(el=>el.classList.contains('is-open')),'outside click closes picker');
  await page.evaluate(()=>{document.querySelector('select').disabled=true;});
  await page.waitForTimeout(50);
  ok(await page.locator('.combo-face').isDisabled(),'disabled native control disables custom picker');
  ok(errors.length===0,'no browser script errors');
  for(const [username,password,expected] of [['admin','admin123',200],['reception','reception123',403],['drsilva','doctor123',403],['nimasha','patient123',403]]) {
   const ctx=await browser.newContext();
   const login=await ctx.request.post(BASE+'/api/auth/login',{data:{username,password}});ok(login.ok(),username+' signs in');
   for(const [method,path] of [['get','/api/reports'],['get','/api/reports/patient-records.txt/content'],['get','/api/reports/patient-records.txt/download'],['post','/api/reports/refresh']]) {
    const response=await ctx.request[method](BASE+path);ok(response.status()===expected,username+' '+method+' '+path+' = '+expected);
   }
   await ctx.close();
  }
  console.log(`PASS: ${checks} real-browser/API checks`);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
