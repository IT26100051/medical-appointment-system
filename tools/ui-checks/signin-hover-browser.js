/* Regression for the real sign-in label, not just its parent element. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox']});
 let checks=0;
 try {
  for(const width of [1440,1024,768,375]) {
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto(process.env.CLINIC || 'http://localhost:8080');
   const button=page.locator('#portalBtn');
   for(const state of ['normal','hover','leave','focus','hover-again']) {
    if(state.includes('hover')) await button.hover();
    if(state==='leave') await page.mouse.move(0,850);
    if(state==='focus') await button.focus();
    await page.waitForTimeout(200);
    const result=await button.evaluate(el=>{
     const label=el.querySelector('.portal-label'),s=getComputedStyle(label),r=label.getBoundingClientRect(),b=el.getBoundingClientRect();
     const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     return {text:label.textContent,color:s.color,fill:s.webkitTextFillColor,opacity:s.opacity,visibility:s.visibility,
      contained:r.x>=b.x && r.right<=b.right && r.right<=innerWidth && r.x>=0,
      unobstructed:el.contains(hit),transform:getComputedStyle(el).transform};
    });
    assert.equal(result.text,'Patient sign in');
    assert.equal(result.color,'rgb(255, 255, 255)');
    assert.equal(result.fill,result.color);assert.equal(result.opacity,'1');assert.equal(result.visibility,'visible');
    assert.ok(result.contained,`${width} ${state}: label clipped`);assert.ok(result.unobstructed,`${width} ${state}: label covered`);
    assert.equal(result.transform,'none');checks++;
   }
   await button.hover();
   if(width===1440) await page.screenshot({path:'/tmp/medcare-hover-desktop.png'});
   if(width===375) await page.screenshot({path:'/tmp/medcare-hover-mobile.png'});
   await button.click();await page.waitForURL('**/login');assert.ok(await page.locator('input[type="password"]').isVisible());checks++;
   await page.close();
  }
  console.log(`PASS ${checks} sign-in state/navigation checks across 4 widths`);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
