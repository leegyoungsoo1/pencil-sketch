const { chromium } = require(require.resolve('playwright', {paths:[__dirname, (process.env.USERPROFILE || '') + '/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules']}));
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root=__dirname; fs.mkdirSync(path.join(root,'.test-output'),{recursive:true});
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]==='/'?'/index.html':req.url.split('?')[0]));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'application/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp'})[path.extname(p)]||'application/octet-stream');res.end(b);});});
if (process.argv.includes('--modes')) require('./verify-modes.cjs')({chromium,server,root});
else if (process.argv.includes('--inspect-videos')) require('./verify-videos.cjs')({chromium,server,root});
else if (process.argv.includes('--hand-controls')) require('./verify-hand-controls.cjs')({chromium,server,root});
else if (process.argv.includes('--portraits')) require('./validate-photos.cjs')({chromium,server,root});
else (async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});try{
const page=await browser.newPage({viewport:{width:1400,height:1000}});let errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/upgraded.html');await page.waitForFunction(()=>typeof buildPlan==='function');await page.evaluate(()=>styleSelect.value='faithful');
const result=await page.evaluate(async()=>{
 const im=new Image();im.src='assets/hand-right.webp';await im.decode(); source=im;
 const b=prepare(im);analysis=analyzeFace(b,findFace(b.rgba,b.gw,b.gh)); signatureInput.value='David Lee.'; titleInput.value='마음을 담은 한 장\n오늘도 행복하세요';messageInput.value='오늘도 건강하세요';
 await document.fonts.load('200px '+MESSAGE_FONT,messageInput.value);
 const out=[];
 for(const duration of [4,30,60]){seconds.value=duration;rebuild();out.push({duration,drawEnd:plan.drawEndMs,last:Math.max(...plan.strokes.map(s=>s.tUp)),total:plan.totalMs,count:plan.strokes.length,valid:plan.strokes.every(s=>Number.isFinite(s.tDown)&&s.tDown>=0&&s.tUp>s.tDown)});}
 seconds.value=30;rebuild();renderFrame(plan.totalMs);const final=canvas.toDataURL();renderFrame(2000);renderFrame(plan.totalMs);const deterministic=final===canvas.toDataURL();return {out,deterministic};
});assert(result.deterministic,'seeking must reproduce final frame');for(const x of result.out){assert(x.valid,JSON.stringify(x));assert(x.last<=x.total,JSON.stringify(x));}
await page.evaluate(()=>renderFrame(plan.totalMs));await page.locator('#canvas').screenshot({path:'.test-output/test-finished.png'});await page.locator('#seek').fill('450');await page.locator('#seek').dispatchEvent('input');await page.locator('#compare').click();assert.equal(await page.locator('#compare').getAttribute('aria-pressed'),'true');await page.locator('#compare').click();
await page.locator('details.settings > summary').click();
for(const mode of ['line','shade','faithful']){await page.selectOption('#style',mode);await page.evaluate(()=>renderFrame(plan.totalMs));}
const download=page.waitForEvent('download');await page.locator('#saveStill').click();await (await download).saveAs('.test-output/test-export.png');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.test-output/test-mobile.png',fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile overflow');
const encoding=await page.evaluate(async()=>{seconds.value=4;messageInput.value='';signatureToggle.checked=false;rebuild();const enc=await pickEncoders('mp4',true);if(!enc)return {supported:false};const blob=await buildVideo('mp4',enc,()=>{});const v=document.createElement('video');v.src=URL.createObjectURL(blob);await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j});return {supported:true,bytes:blob.size,duration:v.duration,w:v.videoWidth,h:v.videoHeight};});
const offline = await browser.newPage(); await offline.route('https://**/*', r=>r.abort()); await offline.goto('http://127.0.0.1:'+server.address().port+'/upgraded.html'); await offline.setInputFiles('#photo',path.join(root,'assets/hand-right.webp')); await offline.waitForFunction(()=>plan && document.querySelector('#busy').hidden,{},{timeout:60000}); await offline.close();
assert.equal(errors.length,0,errors.join('\n'));assert(encoding.supported);assert(encoding.bytes>10000);assert(encoding.duration>=4&&encoding.duration<4.5);assert.equal(encoding.w,1080);console.log(JSON.stringify({result,encoding,errors},null,2));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
