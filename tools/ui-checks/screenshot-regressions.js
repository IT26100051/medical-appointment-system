/* Narrow, read-only Chromium regression for the user-reported screenshots. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const BASE=process.env.CLINIC || 'http://localhost:8080';
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});let count=0;
 const check=(ok,msg)=>{assert.ok(ok,msg);count++;console.log('PASS '+msg);};
 try {
  const ctx=await browser.newContext({viewport:{width:1366,height:1000}});
  await ctx.request.post(BASE+'/api/auth/login',{data:{username:'admin',password:'admin123'}});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/app#/appointmentNew');
  for(const id of ['bkDoctor','bkPatient']) {
   const wrapper=page.locator('#'+id).locator('..');
   await wrapper.locator('.combo-face').click();
   const images=wrapper.locator('.combo-list img.avatar-img');
   await images.first().waitFor();
   await page.waitForFunction(id=>[...document.querySelector('#'+id).parentElement.querySelectorAll('.combo-list img')].every(i=>i.complete && i.naturalWidth>0),id);
   await page.waitForTimeout(400);
   check(await images.count()>0,id+' offers real photographs');
   check(await images.evaluateAll(xs=>xs.every(i=>{let r=i.getBoundingClientRect();return r.width===38 && r.height===38;})),id+' images sized to 38px, not intrinsic oversized images');
   check(!(await wrapper.textContent()).includes('Bad Actor'),id+' has no security-test fixture');
   await wrapper.locator('.combo-input').press('Escape');
  }
  await page.locator('.nav-item[data-view="waitingRoom"]').click();
  const absent=page.locator('[data-absent]').first();await absent.waitFor();
  const fg=await absent.evaluate(e=>getComputedStyle(e).color);
  check(fg!=='rgb(255, 255, 255)' && fg!=='rgba(0, 0, 0, 0)','Did not arrive uses dark foreground on light table');
  await absent.hover();check(await absent.evaluate(e=>getComputedStyle(e).color)!=='rgb(255, 255, 255)','action remains readable on hover');
  const patients=await (await ctx.request.get(BASE+'/api/patients?q=Bad%20Actor')).json();
  check(patients.count===0,'known security fixture removed from patient directory');
  check(errors.length===0,'admin screens have no script errors');
  await ctx.close();
  for(const width of [1366,768,390]) {
   const patient=await browser.newContext({viewport:{width,height:900}});
   await patient.request.post(BASE+'/api/auth/login',{data:{username:'nimasha',password:'patient123'}});
   const p=await patient.newPage();await p.goto(BASE+'/app#/appointments');
   await p.locator('#bookNow').waitFor();
   check(await p.locator('.appointment-controls').count()===1,width+'px uses grouped appointment controls');
   for(const selector of ['#bookNow','.appointment-controls .search-box']) {
    check(await p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0 && r.right<=innerWidth+1 && r.width>0;}),width+'px '+selector+' fits viewport');
   }
   await p.waitForTimeout(900);
   if(width===1366) await p.screenshot({path:'/tmp/appointments-fixed.png'});
   await patient.close();
  }
  console.log(`PASS ${count} screenshot regression checks`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
