const assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/upgraded.html');
  const preview=await page.evaluate(async()=>{
   await DrawingHand.ready;
   const c=document.createElement('canvas');c.width=1800;c.height=540;
   const g=c.getContext('2d');g.fillStyle='#f3eee4';g.fillRect(0,0,c.width,c.height);
   [.15,.42,.80].forEach((v,i)=>{
    g.save();g.beginPath();g.rect(i*600,0,600,540);g.clip();g.translate(i*600,0);
    g.fillStyle='#203640';g.font='24px sans-serif';g.fillText(['위쪽 — 팔 전체 회전','중간 — 팔 전체 회전','아래쪽 — 팔 전체 회전'][i],30,45);
    DrawingHand.draw(g,{lift:0},{x:65,y:270},{x:65-.45*980,y:270-v*1306,w:980,h:1306},5000,true);
    g.restore();
   });return c.toDataURL();
  });
  const fs=require('node:fs'),path=require('node:path'),out=path.join(root,'.test-output/original-arm');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'wrist-positions.png'),Buffer.from(preview.split(',')[1],'base64'));
  const result=await page.evaluate(async()=>{
   await DrawingHand.ready;const im=DrawingHand.poses.draw.image;source=im;
   const probe=document.createElement('canvas');probe.width=1080;probe.height=1920;
   const pg=probe.getContext('2d',{willReadFrequently:true});
   for(const enabled of [true,false])for(const x of [90,540,960])for(const y of [300,900,1500]) {
    pg.clearRect(0,0,1080,1920);DrawingHand.draw(pg,{lift:0},{x,y},BOARD,5000,enabled);
    const bottom=pg.getImageData(0,1919,1080,1).data,right=pg.getImageData(1079,0,1,1920).data;
    const edge=[bottom,right].some(row=>row.some((v,i)=>i%4===3&&v>240));
    if(!edge)throw new Error('Arm terminates inside frame at '+[x,y,enabled]);
    const anchor=pg.getImageData(x-2,y-2,5,5).data;
    if(!anchor.some((v,i)=>i%4===3&&v>100))throw new Error('Graphite missed the contact point');
   }
   const b=prepare(im);analysis=analyzeFace(b,findFace(b.rgba,b.gw,b.gh));
   styleSelect.value='croquis';messageInput.value='';signatureToggle.checked=false;
   const cases=[];
   for(const [duration,hand,motion] of [[4,true,true],[30,true,true],[60,true,true],[30,true,false],[30,false,true]]){
    seconds.value=duration;handToggle.checked=hand;handMotionToggle.checked=motion;rebuild();
    const rests=plan.strokes.filter(s=>s.restMs);
    const soundQuiet=rests.every(s=>plan.audio.every(e=>e.end<=s.tLift || e.start>=s.tLift+s.restMs));
    const last=plan.strokes.at(-1)?.tUp||0;
    renderFrame(plan.totalMs);renderFrame(plan.totalMs*.4);
    cases.push({duration,hand,motion,rests:rests.length,soundQuiet,last,total:plan.totalMs});
   }
   return cases;
  });
  for(const r of result){assert(r.soundQuiet,'Pencil audio overlaps rest');assert(r.last<=r.total);assert.equal(r.rests>0,false);}
  assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(result,null,2));
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
};
