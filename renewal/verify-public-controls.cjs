const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/atelier.html`);
 const file={name:'sample.webp',mimeType:'image/webp',buffer:fs.readFileSync(path.join(root,'assets/site/portrait.webp'))};
 await page.setInputFiles('#photo',[file,file]);await page.waitForFunction(()=>photos.length===2&&!photoInput.disabled);
 await page.fill('#title','우리의 추억');await page.check('#signature');await page.fill('#signatureText','Our family');await page.selectOption('#titleFont','Nanum Brush Script');await page.fill('#message','첫 편지');await page.selectOption('#wordsPhoto','1');
 assert.equal(await page.inputValue('#title'),'우리의 추억');assert.equal(await page.inputValue('#signatureText'),'Our family');assert(await page.isChecked('#signature'));assert.equal(await page.inputValue('#titleFont'),'Nanum Brush Script');assert.equal(await page.inputValue('#message'),'');
 await page.fill('#message','둘째 편지');await page.selectOption('#wordsPhoto','0');assert.equal(await page.inputValue('#message'),'첫 편지');await page.uncheck('#signature');await page.selectOption('#wordsPhoto','1');assert(!(await page.isChecked('#signature')));
 await page.locator('.settings summary').click();for(const [id,expected] of [['seconds',30],['darkness',110],['strength',50]]){await page.locator('#'+id+'Num').evaluate(e=>{e.stepUp();e.dispatchEvent(new Event('change'));});assert.equal(await page.inputValue('#'+id),String(expected));}
 // A panoramic source uses the available width without cropping or distortion.
 assert(await page.evaluate(()=>{stopPlayback();analysis={b:{x:12,y:320,w:696,h:320}};document.querySelector('#framing').value='original';document.querySelector('#orientation').value='landscape';configureLayout();const a=sheetToView(12,320),b=sheetToView(708,640),roundtrip=viewToSheet(a.x,a.y);return BOARD.w>1700&&a.x>=0&&b.x<=1920&&a.y>=0&&b.y<=1080&&Math.abs((b.x-a.x)/(b.y-a.y)-696/320)<.001&&Math.abs(roundtrip.y-320)<.001;}));
 await page.click('#resetProject');assert.equal(await page.inputValue('#signatureText'),'');assert(!(await page.isChecked('#signature')));assert.equal(await page.inputValue('#titleFont'),'Nanum Pen Script');assert.equal(await page.inputValue('#seconds'),'20');assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: common signature/font, separate letters, 10-unit controls, panoramic bounds, clean defaults');
 }finally{await browser.close();server.close();}
};
