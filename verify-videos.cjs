const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async({chromium,server,root})=>{
 const project=process.argv.includes('--project-demo');
 const directory=project?'project':process.argv.includes('--rhythm')?'rhythm':process.argv.includes('--original-arm')?'original-arm':process.argv.includes('--arm-v4')?'arm-v4':process.argv.includes('--arm')?'arm':process.argv.includes('--hands')?'hands':process.argv.includes('--croquis')?'croquis':'portraits';
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/.test-output/'+directory+'/review.html');
 const metadata=await page.evaluate(async()=>{const out=[];for(const v of document.querySelectorAll('video')){
  const blob=await (await fetch(v.currentSrc || v.src)).blob();v.src=URL.createObjectURL(blob);v.load();
  if(v.readyState<1)await new Promise((r,j)=>{v.onloadedmetadata=r;v.onerror=j;});
  v.currentTime=Math.min(29,v.duration-1);await new Promise((r,j)=>{v.onseeked=r;v.onerror=j;});
  if(v.readyState<2)await new Promise((r,j)=>{v.onloadeddata=r;v.onerror=j;});
  const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
  out.push({duration:v.duration,width:v.videoWidth,height:v.videoHeight,frame:c.toDataURL()});
 }return out;});
 assert.equal(metadata.length,project?2:process.argv.includes('--first')?1:3,'Check every requested video');
 metadata.forEach((m,i)=>{assert(Math.abs(m.duration-(project?[60,16][i]:30))<.1);assert.equal(m.width,project?1920:1080);assert.equal(m.height,project?1080:1920);fs.writeFileSync(path.join(root,'.test-output/'+directory,`${i+1}-decoded.png`),Buffer.from(m.frame.split(',')[1],'base64'));delete m.frame;});
 fs.writeFileSync(path.join(root,'.test-output/'+directory+'/video-validation.json'),JSON.stringify(metadata,null,2));console.log(metadata);
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
};
