const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 const out=path.join(root,'.test-output/draft');fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/atelier.html`);
 await page.evaluate(()=>{window.analysisCalls=0;const original=analyzePhoto;analyzePhoto=async(...args)=>{window.analysisCalls++;return original(...args);};});
 const first=path.join(process.env.TEMP,'codex-clipboard-509fc13f-3f5b-438c-bd00-e47ec3087046.jpg');
 await page.setInputFiles('#photo',[first,first,first]);await page.waitForFunction(()=>photos.length===3&&!photoInput.disabled);
 assert.equal(await page.evaluate(()=>window.analysisCalls),0);assert(await page.evaluate(()=>photos.every(p=>!p.analysis)));assert.match(await page.textContent('#fileName'),/^3장/);
 await page.locator('.photo-order button').filter({hasText:'삭제'}).last().click();assert.match(await page.textContent('#fileName'),/^2장/);
 await page.selectOption('#wordsPhoto','0');await page.fill('#title','첫 번째 사진');await page.fill('#message','첫 번째 사진의 편지');
 await page.selectOption('#wordsPhoto','1');await page.fill('#title','두 번째 사진');await page.fill('#message','두 번째 사진의 편지');
 await page.selectOption('#wordsPhoto','0');assert.equal(await page.inputValue('#message'),'첫 번째 사진의 편지');
 await page.click('#createArtwork');assert(await page.locator('#processingNotice').isVisible());await page.waitForFunction(()=>photos.every(p=>p.analysis)&&plan&&!photoInput.disabled,null,{timeout:240000});assert.equal(await page.evaluate(()=>window.analysisCalls),2);
 await page.evaluate(()=>{seconds.value=4;rebuild();prepareProject();renderProject(0);});assert.equal(await page.inputValue('#title'),'첫 번째 사진');
 await page.evaluate(()=>renderProject(4000));assert.equal(await page.inputValue('#title'),'두 번째 사진');await page.evaluate(()=>{restoreSelectedPhoto();renderFrame(plan.totalMs);});
 const before=await page.locator('.canvas-wrap').evaluate(e=>e.getBoundingClientRect().width);await page.click('#shrinkCanvas');const after=await page.locator('.canvas-wrap').evaluate(e=>e.getBoundingClientRect().width);assert(after<before);await page.click('#expandCanvas');assert.equal(await page.getAttribute('#expandCanvas','aria-pressed'),'true');
 const downloads=[];page.on('download',d=>downloads.push(d));await page.click('#saveStill');await page.waitForFunction(()=>document.querySelectorAll('#stillDownloads a').length===2&&!photoInput.disabled,null,{timeout:60000});
 assert.equal(downloads.length,2);assert.notEqual(downloads[0].suggestedFilename(),downloads[1].suggestedFilename());for(let i=0;i<downloads.length;i++)await downloads[i].saveAs(path.join(out,`photo-${i+1}.png`));
 assert.notDeepEqual(fs.readFileSync(path.join(out,'photo-1.png')),fs.readFileSync(path.join(out,'photo-2.png')));
 const video=page.waitForEvent('download',{timeout:180000});await page.click('#export');await(await video).saveAs(path.join(out,'two-photos.mp4'));await page.waitForFunction(()=>!exportButton.disabled);
 await page.click('#resetProject');assert.equal(await page.locator('.photo-item').count(),0);assert.equal(await page.inputValue('#message'),'');assert.equal(await page.inputValue('#title'),'');assert.equal(await page.inputValue('#framing'),'face');assert.equal(await page.inputValue('#style'),'ai');assert.equal(await page.locator('#stillDownloads a').count(),0);assert(await page.evaluate(()=>!analysis&&!plan&&projectSegments.length===0));
 await page.setInputFiles('#photo',[first]);await page.waitForFunction(()=>photos.length===1&&!photoInput.disabled);assert.equal(await page.evaluate(()=>window.analysisCalls),2);assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: deferred analysis, deletion before processing, photo-specific words, shrink, separate PNGs, multi-photo video, clean reset');
 }finally{await browser.close();server.close();}
};
