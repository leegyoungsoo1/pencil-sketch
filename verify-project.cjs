const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
const out=path.join(root,'.test-output/project');fs.mkdirSync(out,{recursive:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/upgraded.html`);
 assert.equal(await page.inputValue('#signatureText'),'David Lee.');
 await page.waitForFunction(()=>backgroundImages.size===10);
 await page.selectOption('#signaturePreset','Yoonseul Lee.');assert.equal(await page.inputValue('#signatureText'),'Yoonseul Lee.');
 await page.fill('#signatureText','My Letter.');assert.equal(await page.inputValue('#signaturePreset'),'custom');
 await page.selectOption('#signaturePreset','David Lee.');
 await page.selectOption('#singer','none');assert.equal(await page.inputValue('#message'),'');assert.equal(await page.inputValue('#title'),'');
 const first=path.join(process.env.TEMP,'codex-clipboard-509fc13f-3f5b-438c-bd00-e47ec3087046.jpg');
 await page.setInputFiles('#photo',[first]);await page.waitForFunction(()=>plan&&busyBox.hidden,null,{timeout:180000});
 assert.equal(await page.inputValue('#message'),'');
 assert(await page.locator('.photo-order button').first().isDisabled());
 // Repeat the one authorized test image to exercise an actual two-photo upload and edit sequence.
 await page.setInputFiles('#photo',[first]);await page.waitForFunction(()=>photos.length===2&&busyBox.hidden,null,{timeout:180000});
 await page.locator('.photo-order button').nth(0).evaluate(b=>b.closest('.photo-item').querySelectorAll('button')[2].click());
 const letter=['오늘도 당신의 노래로','따뜻한 아침을 맞습니다.','창가에 햇살이 내려와','마음에도 빛이 듭니다.','바쁜 날에도 잠시 쉬며','차 한 잔의 여유를 갖고','소중한 사람을 떠올려요.','언제나 건강하시고','좋은 일들이 가득하길','진심으로 응원합니다.','내일도 웃는 얼굴로','다시 만나길 바랍니다.'].join('\n');
 await page.fill('#message',letter);await page.fill('#title','차 한 잔에 담은 마음');
 await page.selectOption('#titleFont','Nanum Pen Script');
 await page.locator('details.settings > summary').click();await page.selectOption('#orientation','landscape');
 await page.locator('[data-background="hanok"]').click();
 assert.equal(await page.inputValue('#presentation'),'hanok');
 const stats=await page.evaluate(async()=>{
   await ensureDrawingFonts();seconds.value=8;rebuild();prepareProject();
   const result={count:photos.length,total:projectDuration(),letter:plan.letter,lines:wrapLetter(messageInput.value).length,
    valid:projectSegments.every(({item})=>item.plan.strokes.every(s=>Number.isFinite(s.tDown)&&s.tDown>=0&&s.tUp>s.tDown&&s.tUp<=item.plan.totalMs)),
    audio:projectAudio().every(e=>e.samples.every(s=>s.time>=e.start&&s.time<=e.end+.001))};
   const pixels=()=>ctx.getImageData(0,0,canvas.width,canvas.height).data;
   const close=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<=1); // GPU image resampling can round one channel by one level.
   renderProject(8000);const start=pixels();renderFrame(0);result.boundary=close(start,pixels());
   renderProject(16000);const final=canvas.toDataURL(),finalPixels=pixels();renderProject(2500);renderProject(16000);result.deterministic=close(finalPixels,pixels());
   result.final=final;return result;
 });
 assert(stats.valid);assert(stats.audio);assert(stats.boundary);assert(stats.deterministic);assert.equal(stats.total,16000);assert.equal(stats.lines,12);assert(stats.letter);
 fs.writeFileSync(path.join(out,'landscape.png'),Buffer.from(stats.final.split(',')[1],'base64'));delete stats.final;
 const dl=page.waitForEvent('download',{timeout:240000});await page.click('#export');await(await dl).saveAs(path.join(out,'two-photos.mp4'));
 const metadata=await page.evaluate(async()=>{const v=document.createElement('video');v.src='.test-output/project/two-photos.mp4';await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j;});return {width:v.videoWidth,height:v.videoHeight,duration:v.duration};});
 assert.equal(metadata.width,1920);assert.equal(metadata.height,1080);assert(metadata.duration>=16&&metadata.duration<16.2);
 const png=page.waitForEvent('download');await page.click('#saveStill');await(await png).saveAs(path.join(out,'finished.png'));
 await page.selectOption('#orientation','portrait');await page.evaluate(()=>{rebuild();renderFrame(plan.totalMs);});
 await page.locator('#canvas').screenshot({path:path.join(out,'portrait.png')});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
 await page.screenshot({path:path.join(out,'mobile.png'),fullPage:true});
 await page.locator('.photo-order button').filter({hasText:'삭제'}).first().click();assert.equal(await page.locator('.photo-item').count(),1);
 await page.selectOption('#orientation','landscape');
 const longAudio=await page.evaluate(async()=>{seconds.value=60;rebuild();prepareProject();const enc=await pickEncoders('mp4',true);const chunks=await encodePencilAudio(enc.audio.config,60);return {count:chunks.length,last:chunks.at(-1).chunk.timestamp,ordered:chunks.every((v,i)=>!i||v.chunk.timestamp>=chunks[i-1].chunk.timestamp)};});
 assert(longAudio.ordered&&longAudio.last>59000000);
 await page.evaluate(()=>renderFrame(plan.totalMs));
 const finalPng=page.waitForEvent('download');await page.click('#saveStill');await(await finalPng).saveAs(path.join(out,'letter-60s.png'));
 const demo=page.waitForEvent('download',{timeout:600000});await page.click('#export');await(await demo).saveAs(path.join(out,'letter-60s.mp4'));
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({stats,metadata,errors},null,2));
 fs.writeFileSync(path.join(out,'review.html'),'<!doctype html><meta charset="utf-8"><title>편지와 롱폼 검증</title><style>body{background:#f6f0e3;font:20px sans-serif;margin:30px}video,img{max-width:100%;max-height:80vh}section{margin:30px 0}</style><h1>편지와 롱폼</h1><p>첫 번째 사진 · 한옥 배경 · 12줄 편지 · 60초</p><section><video controls src="letter-60s.mp4"></video></section><section><img src="letter-60s.png"></section><h2>사진 연결 검증</h2><p>같은 첫 번째 사진 두 장 · 8초씩 총 16초</p><section><video controls src="two-photos.mp4"></video></section><section><img src="landscape.png"></section><section><img src="portrait.png"></section>');
 console.log(JSON.stringify({stats,metadata,longAudio,errors},null,2));
}finally{await browser.close();server.close();}
};
