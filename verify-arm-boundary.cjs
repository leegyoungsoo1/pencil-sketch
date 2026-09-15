const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={window:{},Image:class {width=1085;async decode(){}}};
vm.runInNewContext(fs.readFileSync('hand-motion.js','utf8'),sandbox);
(async()=>{
 await sandbox.window.DrawingHand.ready;
 let cases=0;
 for(const enabled of [false,true])for(const x of [630,960,1290])for(const y of [160,350,700,1040]){
  let angle,scale;
  const ctx={canvas:{width:1920,height:1080},save(){},restore(){},translate(){},rotate(a){angle=a;},scale(s){scale=s;},drawImage(){}};
  sandbox.window.DrawingHand.draw(ctx,{}, {x,y},{x:630,y:160,w:660,h:880},0,enabled);
  const cutY=y+scale*(Math.sin(angle)*(1084-16.6)+Math.cos(angle)*(704-243.1));
  assert(cutY>1080,`Visible arm crop at ${x},${y}`);
  assert.equal(scale,380/423.6);cases++;
 }
 console.log(`${cases} landscape arm poses: crop outside frame, scale unchanged`);
})();
