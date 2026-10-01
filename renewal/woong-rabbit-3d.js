import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js';

'use strict';
const $=id=>document.getElementById(id),canvas=$('stage'),ctx=canvas.getContext('2d'),W=1920,H=1080,duration=15;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t);return t*t*(3-2*t);};
let ready=false,busy=false,playing=0,time=0,cancelled=false,downloadURL='',mode='three',webglReady=false;
let renderer,scene,camera,rabbit,shadow,doors=[],particles,particleBase,chairs=[],signTexture;
const sheets={},textures={greeting:[],walk:[],actions:[],cardinal:[],diagonal:[]};
const captions=[
  {end:3,line:'공연은 무대에서만 시작될까요?'},
  {end:8,line:'멀리서 온 팬들의 기다림'},
  {end:11,line:'문이 열리면, 시원한 쉼터'},
  {end:15,line:'여기서 천천히 쉬어 가세요'}
];
const say=s=>$('status').textContent=s;

async function loadImage(src){const im=new Image();im.src=src;await im.decode();return im;}
function measure(im,columns=3,rows=2){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data,frames=[];for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const x0=Math.round(col*c.width/columns),x1=Math.round((col+1)*c.width/columns),y0=Math.round(row*c.height/rows),y1=Math.round((row+1)*c.height/rows);let l=x1,r=x0,t=y1,b=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d[(y*c.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<=l||b<=t)throw Error('캐릭터 프레임이 비어 있습니다.');frames.push({x:l,y:t,w:r-l+1,h:b-t+1});}return {im,frames,columns,rows};}
function makeFrameCanvas(sheet,frame){const c=document.createElement('canvas');c.width=frame.w;c.height=frame.h;c.getContext('2d').drawImage(sheet.im,frame.x,frame.y,frame.w,frame.h,0,0,frame.w,frame.h);return c;}
function canvasTexture(c){const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;tx.minFilter=THREE.LinearFilter;tx.magFilter=THREE.LinearFilter;tx.generateMipmaps=false;return tx;}
function labelTexture(text){const c=document.createElement('canvas');c.width=1024;c.height=240;const g=c.getContext('2d');g.fillStyle='#eff9ff';g.roundRect(12,12,1000,216,36);g.fill();g.strokeStyle='#86aec7';g.lineWidth=10;g.stroke();g.fillStyle='#285b78';g.textAlign='center';g.textBaseline='middle';g.font='800 78px "Nanum Gothic",sans-serif';g.fillText(text,512,122);return canvasTexture(c);}
function box(name,w,h,d,color,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.78,metalness:.04}));m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m;}
function plant(x,z){const pot=box('화분',.7,.7,.7,0x9a694c,x,.35,z);const crown=new THREE.Mesh(new THREE.SphereGeometry(.65,16,12),new THREE.MeshStandardMaterial({color:0x527c57,roughness:.9}));crown.scale.set(.75,1.35,.75);crown.position.set(x,1.3,z);crown.castShadow=true;scene.add(crown);return [pot,crown];}
function chair(x,z,rotation=0){const group=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color:0x86a9bd,roughness:.85});const wood=new THREE.MeshStandardMaterial({color:0x806a57,roughness:.9});const seat=new THREE.Mesh(new THREE.BoxGeometry(1.55,.18,.62),mat);seat.position.y=.75;const back=new THREE.Mesh(new THREE.BoxGeometry(1.55,1.15,.18),mat);back.position.set(0,1.32,.27);for(const sx of [-.62,.62])for(const sz of [-.2,.2]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.12,.72,.12),wood);leg.position.set(sx,.36,sz);group.add(leg);}group.add(seat,back);group.position.set(x,0,z);group.rotation.y=rotation;group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});scene.add(group);chairs.push(group);return group;}

