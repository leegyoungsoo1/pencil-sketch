const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;
  await page.route('**/studio-graphite.js*',route=>++requests===1?route.abort():route.continue());
  await page.goto(`http://127.0.0.1:${server.address().port}/atelier.html`);
  assert.equal(await page.evaluate(()=>typeof window.StudioGraphite),'undefined');
  await page.setInputFiles('#photo',process.env.SKETCH_TEST_IMAGE||path.join(process.env.USERPROFILE,'Desktop','ai테스트','임영웅1.jpg'));await page.waitForFunction(()=>photos.length&&!photoInput.disabled);
  await page.click('#createArtwork');await page.waitForFunction(()=>plan&&!photoInput.disabled,null,{timeout:240000});
  assert(await page.evaluate(()=>window.StudioGraphite&&plan.strokes.length>0));assert(requests>=2);assert.equal(errors.length,0,errors.join('\n'));
  await page.locator('#canvas').screenshot({path:path.join(root,'.test-output/engine-recovered.png')});console.log('PASS: initially blocked engine recovered and photograph rendered');
  const broken=await browser.newPage();await broken.route('**/studio-graphite.js*',r=>r.abort());await broken.goto(`http://127.0.0.1:${server.address().port}/atelier.html`);
  await broken.setInputFiles('#photo',path.join(root,'assets/site/portrait.webp'));await broken.waitForFunction(()=>photos.length&&!photoInput.disabled);await broken.click('#createArtwork');
  await broken.waitForFunction(()=>!photoInput.disabled&&document.querySelector('#processingNotice').textContent.includes('엔진'));
  assert(await broken.locator('#processingNotice').isVisible());assert(await broken.evaluate(()=>photos.length===1&&!photos[0].analysis));console.log('PASS: persistent failure gives actionable error and retains uploaded photo');
 }finally{await browser.close();server.close();}
};
