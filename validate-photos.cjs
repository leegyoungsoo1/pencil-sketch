const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
module.exports = async ({chromium,server,root}) => {
  const out = path.join(root,'.test-output',process.argv.includes('--rhythm') ? 'rhythm' : process.argv.includes('--original-arm') ? 'original-arm' : process.argv.includes('--arm-v4') ? 'arm-v4' : process.argv.includes('--arm') ? 'arm' : process.argv.includes('--hands') ? 'hands' : process.argv.includes('--croquis') ? 'croquis' : 'portraits'); fs.mkdirSync(out,{recursive:true});
  const files = ['509fc13f-3f5b-438c-bd00-e47ec3087046','dc3312a1-7a44-4b96-a3d7-8110231a58c6','b439deaf-c097-4112-9902-fd1e46a3d8fc'];
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const results=[];
  try {
    for(let i=0;i<(process.argv.includes('--first')?1:files.length);i++) {
      const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:'+server.address().port+'/upgraded.html');
      await page.uncheck('#autoSuggest');
      await page.evaluate(mode=>styleSelect.value=mode,process.argv.includes('--croquis')?'croquis':'faithful');
      await page.setInputFiles('#photo',path.join(process.env.TEMP,'codex-clipboard-'+files[i]+'.jpg'));
      await page.waitForFunction(()=>plan && document.querySelector('#busy').hidden,null,{timeout:180000});
      const data=await page.evaluate(async index=>{
        titleInput.value=['차 한 잔의 여유','마음을 전하는 순간','잠시 쉬어 가세요'][index];
        messageInput.value='오늘도 건강하세요'; seconds.value=30;
        await ensureTitleFont();await ensureDrawingFonts();await DrawingHand.ready;rebuild();
        const pauses=plan.strokes.filter(s=>s.restMs).map(s=>({start:s.tLift,ms:s.restMs}));
        const poseNames=Object.keys(DrawingHand.poses);
        const pausedInk=pauses.every(p=>{renderFrame(p.start+1);const a=ink.toDataURL();renderFrame(p.start+p.ms-1);return a===ink.toDataURL();});
        const timings=plan.strokes.every((s,j)=>s.tDown>=s.tLift+(s.restMs||0)-.001 && s.tUp>s.tDown && (!j||s.tLift>=plan.strokes[j-1].tUp-.001));
        const marks = plan.strokes.filter(s=> !['sign','dot'].includes(s.kind));
        const audioSync=plan.audio.length===plan.strokes.length && plan.audio.every((e,j)=>{
          const s=plan.strokes[j];return e.start===s.tDown&&e.end===s.tUp&&e.samples[0].level===0&&e.samples.at(-1).level===0&&e.samples.every(p=>Number.isFinite(p.speed)&&p.freq>=1300&&p.freq<=3600&&p.time>=e.start&&p.time<=e.end+.000001);
        });
        const dynamicAudio=plan.audio.some(e=>Math.max(...e.samples.map(p=>p.speed))>Math.min(...e.samples.map(p=>p.speed))*1.5);
        const noRaster = !plan.aiLayer && marks.every(s=>!s.ai);
        resetInk();renderFrame(plan.drawEndMs);const direct=ink.toDataURL();
        resetInk();for(let t=0;t<plan.drawEndMs;t+=200)renderFrame(t);renderFrame(plan.drawEndMs);
        const deterministic=direct===ink.toDataURL();
        const frames=[];
        for(const t of [0,5000,15000,25000,30000,...pauses.map(p=>p.start+p.ms*.5)]){renderFrame(t);frames.push(canvas.toDataURL());}
        const sample=pauses.length?pauses[0].start+pauses[0].ms*.32:5000;
        renderFrame(sample);const handFrame=canvas.toDataURL();renderFrame(0);renderFrame(sample);
        const handDeterministic=handFrame===canvas.toDataURL();
        const compare=document.createElement('canvas');compare.width=W*2;compare.height=H;
        const g=compare.getContext('2d');g.fillStyle='#faf7f0';g.fillRect(0,0,W*2,H);
        g.drawImage(analysis.work,analysis.b.x,analysis.b.y);if(plan.aiLayer)g.drawImage(plan.aiLayer,W,0,W,H);else {renderFrame(plan.totalMs);g.drawImage(ink,W,0,W,H);}
        return {audioSync,dynamicAudio,noRaster,deterministic,pausedInk,pauses,poseNames,timings,handDeterministic,frames,compare:compare.toDataURL(),face:analysis.face,crop:analysis.crop,grid:[analysis.gw,analysis.gh],strokes:plan.strokes.length,stats:plan.stats, rasterReveal:!!plan.aiLayer, aiSource:!!analysis.ai};
      },i);
      assert(data.deterministic,'Seeking changes accumulated ink');
      assert(data.audioSync,'Audio must match each actual stroke and stop at lift');
      assert(data.dynamicAudio,'Audio must follow nonuniform movement speed');
      assert(data.pausedInk,'Ink must stop during finger relaxation');
      assert(data.timings,'Stroke timeline overlaps or is invalid');
      assert(data.handDeterministic,'Seeking changes hand pose');
      assert.deepEqual(data.poseNames,['draw'],'One continuous arm image must load');
      assert.equal(data.pauses.length,0,'Finger-rest pauses must be removed');
      if(process.argv.includes('--croquis'))assert(data.noRaster,'Croquis must not reveal a raster');
      data.frames.forEach((v,k)=>fs.writeFileSync(path.join(out,`${i+1}-frame-${k}.png`),Buffer.from(v.split(',')[1],'base64')));
      fs.writeFileSync(path.join(out,`${i+1}-compare.png`),Buffer.from(data.compare.split(',')[1],'base64'));
      delete data.frames;delete data.compare;
      console.log('PHOTO',i+1,JSON.stringify(data));
      if(!process.argv.includes('--stills')) {
        const download=page.waitForEvent('download',{timeout:240000});
        await page.click('#export');const dl=await download;await dl.saveAs(path.join(out,`${i+1}-portrait.mp4`));
        data.videoBytes=fs.statSync(path.join(out,`${i+1}-portrait.mp4`)).size;
      }
      assert.equal(errors.length,0,errors.join('\n'));
      results.push({photo:i+1,...data,errors});await page.close();
    }
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
};