function buildScene(){
  const probe=document.createElement('canvas');if(!probe.getContext('webgl2'))throw Error('이 기기는 WebGL2를 지원하지 않습니다.');
  renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.setSize(W,H,false);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color(0xdde9f0);scene.fog=new THREE.Fog(0xdde9f0,14,29);
  camera=new THREE.PerspectiveCamera(41,W/H,.1,80);camera.position.set(-1.2,3.5,8.7);
  scene.add(new THREE.HemisphereLight(0xf4fbff,0x9e806b,2.2));const sun=new THREE.DirectionalLight(0xfff4dd,3.1);sun.position.set(-6,9,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-10;sun.shadow.camera.right=10;sun.shadow.camera.top=10;sun.shadow.camera.bottom=-10;scene.add(sun);
  const outside=new THREE.Mesh(new THREE.PlaneGeometry(28,19),new THREE.MeshStandardMaterial({color:0xcab89b,roughness:1}));outside.rotation.x=-Math.PI/2;outside.position.set(0,-.03,4);outside.receiveShadow=true;scene.add(outside);
  const inside=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.MeshStandardMaterial({color:0xdde7e9,roughness:.85}));inside.rotation.x=-Math.PI/2;inside.position.set(0,0,-10);inside.receiveShadow=true;scene.add(inside);
  box('왼쪽 외벽',5.8,5,.46,0xe9e1d4,-4.7,2.5,-3.75);box('오른쪽 외벽',5.8,5,.46,0xe9e1d4,4.7,2.5,-3.75);box('입구 상단',3.6,1.35,.46,0xd8cdbd,0,4.32,-3.75);
  box('실내 뒷벽',13,5,.35,0xd3e1e4,0,2.5,-13);box('실내 왼벽',.35,5,9,0xe7eef0,-6.4,2.5,-8.3);box('실내 오른벽',.35,5,9,0xe7eef0,6.4,2.5,-8.3);
  const glassMat=new THREE.MeshPhysicalMaterial({color:0xaad6e4,transparent:true,opacity:.32,roughness:.12,metalness:.03,depthWrite:false});
  for(const x of [-.88,.88]){const d=new THREE.Mesh(new THREE.BoxGeometry(1.7,3.55,.09),glassMat.clone());d.position.set(x,1.78,-3.48);d.castShadow=true;scene.add(d);doors.push(d);}
  for(const x of [-1.8,1.8])box('문틀',.1,4.15,.12,0x466678,x,2.08,-3.39);box('문틀 상단',3.7,.1,.12,0x466678,0,4.12,-3.39);
  signTexture=labelTexture('시원한 실내 휴게 공간');const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.1,.96),new THREE.MeshBasicMaterial({map:signTexture}));sign.position.set(0,4.55,-3.48);scene.add(sign);
  chair(-3,-7.2,.08);chair(3.1,-7.4,-.08);chair(-2.5,-10.2,Math.PI);chair(2.6,-10.4,Math.PI);plant(-5.2,-5.5);plant(5.2,-5.7);
  const shadowTx=(()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d'),gr=g.createRadialGradient(128,64,8,128,64,104);gr.addColorStop(0,'rgba(17,35,46,.35)');gr.addColorStop(1,'rgba(17,35,46,0)');g.fillStyle=gr;g.fillRect(0,0,256,128);return canvasTexture(c);})();
  shadow=new THREE.Mesh(new THREE.PlaneGeometry(2.2,1.05),new THREE.MeshBasicMaterial({map:shadowTx,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;scene.add(shadow);
  rabbit=new THREE.Sprite(new THREE.SpriteMaterial({map:textures.greeting[0],transparent:true,alphaTest:.02,depthTest:true,depthWrite:true}));rabbit.center.set(.5,0);scene.add(rabbit);
  const count=54,pos=new Float32Array(count*3);particleBase=[];for(let i=0;i<count;i++){const p={x:-2.5+(i*1.73)%5,y:.35+(i*.71)%3.1,z:-4.1-(i*.91)%7};particleBase.push(p);pos.set([p.x,p.y,p.z],i*3);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const ptx=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,30);gr.addColorStop(0,'rgba(225,250,255,.9)');gr.addColorStop(.35,'rgba(177,226,243,.55)');gr.addColorStop(1,'rgba(177,226,243,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return canvasTexture(c);})();particles=new THREE.Points(geo,new THREE.PointsMaterial({map:ptx,size:.18,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(particles);
  webglReady=true;
}

function directionalFrame(dx,dz,phase){const ax=Math.abs(dx),az=Math.abs(dz);let name,row,direction;if(ax<az*.42){name='cardinal';row=dz<0?3:0;direction=dz<0?'후면':'정면';}else if(az<ax*.42){name='cardinal';row=dx<0?1:2;direction=dx<0?'왼쪽':'오른쪽';}else{name='diagonal';if(dz<0){row=dx<0?0:1;direction=dx<0?'후면 왼쪽 대각선':'후면 오른쪽 대각선';}else{row=dx<0?2:3;direction=dx<0?'정면 왼쪽 대각선':'정면 오른쪽 대각선';}}return {name,index:row*4+phase,direction};}
function walkingPose(x,z,dx,dz,progress,cycles){const phase=Math.floor(clamp(progress,0,.9999)*cycles*4)%4,frame=directionalFrame(dx,dz,phase),foot=[0,-.018,.012,-.01][phase];return {...frame,x,z,bob:foot};}
function stillDirection(name,row,direction,x,z){return {name,index:row*4,x,z,bob:0,direction};}
function poseAt(t){
  if(t<3)return {name:'greeting',index:Math.min(5,Math.floor(t*2)),x:-2,z:1,bob:0,direction:'정면 인사'};
  if(t<3.2)return stillDirection('cardinal',0,'정면 회전 시작',-2,1);
  if(t<3.42)return stillDirection('cardinal',2,'오른쪽 회전',-2,1);
  if(t<3.65)return stillDirection('diagonal',1,'후면 오른쪽 대각선 회전',-2,1);
  if(t<5.5){const p=ease((t-3.65)/1.85),x=mix(-2,-.55,p),z=mix(1,-.2,p);return walkingPose(x,z,1.45,-1.2,p,1);}
  if(t<11){const p=ease((t-5.5)/5.5),x=mix(-.55,.72,p),z=mix(-.2,-5.15,p);return walkingPose(x,z,.35,-1.55,p,3);}
  if(t<11.2)return stillDirection('cardinal',3,'후면 회전 시작',.72,-5.15);
  if(t<11.4)return stillDirection('diagonal',0,'후면 왼쪽 대각선 회전',.72,-5.15);
  if(t<11.6)return stillDirection('cardinal',1,'왼쪽 회전',.72,-5.15);
  if(t<11.8)return stillDirection('diagonal',2,'정면 왼쪽 대각선 회전',.72,-5.15);
  return {name:'greeting',index:t<12.5?0:t<13.4?1:4,x:.72,z:-5.15,bob:0,direction:'정면 안내'};
}
function update3D(t){
  const pose=poseAt(t),doorP=ease((t-8)/1.8);doors[0].position.x=-.88-doorP*1.35;doors[1].position.x=.88+doorP*1.35;
  rabbit.material.map=textures[pose.name][pose.index];rabbit.material.needsUpdate=true;const tx=rabbit.material.map.image,hh=3.55;rabbit.scale.set(hh*tx.width/tx.height,hh,1);rabbit.position.set(pose.x,pose.bob,pose.z);shadow.position.set(pose.x,.025,pose.z+.05);shadow.material.opacity=.83-Math.max(0,pose.bob)*5;canvas.dataset.direction=pose.direction;
  const walkP=ease((t-3)/8),finish=ease((t-10)/5);camera.position.set(mix(-1.2,.25,walkP),mix(3.5,3.15,finish),mix(8.7,5.15,walkP));camera.lookAt(mix(-.45,.28,walkP),1.72,mix(-2.7,-5.7,walkP));
  particles.material.opacity=.13+.55*clamp((t-8.2)/2);const pos=particles.geometry.attributes.position.array;for(let i=0;i<particleBase.length;i++){const b=particleBase[i];pos[i*3]=b.x+Math.sin(t*.8+i)*.22;pos[i*3+1]=.25+((b.y+t*.18+i*.04)%3.25);pos[i*3+2]=b.z;}particles.geometry.attributes.position.needsUpdate=true;
  renderer.render(scene,camera);ctx.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);
}

function round(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function drawSprite2D(pose){const sh=sheets[pose.name],f=sh.frames[pose.index],h=520,w=h*f.w/f.h,x=mix(505,1040,clamp((time-3)/8)),y=990-pose.bob*100;ctx.save();ctx.drawImage(sh.im,f.x,f.y,f.w,f.h,x-w/2,y-h,w,h);ctx.restore();ctx.save();ctx.fillStyle='#1e354533';ctx.filter='blur(12px)';ctx.beginPath();ctx.ellipse(x,y,100,18,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function renderFlat(t){
  const sx=canvas.width/W,sy=canvas.height/H;ctx.save();ctx.scale(sx,sy);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#dbe8ef');sky.addColorStop(.55,'#edf1ee');sky.addColorStop(1,'#c7b597');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);ctx.fillStyle='#e8dfd2';ctx.fillRect(0,250,W,730);ctx.fillStyle='#c9b99f';ctx.fillRect(0,875,W,205);ctx.fillStyle='#b9d7df';ctx.fillRect(560,350,800,525);ctx.fillStyle='#5a7482';ctx.fillRect(945,350,30,525);ctx.fillStyle='#eff9ff';round(650,240,620,105,24,'#eff9ff');ctx.fillStyle='#285b78';ctx.textAlign='center';ctx.font='800 42px "Nanum Gothic"';ctx.fillText('시원한 실내 휴게 공간',960,307);ctx.fillStyle='#86a9bd';for(const x of [300,1580]){round(x-135,720,270,70,18,'#86a9bd');round(x-135,565,270,160,18,'#a9c1cf');}time=t;drawSprite2D(poseAt(t));ctx.restore();
}
function overlay(t){const sx=canvas.width/W,sy=canvas.height/H;ctx.save();ctx.scale(sx,sy);if($('captions').checked){const item=captions.find(x=>t<x.end)||captions.at(-1);round(235,86,1450,142,30,'rgba(18,43,61,.9)');ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 64px "Nanum Gothic",sans-serif';ctx.fillText(item.line,960,157);}round(44,27,350,46,23,'rgba(255,255,255,.9)');ctx.fillStyle='#356580';ctx.font='800 23px "Nanum Gothic"';ctx.textAlign='center';ctx.fillText('웅토끼 · 첫 장면 시험',219,57);ctx.fillStyle='rgba(19,42,57,.78)';ctx.font='700 23px "Nanum Gothic"';ctx.fillText('2026 고양 공연 관련 공개 자료를 바탕으로 재구성한 AI 팬 창작 화면',960,1042);ctx.restore();}
function render(t){if(!ready)return;ctx.clearRect(0,0,canvas.width,canvas.height);if(mode==='three'&&webglReady)update3D(t);else renderFlat(t);overlay(t);$('clock').textContent=`0:${String(Math.min(15,Math.floor(t))).padStart(2,'0')} / 0:15`;}
function setMode(next){mode=next==='three'&&webglReady?'three':'flat';$('three-mode').classList.toggle('active',mode==='three');$('flat-mode').classList.toggle('active',mode==='flat');$('three-mode').setAttribute('aria-pressed',mode==='three');$('flat-mode').setAttribute('aria-pressed',mode==='flat');$('badge').textContent=mode==='three'?'THREE.JS · 2.5D':'CANVAS · 2D';render(time);}
function stop(){cancelAnimationFrame(playing);playing=0;$('play').textContent='▶ 재생';}
$('play').onclick=()=>{if(playing){stop();return;}if(time>=duration-.02)time=0;const start=performance.now()-time*1000;const tick=now=>{time=Math.min(duration,(now-start)/1000);render(time);$('seek').value=time*100;if(time>=duration){stop();return;}playing=requestAnimationFrame(tick);};playing=requestAnimationFrame(tick);$('play').textContent='Ⅱ 일시정지';};
$('seek').oninput=()=>{stop();time=Number($('seek').value)/100;render(time);};$('captions').onchange=()=>render(time);$('three-mode').onclick=()=>setMode('three');$('flat-mode').onclick=()=>setMode('flat');
function lock(on){busy=on;for(const el of document.querySelectorAll('button,input,select'))if(el.id!=='cancel')el.disabled=on;$('cancel').hidden=!on;}
async function loadMuxer(){if(window.Mp4Muxer)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.min.js';s.onload=resolve;s.onerror=()=>reject(Error('영상 저장 도구를 불러오지 못했습니다.'));document.head.append(s);});}
$('export').onclick=async()=>{stop();lock(true);cancelled=false;let encoder;try{if(!window.VideoEncoder)throw Error('MP4 저장은 최신 Chrome 또는 Edge에서 이용해 주세요.');say('15초 비교 영상을 준비하고 있습니다…');await loadMuxer();await document.fonts.ready;const height=Number($('quality').value),width=height===720?1280:1920;canvas.width=width;canvas.height=height;if(renderer)renderer.setSize(width,height,false);if(camera){camera.aspect=width/height;camera.updateProjectionMatrix();}const config={codec:'avc1.420028',width,height,bitrate:height===720?3500000:6500000,framerate:30};if(!(await VideoEncoder.isConfigSupported(config)).supported)throw Error('이 기기에서 선택한 화질을 지원하지 않습니다.');const target=new Mp4Muxer.ArrayBufferTarget(),mux=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height},fastStart:'in-memory'});let failure;encoder=new VideoEncoder({output:(c,m)=>mux.addVideoChunk(c,m),error:e=>failure=e});encoder.configure(config);const total=duration*30;for(let i=0;i<total;i++){if(cancelled)throw Error('저장을 취소했습니다.');if(failure)throw failure;render(i/30);const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1e6/30),duration:Math.round(1e6/30)});encoder.encode(frame,{keyFrame:i%60===0});frame.close();if(i%8===0||encoder.encodeQueueSize>5){say(`15초 영상을 저장하고 있습니다… ${Math.floor(i/total*100)}%`);await new Promise(r=>setTimeout(r,0));while(encoder.encodeQueueSize>5){if(failure)throw failure;if(cancelled)throw Error('저장을 취소했습니다.');await new Promise(r=>setTimeout(r,10));}}}await encoder.flush();if(failure)throw failure;mux.finalize();if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(new Blob([target.buffer],{type:'video/mp4'}));const a=$('download');a.href=downloadURL;a.download=`웅토끼-휴게공간-${mode==='three'?'2.5D':'2D'}-15초.mp4`;a.hidden=false;a.click();say('15초 MP4를 저장했습니다. 두 방식을 바꿔 각각 저장할 수 있습니다.');}catch(e){say(e.message);}finally{if(encoder&&encoder.state!=='closed')encoder.close();canvas.width=W;canvas.height=H;if(renderer)renderer.setSize(W,H,false);if(camera){camera.aspect=W/H;camera.updateProjectionMatrix();}lock(false);render(time);}};
$('cancel').onclick=()=>cancelled=true;
window.addEventListener('beforeunload',()=>{if(downloadURL)URL.revokeObjectURL(downloadURL);if(renderer){scene?.traverse(o=>{o.geometry?.dispose?.();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose?.();m.dispose?.();}}});renderer.dispose();}});

Promise.all([
  ...['greeting','walk','actions'].map(async name=>{sheets[name]=measure(await loadImage(`assets/woong-rabbit/${name}.png`));for(const f of sheets[name].frames)textures[name].push(canvasTexture(makeFrameCanvas(sheets[name],f)));}),
  ...[['cardinal','walk-cardinal.png'],['diagonal','walk-diagonal.png']].map(async([name,file])=>{sheets[name]=measure(await loadImage(`assets/woong-rabbit/${file}`),4,4);for(const f of sheets[name].frames)textures[name].push(canvasTexture(makeFrameCanvas(sheets[name],f)));}),
  document.fonts.ready
]).then(()=>{try{buildScene();}catch(e){mode='flat';$('three-mode').disabled=true;say(`${e.message} 기존 2D 화면으로 열었습니다.`);}ready=true;setMode(mode);$('play').disabled=$('export').disabled=false;if(webglReady)say('8방향 보행이 준비되었습니다. 문 안으로 들어갈 때 뒷모습과 발걸음을 확인해 보세요.');}).catch(e=>say('불러오기 실패: '+e.message));
