const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 const out=path.join(root,'.test-output/planes');fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/atelier.html`);
 await page.locator('.settings summary').click();await page.selectOption('#framing','closeup');await page.setInputFiles('#photo',process.env.SKETCH_TEST_IMAGE||path.join(process.env.USERPROFILE,'Desktop','ai테스트','임영웅1.jpg'));await page.waitForFunction(()=>photos.length&&!photoInput.disabled);await page.click('#createArtwork');await page.waitForFunction(()=>plan&&!photoInput.disabled,null,{timeout:240000});await page.evaluate(async()=>{await atelierReady;await DrawingHand.ready;});
 const metrics=await page.evaluate(()=>{
  const sweeps=plan.strokes.filter(s=>s.inkGroups),marks=sweeps.flatMap(s=>s.inkGroups.flat());let distance=0,minDuration=Infinity;
  for(const s of sweeps){minDuration=Math.min(minDuration,s.tUp-s.tDown);for(let i=0;i<s.n-1;i++)for(const mark of s.inkGroups[i])for(let j=0;j<mark.n;j++)distance=Math.max(distance,Math.hypot(mark.x[j]-s.x[i+1],mark.y[j]-s.y[i+1]));}
  return {total:plan.totalMs,sweeps:sweeps.length,deposited:marks.length,source:StudioGraphite.marks(analysis).filter(s=>s.kind!=='contour').length,unique:new Set(marks).size,minDuration,distance,summary:document.querySelector('#projectSummary').textContent};
 });console.log(metrics);assert.equal(metrics.deposited,metrics.source);assert.equal(metrics.unique,metrics.source);assert(metrics.distance<20);assert(Math.abs(metrics.total-120000)<1);assert(metrics.summary.includes('2분'));
 const regions=await page.evaluate(()=>{const list=StudioGraphite.marks(analysis).filter(s=>s.kind==='hatch'),labels=StudioGraphite.regions(analysis),bins=new Set();let crossing=0;for(const s of list){bins.add(Math.round(Math.atan2(s.y[2]-s.y[0],s.x[2]-s.x[0])*4));for(let i=0;i<s.n;i++){const x=Math.round(s.x[i]-analysis.b.x),y=Math.round(s.y[i]-analysis.b.y);if(labels[y*analysis.gw+x]!==s.region)crossing++;}}return {crossing,directions:bins.size};});console.log('regions',regions);assert.equal(regions.crossing,0);assert(regions.directions>8);
 const fidelity=await page.evaluate(()=>{
  handToggle.checked=false;renderFrame(plan.totalMs);const actual=ctx.getImageData(0,0,VIEW_W,VIEW_H).data,saved=plan;
  plan={...saved,strokes:StudioGraphite.marks(analysis).map(s=>({...s,tLift:0,tDown:0,tUp:1,alpha:s.alpha*(.8+Number(strength.value)/200)}))};resetInk();renderFrame(plan.totalMs);const expected=ctx.getImageData(0,0,VIEW_W,VIEW_H).data;let sum=0,max=0;for(let i=0;i<actual.length;i++){const d=Math.abs(actual[i]-expected[i]);sum+=d;max=Math.max(max,d);}plan=saved;resetInk();handToggle.checked=true;return {mean:sum/actual.length,max};
 });console.log('fidelity',fidelity);assert(fidelity.mean<.13&&fidelity.max<=10);
 // Adjacent 30fps frames add marks only around a short moving pencil path.
 const motion=await page.evaluate(()=>{const sweep=plan.strokes.find(s=>s.inkGroups&&s.len>25),samples=[];for(let t=sweep.tDown;t<sweep.tUp;t+=1000/30){renderFrame(t);const p=pencilAt(t);samples.push({time:t,x:p.x,y:p.y});}return samples;});assert(motion.length>=1);console.log('visible sweep samples',motion.length);
 // Extended drawing moves writing and speech together, retaining the outro.
 const writing=await page.evaluate(()=>{
  const sign={kind:'sign',n:2,x:new Float32Array([20,40]),y:new Float32Array([30,30]),pr:new Float32Array([1,1]),len:20,tLift:16800,tDown:17000,tUp:17500};
  const base={...plan,totalMs:20000,drawEndMs:16800,strokes:[sign],talk:{start:17000,end:17500,blinkAt:17200,beats:[{start:17050,end:17400}]}};
  const p=StudioGraphite.build(analysis,base,40),extension=p.totalMs-20000,last=p.strokes.at(-1);
  return {extension,start:last.tDown,drawEnd:p.drawEndMs,outro:p.totalMs-last.tUp,talkStart:p.talk.start,beat:p.talk.beats[0].start};
 });assert(writing.extension>0);assert.equal(writing.start,17000+writing.extension);assert.equal(writing.drawEnd,16800+writing.extension);assert(Math.abs(writing.outro-2500)<.001);assert.equal(writing.talkStart,writing.start);assert.equal(writing.beat,17050+writing.extension);
 // Variable-length projects use actual segment boundaries, including audio offsets.
 const timeline=await page.evaluate(()=>{const saved=projectSegments,p=plan,other={...photos[0],plan:{...p,totalMs:p.totalMs+1234}};projectSegments=[{item:photos[0],start:0},{item:other,start:p.totalMs}];const total=projectDuration();renderProject(p.totalMs+500);const crossed=plan===other.plan,local=cursor.time;projectSegments=saved;plan=p;resetInk();return {total,expected:p.totalMs*2+1234,crossed,local};});assert.equal(timeline.total,timeline.expected);assert(timeline.crossed);assert.equal(timeline.local,500);
 const frames=[];for(const seconds of [0,12,30,50,80,120]){await page.evaluate(t=>renderFrame(t*1000),seconds);const name=`frame-${seconds}.jpg`;fs.writeFileSync(path.join(out,name),Buffer.from(await page.evaluate(()=>canvas.toDataURL('image/jpeg',.9).split(',')[1]),'base64'));frames.push({name,seconds});}
 await page.evaluate(()=>renderFrame(plan.totalMs));fs.writeFileSync(path.join(out,'finished.jpg'),Buffer.from(await page.evaluate(()=>canvas.toDataURL('image/jpeg',.9).split(',')[1]),'base64'));
 // Export 18 seconds from the shading chapter at its actual speed, without
 // accelerating it. The full plan can be many minutes; avoid a huge test movie.
 for(const theme of ['atelier','atelier-garden','atelier-library'])for(const orientation of ['portrait','landscape']){
  await page.selectOption('#presentation',theme);await page.selectOption('#orientation',orientation);await page.evaluate(()=>renderFrame(plan.totalMs));
  assert(await page.evaluate(()=>isAtelier()&&currentAtelierPlate()?.complete));fs.writeFileSync(path.join(out,theme+'-'+orientation+'.jpg'),Buffer.from(await page.evaluate(()=>canvas.toDataURL('image/jpeg',.85).split(',')[1]),'base64'));
 }
 await page.selectOption('#presentation','atelier');await page.selectOption('#orientation','portrait');
 const encoded=await page.evaluate(async()=>{
  const original=plan,segments=projectSegments,chapter=plan.chapters.find(c=>c.name==='연필로 명암 칠하기'),offset=chapter.start+15000,duration=18000;
  const strokes=original.strokes.filter(s=>s.tDown<offset+duration).map(s=>({...s,tLift:s.tLift-offset,tDown:s.tDown-offset,tUp:s.tUp-offset}));
  plan={...original,totalMs:duration,strokes,audio:buildAudioEvents(strokes.filter(s=>s.tUp>0))};projectSegments=[];resetInk();session={};
  try{const encoders=await pickEncoders('mp4',true),blob=await buildVideo('mp4',encoders,()=>{},{disk:true});if(!(blob instanceof File))throw Error('Expected disk-backed export');const data=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.readAsDataURL(blob);});await videoCleanups.get(blob)?.();return data;}
  finally{session=null;plan=original;projectSegments=segments;resetInk();}
 });fs.writeFileSync(path.join(out,'pencil-shading.mp4'),Buffer.from(encoded,'base64'));
 if(process.argv.includes('--full')){const download=page.waitForEvent('download',{timeout:600000});await page.click('#export');await(await download).saveAs(path.join(out,'complete-two-minutes.mp4'));await page.waitForFunction(()=>!exportButton.disabled);console.log('PASS: full two-minute MP4 export');}
 fs.writeFileSync(path.join(out,'review.html'),`<!doctype html><meta charset="utf-8"><style>body{background:#eae7df;font:16px sans-serif;margin:20px}.frames{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0}img{width:100%}video{width:600px}</style><h1>좁은 연필 획으로 차근차근 쌓는 명암</h1><div class="frames">${frames.map(f=>`<figure><img src="${f.name}"><figcaption>${f.seconds}초</figcaption></figure>`).join('')}</div><video controls src="pencil-shading.mp4"></video>`);
 await page.goto(`http://127.0.0.1:${server.address().port}/.test-output/planes/review.html`);await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));const metadata=await page.locator('video').evaluate(v=>new Promise((resolve,reject)=>{v.onloadedmetadata=()=>resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight});v.onerror=()=>reject(Error('Encoded MP4 could not be decoded'));v.load();}));assert(Math.abs(metadata.duration-18)<.1,JSON.stringify(metadata));assert.equal(metadata.width,1080);console.log('MP4 playback metadata',metadata);await page.locator('.frames').screenshot({path:path.join(out,'review.jpg'),type:'jpeg',quality:85});assert.equal(errors.length,0,errors.join('\n'));console.log('PASS: tip-local marks, visible sweep duration, final fidelity, variable project timeline and actual-speed MP4');
 }finally{await browser.close();server.close();}
};
