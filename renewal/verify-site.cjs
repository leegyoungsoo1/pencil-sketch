const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 const out=path.join(root,'.test-output/renewal');fs.mkdirSync(out,{recursive:true});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('img[src^="assets/site/"]').count(),5);
  const images=await page.evaluate(async()=>{const ims=[...document.images];ims.forEach(im=>im.loading="eager");await Promise.all(ims.map(im=>im.decode()));return ims.every(im=>im.naturalWidth>0);});assert(images);
  const anchors=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].every(a=>document.querySelector(a.getAttribute('href'))));assert(anchors);
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:950});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow ${width}`);
   await page.screenshot({path:path.join(out,`home-${width}.png`),fullPage:true});
  }
  await page.locator('.faq summary').first().click();assert(await page.locator('.faq details').first().evaluate(e=>e.open));
  await page.locator('.faq summary').nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('.faq details[open]').length===1);assert.equal(await page.locator('.faq details[open]').count(),1);
  await page.locator('.site-header .button').click();await page.waitForURL('**/atelier.html');
  assert.equal(await page.inputValue('#style'),'graphite');assert.equal(await page.inputValue('#framing'),'face');assert.equal(await page.locator('#programMode').count(),0);
  await page.setViewportSize({width:1440,height:1000});
  assert(await page.evaluate(()=>Math.abs(document.querySelector('#stage').getBoundingClientRect().width-document.querySelector('.layout').getBoundingClientRect().width)<2));
  await page.click('#expandCanvas');assert.equal(await page.getAttribute('#expandCanvas','aria-pressed'),'true');await page.click('#expandCanvas');
  await page.screenshot({path:path.join(out,'studio-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(out,'studio-mobile.png'),fullPage:true});
  await page.goto(`http://127.0.0.1:${server.address().port}/classic.html`);await page.waitForURL('**/atelier.html');assert.equal(await page.inputValue('#style'),'graphite');
  assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: 5 generated images, all images decode, anchors, FAQ, four widths, studio and classic navigation');
 }finally{await browser.close();server.close();}
};
