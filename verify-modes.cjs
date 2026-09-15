const assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/');
  assert.equal(await page.inputValue('#programMode'),'index.html');
  assert.equal(await page.inputValue('#seconds'),'20');
  assert.equal(await page.inputValue('#style'),'ai');
  assert.equal(await page.locator('#handMotion').count(),0);
  await Promise.all([page.waitForURL('**/upgraded.html'),page.selectOption('#programMode','upgraded.html')]);
  await page.waitForFunction(()=>typeof DrawingHand!=='undefined');
  assert.equal(await page.inputValue('#seconds'),'30');
  assert.equal(await page.inputValue('#style'),'croquis');
  assert(await page.locator('#handMotion').isChecked());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+'/.test-output/mode-upgraded.png',fullPage:true});
  await Promise.all([page.waitForURL('**/index.html'),page.selectOption('#programMode','index.html')]);
  assert.equal(await page.inputValue('#seconds'),'20');
  assert.equal(await page.inputValue('#style'),'ai');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:root+'/.test-output/mode-classic.png',fullPage:true});
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS: classic default, optional upgrade, return to classic, mobile layout, no JS errors');
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
};
