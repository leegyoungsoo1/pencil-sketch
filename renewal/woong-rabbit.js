'use strict';
const $=id=>document.getElementById(id), canvas=$('stage'),ctx=canvas.getContext('2d');
const duration=36, W=1920,H=1080, sheets={};
let background,ready=false,busy=false,playing=0,time=0,cancelled=false,downloadURL='';
const chapters=[
 {start:0,end:4,title:'건행! 오늘의 임무',lines:['건행! 오늘은 제가 먼저 왔어요.']},
 {start:4,end:8,title:'아직 문 열면 안 돼!',lines:['잠깐! 아직 문 열면 안 돼요!']},
 {start:8,end:12,title:'직접 앉아 보기',lines:['오래 앉아 계실 텐데…','음, 조금 딱딱하네?']},
 {start:12,end:17,title:'폭신한 마음',lines:['이 자리엔 폭신함을 추가!']},
 {start:17,end:22,title:'뒷자리 점검',lines:['맨 뒤에서도 잘 보이나?','어… 무대가 콩알만 하잖아!']},
 {start:22,end:28,title:'화면이 너무 커!',lines:['화면을 키웠더니…','앗! 제 얼굴이 너무 큰데요?']},
 {start:28,end:32,title:'이제 준비 완료',lines:['편하게 웃으실 준비, 완료!']},
 {start:32,end:36,title:'마지막도 건행',lines:['당신의 자리를 먼저 생각해요.','오늘도 건행!']}
];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const say=s=>$('status').textContent=s;
async function loadImage(src){const im=new Image();im.src=src;await im.decode();return im;}
function measure(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0);const d=g.getImageData(0,0,c.width,c.height).data;let transparent=0;for(let i=3;i<d.length;i+=4)if(d[i]<16)transparent++;if(transparent/(c.width*c.height)<.2)throw Error('캐릭터 투명 배경을 확인해 주세요.');const frames=[];for(let row=0;row<2;row++)for(let col=0;col<3;col++){const x0=Math.round(col*c.width/3),x1=Math.round((col+1)*c.width/3),y0=Math.round(row*c.height/2),y1=Math.round((row+1)*c.height/2);let l=x1,r=x0,t=y1,b=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d[(y*c.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}if(r<=l||b<=t)throw Error('캐릭터 프레임이 비어 있습니다.');frames.push({x:l,y:t,w:r-l+1,h:b-t+1});}return {im,frames,scale:640/Math.max(...frames.map(f=>f.h)),transparent:transparent/(c.width*c.height)};}
function round(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function text(s,x,y,size=64,color='#fff'){ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`800 ${size}px "Nanum Gothic",sans-serif`;ctx.fillStyle=color;ctx.fillText(s,x,y);}
function shadow(x,y,scale=1){ctx.save();ctx.fillStyle='rgba(37,52,62,.17)';ctx.filter='blur(12px)';ctx.beginPath();ctx.ellipse(x,y,110*scale,19*scale,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function sprite(name,index,x,y,scale=1,flip=false){const sh=sheets[name],f=sh.frames[index],s=sh.scale*scale;ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.drawImage(sh.im,f.x,f.y,f.w,f.h,-f.w*s/2,-f.h*s,f.w*s,f.h*s);ctx.restore();}
function person(name,index,x,y,scale=1,jump=0){shadow(x,y,scale*(1-jump/300));sprite(name,index,x,y-jump,scale);}
function chair(x,y,cushion=false){ctx.save();ctx.translate(x,y);round(-126,-270,252,205,35,'#6d97b8');round(-110,-252,220,154,28,'#adc9de');round(-132,-102,264,62,22,'#5a83a4');round(-110,-45,22,90,8,'#846c59');round(89,-45,22,90,8,'#846c59');if(cushion){round(-119,-126,238,46,22,'#86baf0');ctx.strokeStyle='#d5eaff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-95,-103);ctx.quadraticCurveTo(0,-91,95,-103);ctx.stroke();}ctx.restore();}
function bubble(s,x,y){ctx.save();round(x-200,y-53,400,106,35,'rgba(255,255,255,.96)');text(s,x,y,46,'#395974');ctx.restore();}
function confetti(t){for(let i=0;i<65;i++){const x=(i*137.7+Math.sin(t+i)*30)%W,y=((t*110+i*61)%1250)-120;ctx.save();ctx.translate(x,y);ctx.rotate(t+i);ctx.fillStyle=['#91c8ee','#f4d591','#fff','#eca8b7'][i%4];ctx.fillRect(-5,-9,10,18);ctx.restore();}}
function render(t){if(!ready)return;const scene=chapters.find(c=>t<c.end)||chapters.at(-1),u=clamp(t-scene.start,0,scene.end-scene.start),p=u/(scene.end-scene.start),n=chapters.indexOf(scene);ctx.save();ctx.scale(canvas.width/W,canvas.height/H);ctx.clearRect(0,0,W,H);const z=1.015+.012*Math.sin(t*.14),bw=W*z,bh=bw*background.height/background.width;ctx.drawImage(background,(W-bw)/2,(H-bh)/2,bw,bh);const ground=984;
 if(n===0){const seq=[0,1,2,3,4,4,4,4],f=seq[Math.min(seq.length-1,Math.floor(u*2.3))];person('greeting',f,960,ground,1.04);}
 if(n===1){const x=440+ease(p)*700;person('walk',Math.floor(u*6)%6,x,ground,1,Math.abs(Math.sin(u*Math.PI*6))*7);bubble('최종 점검 중!',1410,450);}
 if(n===2){chair(1010,ground-28);person('actions',2,995,ground-50,.94);if(u>1)bubble('앗, 딱딱해!',1450,475);}
 if(n===3){chair(1160,ground-28,u>3.1);if(u<2){person('actions',0,650+ease(u/2)*245,ground,1);}else if(u<3.5){person('actions',1,940,ground,.98);}else{person('greeting',0,790,ground,1);bubble('폭신함 +100',1430,465);}}
 if(n===4){person('actions',3,650,ground,1.02);bubble(u<2?'잘 보이시려나?':'무대가 콩알만 해!',1300,480);}
 if(n===5){const grow=ease(u/1.3);ctx.save();ctx.translate(1250,735);ctx.scale(.25+.75*grow,.25+.75*grow);round(-375,-415,750,515,26,'#30465b');round(-354,-394,708,470,12,'#dceaf6');ctx.save();ctx.beginPath();ctx.rect(-354,-394,708,470);ctx.clip();sprite('greeting',4,0,395,1.45);ctx.restore();round(-24,100,48,130,8,'#30465b');round(-150,214,300,20,10,'#30465b');ctx.restore();person('actions',4,570,ground,1.0,u>1.1&&u<1.8?Math.sin((u-1.1)/.7*Math.PI)*40:0);}
 if(n===6){chair(1340,ground-30,true);chair(460,ground-30,true);const hop=u<2?Math.abs(Math.sin(u*Math.PI))*50:0;person('actions',5,960,ground,1,hop);confetti(u);}
 if(n===7){const f=u<.35?1:u<.7?3:4;person('greeting',f,960,ground,1.06);if(u>1)confetti(u*.5);}
 // Captions occupy a consistent high-contrast band above the character's face.
 if($('captions').checked){const lines=scene.lines;const height=lines.length===1?123:202;round(135,105,1650,height,28,'rgba(23,44,64,.89)');lines.forEach((s,i)=>text(s,960,lines.length===1?166:164+i*78,66));}
 round(42,27,440,49,24,'rgba(255,255,255,.88)');text('웅토끼 극장 · 콘서트 준비',262,52,25,'#3f607b');text('AI 팬 창작 상황극 · 실제 발언/행사 재현 아님',960,1040,24,'#314657');
 ctx.restore();$('clock').textContent=`0:${String(Math.floor(t)).padStart(2,'0')} / 0:36`;}
function stop(){cancelAnimationFrame(playing);playing=0;$('play').textContent='▶ 재생';}
$('play').onclick=()=>{if(playing){stop();return;}if(time>=duration-.02)time=0;const start=performance.now()-time*1000;const tick=now=>{time=Math.min(duration,Math.max(0,(now-start)/1000));render(time);$('seek').value=time/duration*1000;if(time>=duration){stop();return;}playing=requestAnimationFrame(tick);};playing=requestAnimationFrame(tick);$('play').textContent='Ⅱ 일시정지';};
$('seek').oninput=()=>{stop();time=Number($('seek').value)/1000*duration;render(time);};$('captions').onchange=()=>render(time);
for(const chapter of chapters){const b=document.createElement('button');b.textContent=chapter.title;b.onclick=()=>{stop();time=chapter.start;render(time);$('seek').value=time/duration*1000;};$('chapters').append(b);}
function lock(on){busy=on;for(const el of document.querySelectorAll('button, input, select'))if(el.id!=='cancel')el.disabled=on;$('cancel').hidden=!on;}
async function loadMuxer(){if(window.Mp4Muxer)return;await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/mp4-muxer@5.2.2/build/mp4-muxer.min.js';s.onload=resolve;s.onerror=()=>{s.remove();reject(Error('영상 저장 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));};document.head.append(s);});}
$('export').onclick=async()=>{stop();lock(true);cancelled=false;let encoder;try{if(!window.VideoEncoder)throw Error('MP4 저장은 최신 Chrome 또는 Edge에서 이용해 주세요.');say('영상 저장을 준비하고 있습니다…');await loadMuxer();await document.fonts.ready;const height=Number($('quality').value),width=height===720?1280:1920;canvas.width=width;canvas.height=height;const config={codec:'avc1.420028',width,height,bitrate:height===720?3500000:6500000,framerate:30};if(!(await VideoEncoder.isConfigSupported(config)).supported)throw Error('이 기기에서 선택한 화질을 지원하지 않습니다. 720p로 시도해 주세요.');const target=new Mp4Muxer.ArrayBufferTarget(),mux=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height},fastStart:'in-memory'});let failure;encoder=new VideoEncoder({output:(c,m)=>mux.addVideoChunk(c,m),error:e=>failure=e});encoder.configure(config);const total=duration*30;for(let i=0;i<total;i++){if(cancelled)throw Error('영상 저장을 취소했습니다.');if(failure)throw failure;render(i/30);const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1e6/30),duration:Math.round(1e6/30)});try{encoder.encode(frame,{keyFrame:i%60===0});}finally{frame.close();}if(i%8===0||encoder.encodeQueueSize>5){say(`36초 영상을 저장하고 있습니다… ${Math.floor(i/total*100)}%`);await new Promise(r=>setTimeout(r,0));while(encoder.encodeQueueSize>5){if(failure)throw failure;if(cancelled)throw Error('영상 저장을 취소했습니다.');await new Promise(r=>setTimeout(r,10));}}}await encoder.flush();if(failure)throw failure;if(cancelled)throw Error('영상 저장을 취소했습니다.');mux.finalize();if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(new Blob([target.buffer],{type:'video/mp4'}));const a=$('download');a.href=downloadURL;a.download='웅토끼-01-아직문열면안돼.mp4';a.hidden=false;a.click();say('36초 MP4를 저장했습니다. 편집 앱에서 나레이션을 더해 주세요.');}catch(e){say(e.message);}finally{if(encoder&&encoder.state!=='closed')encoder.close();canvas.width=W;canvas.height=H;lock(false);render(time);}};
$('cancel').onclick=()=>cancelled=true;
window.addEventListener('beforeunload',()=>{if(downloadURL)URL.revokeObjectURL(downloadURL);});
Promise.all(['greeting','walk','actions'].map(async name=>{sheets[name]=measure(await loadImage(`assets/woong-rabbit/${name}.png`));}).concat([loadImage('assets/woong-rabbit/theater.png').then(im=>background=im),document.fonts.ready])).then(()=>{ready=true;render(0);$('play').disabled=$('export').disabled=false;say('준비되었습니다. 재생하거나 장면을 골라 확인해 보세요.');}).catch(e=>say('불러오기 실패: '+e.message));
