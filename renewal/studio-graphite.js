/* Tone is accumulated by individual graphite marks, never a photo reveal mask. */
window.StudioGraphite=(()=>{
 function regions(A){
  if(A.studioRegions)return A.studioRegions;
  const {gw:w,gh:h,face,marks}=A,labels=new Uint8Array(w*h);
  const oval=marks?.mesh&&marks.parts.oval.map(c=>marks.mesh[c.start]);
  if(oval)oval.sort((a,b)=>Math.atan2(a.y-face.y,a.x-face.x)-Math.atan2(b.y-face.y,b.x-face.x));
  const inside=(x,y)=>{if(!oval)return Math.hypot((x-face.x)/face.rx,(y-face.y)/face.ry)<.94;let yes=false;for(let i=0,j=oval.length-1;i<oval.length;j=i++){const a=oval[i],b=oval[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=y*w+x;const mask=A.scene?1:(A.person||A.objects)?Math.max(A.person?.[i]||0,A.objects?.[i]||0):1;if(mask<.2)continue;
   const r=A.rgba[i*4],g=A.rgba[i*4+1],bl=A.rgba[i*4+2];
   const cb=128-.168736*r-.331264*g+.5*bl,cr=128+.5*r-.418688*g-.081312*bl;
   const forehead=Math.abs(x-face.x)<face.rx*1.05&&y>face.y-face.ry*1.45&&y<face.y&&cb>=77&&cb<=127&&cr>=132&&cr<=178&&r>g&&A.hair[i]<.4;
   const skin=inside(x,y)||forehead,hair=y<face.y+face.ry*.65&&A.hair[i]>.4&&(!skin||y<face.y-face.ry*.35);
   labels[i]=hair?2:skin?1:(A.handW[i]>.35?4:3);
  }
  A.studioRegions=labels;return labels;
 }
 function marks(A){
  if(A.studioMarks)return A.studioMarks;
  const {gw:w,gh:h,b,soft,rgba,face,subject}=A,rnd=random(40871),tone=new Float32Array(w*h);
  const labels=regions(A),regionAt=(x,y)=>{x=Math.round(x);y=Math.round(y);return x<0||y<0||x>=w||y>=h?0:labels[y*w+x];};
  const values=[];for(let i=0;i<soft.length;i+=5)if(A.scene||subject[i]>.25)values.push(soft[i]);values.sort((a,b)=>a-b);
  const white=values[Math.floor(values.length*.96)]||245,black=values[Math.floor(values.length*.025)]||15;
  for(let i=0;i<tone.length;i++){
   const gray=rgba[i*4]*.299+rgba[i*4+1]*.587+rgba[i*4+2]*.114;
   const local=clamp((white-(gray*.6+soft[i]*.4))/Math.max(90,white-black));
   const mask=A.scene?1:(A.person||A.objects)?Math.max(A.person?.[i]||0,A.objects?.[i]||0):1;
   const nx=(i%w-w*.5)/(w*.54),ny=(Math.floor(i/w)-h*.42)/(h*.68);
   const fade=A.scene?1:clamp((1.25-Math.hypot(nx,ny))/.3);
   tone[i]=Math.pow(local,1.22)*clamp(mask*1.3)*fade*(A.scene?1:clamp((h-Math.floor(i/w))/(h*.15)));
  }
  const sample=(x,y)=>tone[Math.min(h-1,Math.max(0,Math.round(y)))*w+Math.min(w-1,Math.max(0,Math.round(x)))];
  const all=[];
  // Three passes use alternating directions and increasingly fine, dark marks.
  for(let pass=0;pass<3;pass++){
   const list=[],step=pass===0?2.2:pass===1?2.0:1.8;
   for(let y=2;y<h-2;y+=step)for(let x=2;x<w-2;x+=step){
    const px=x+(rnd()-.5)*step,py=y+(rnd()-.5)*step,d=sample(px,py);
    const threshold=pass===0?.015:pass===1?.14:.40;
    const region=regionAt(px,py);if(!region)continue;
    if(d<threshold || rnd()>Math.min(.98,(d-threshold)*(pass===0?2.8:2.0)))continue;
    const idx=Math.round(py)*w+Math.round(px),detail=A.detail[idx]||0;
    const nx=(px-face.x)/face.rx,ny=(py-face.y)/face.ry;
    let theta;
    if(region===1&&!A.scene){
     // Follow the facial planes: vertical bridge, curved cheeks, broad forehead.
     theta=Math.abs(nx)<.24&&ny>-.35&&ny<.4?Math.PI/2:ny<-.35?.12+nx*.45:(A.coh[idx]>.18?A.ang[idx]:.25+nx*.4);
    }else if(region===2)theta=(A.coh[idx]>.18?A.ang[idx]:-.3+nx*.65);
    else theta=A.coh[idx]>.22?A.ang[idx]:(nx<0?.8:-.8);
    theta+=(pass===1?.65:pass===2?-.45:0)+(rnd()-.5)*.16;
    const length=(pass===0?5:pass===1?4.5:4)*(1-detail*.15)*(.85+rnd()*.3);
    // Tiny graphite touches: never use long diagonal shading strokes.
    const reach=sign=>{let last=0;for(let d=1;d<=length/2;d+=.75){const qx=px+Math.cos(theta)*d*sign,qy=py+Math.sin(theta)*d*sign;const other=regionAt(qx,qy);if(!other||(other!==region&&Math.abs(sample(qx,qy)-sample(px,py))>.12))break;last=d;}return last;};
    const left=reach(-1),right=reach(1);if(left+right<2)continue;
    const dx=Math.cos(theta),dy=Math.sin(theta);
    const xx=new Float32Array([b.x+px-dx*left,b.x+px,b.x+px+dx*right]),yy=new Float32Array([b.y+py-dy*left,b.y+py,b.y+py+dy*right]);
    if(xx.some((x,i)=>!regionAt(x-b.x,yy[i]-b.y)))continue;
    const coverage=Math.min(sample(px-dx*left,py-dy*left),sample(px+dx*right,py+dy*right));
    if(coverage<d*.25)continue;
    const alpha=(pass===0?.22:pass===1?.34:.50)*(.4+d*.85)*1.45;
    list.push({x:xx,y:yy,pr:new Float32Array([.48,1,.42]),n:3,len:left+right,region,width:pass===0?1.35:pass===1?1:.7,alpha,ghost:0,kind:'hatch',shade:d,studio:true,
      tile:Math.floor(py/12)*100+Math.floor(px/12),priority:Math.hypot((px-face.x)/(face.rx*1.5),(py-face.y)/(face.ry*1.8))+rnd()*.2});
   }
   const groups=new Map();for(const s of list){if(!groups.has(s.tile))groups.set(s.tile,[]);groups.get(s.tile).push(s);}
   const ordered=[...groups.values()].sort((a,b)=>a[0].priority-b[0].priority);
   all.push(...ordered.flat());
  }
  // Hair strands, eyelids and lips are crisp but do not become a heavy outline.
  const contours=(A.ai?.contours||A.contours).filter(s=>!s.coverageOnly&&s.len>5);
  for(const raw of contours){const s=finalizeStroke({...raw,kind:'contour'},rnd,b.x,b.y);if(!s)continue;s.ai=false;s.width=.68;s.alpha=.40+(raw.strength||0)*.40;s.ghost=0;s.studio=true;all.push(s);}
  A.studioMarks=all;return all;
 }
 // Keep the finished marks, but choreograph them as one connected drawing session.
 // A tonal pass never traverses the entire portrait before restarting.
 function nearest(list,from){
  const pending=list.slice(),out=[];let at=from;
  while(pending.length){let best=0,distance=Infinity,reverse=false;
   for(let i=0;i<pending.length;i++){
    const s=pending[i],a=Math.hypot(s.x[0]-at.x,s.y[0]-at.y),z=Math.hypot(s.x[s.n-1]-at.x,s.y[s.n-1]-at.y);
    if(Math.min(a,z)<distance){best=i;distance=Math.min(a,z);reverse=z<a;}
   }
   let s=pending[best];pending[best]=pending[pending.length-1];pending.pop();
   if(reverse)s={...s,x:s.x.slice().reverse(),y:s.y.slice().reverse(),pr:s.pr.slice().reverse()};
   out.push(s);at={x:s.x[s.n-1],y:s.y[s.n-1]};
  }
  return out;
 }
 // Four faint passes deposit each source mark near the pencil tip.
 // Travel between neighbourhoods is lifted; no finished tone tiles.
 function localShading(list,A){
  // Revisit a small neighbourhood with faint graphite before moving onward.
  // Neighbourhoods schedule strokes only; they never clip ink into shapes.
  const groups=new Map();
  for(const s of list){const x=s.x[1],y=s.y[1],u=x+2*Math.sin(y*.06),v=y+2*Math.sin(x*.07),key=Math.floor(u/10)+':'+Math.floor(v/10);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s);}
  const patches=[...groups.values()],out=[];let at={x:A.b.x+A.face.x,y:A.b.y+A.face.y};
  while(patches.length){let best=0,distance=Infinity;for(let i=0;i<patches.length;i++){const s=patches[i][0],d=Math.hypot(s.x[1]-at.x,s.y[1]-at.y);if(d<distance){distance=d;best=i;}}
   const patch=patches.splice(best,1)[0],ordered=nearest(patch,at);
   for(let layer=0;layer<4;layer++){
    const order=layer%2?ordered.slice().reverse():ordered,n=order.length+1;
    const x=new Float32Array(n),y=new Float32Array(n),pr=new Float32Array(n).fill(.8),inkGroups=[];let len=0;
    x[0]=order[0].x[1];y[0]=order[0].y[1];
    for(let i=0;i<order.length;i++){const m=order[i];x[i+1]=m.x[1];y[i+1]=m.y[1];len+=Math.hypot(x[i+1]-x[i],y[i+1]-y[i]);
     const alpha=(1-Math.pow(1-Math.min(.98,m.alpha*.725),.25))/.725;
     inkGroups.push([{...m,alpha,sourceMark:m}]);
    }
    out.push({x,y,pr,n,len:Math.max(1,len),width:1,alpha:1,ghost:0,kind:'hatch',studio:true,inkGroups,layer,patch:out.length>>2});at={x:x[n-1],y:y[n-1]};
   }
  }
  return out;
 }
 function build(A,base,density=40){
  const original=marks(A).map(s=>({...s,alpha:s.alpha*(.8+density/200)})),writing=base.strokes.filter(s=>s.message||s.kind==='sign'||s.kind==='dot');
  const contours=original.filter(s=>s.kind==='contour'),shading=original.filter(s=>s.kind!=='contour');
  const feature=s=>(s.eye||0)>.12||(s.zones||[]).some((v,i)=>[0,1,2,3,4].includes(i)&&v>.25);
  const gestures=contours.filter(s=>!feature(s)&&s.len>20).sort((a,b)=>b.len-a.len).slice(0,18),used=new Set(gestures);
  const details=contours.filter(s=>!used.has(s)&&feature(s));details.forEach(s=>used.add(s));
  const rest=contours.filter(s=>!used.has(s));
  const accents=rest.filter(s=>s.len<18&&(s.strength||0)>.45);const finishing=new Set(accents);
  const phases=[
   {name:'형태 잡기',weight:.06,list:gestures},
   {name:'이목구비 그리기',weight:.10,list:details},
   {name:'머리카락과 옷의 선',weight:.09,list:rest.filter(s=>!finishing.has(s))},
   {name:'연필로 명암 칠하기',weight:.72,list:localShading(shading,A),ordered:true},
   {name:'마지막 세부 묘사',weight:.03,list:accents}
  ].filter(p=>p.list.length);
  const lead=(base.intro?base.intro.hold+base.intro.fade:0)+650,duration=Math.max(120000-(base.totalMs-base.drawEndMs)-lead,base.drawEndMs-lead),weight=phases.reduce((n,p)=>n+p.weight,0);
  let at=base.entry,start=lead;const drawing=[],chapters=[];
  for(const phase of phases){
   const list=phase.ordered?phase.list:nearest(phase.list,at);let raw=0;
   for(let i=0;i<list.length;i++){
    const s=list[i],gap=Math.hypot(s.x[0]-at.x,s.y[0]-at.y),speed=1.5;
    s.tLift=raw;raw+=phase.ordered?25+gap*2:24+Math.min(280,gap*1.3);
    const motion=prepareStrokeMotion(s,i);
    s.tDown=raw;raw+=phase.ordered?Math.max(100,s.len/180*1000)*(1+.12*Math.sin(i*2.399)):motion/speed+25;s.tUp=raw;
    s.chapter=phase.name;at={x:s.x[s.n-1],y:s.y[s.n-1]};
   }
   const requested=duration*phase.weight/weight;
   const span=requested,scale=span/Math.max(1,raw);
   for(const s of list){s.tLift=start+s.tLift*scale;s.tDown=start+s.tDown*scale;s.tUp=start+s.tUp*scale;}
   chapters.push({name:phase.name,start,end:start+span,count:list.length});for(const s of list)drawing.push(s);start+=span;
  }
  const extension=Math.max(0,start-base.drawEndMs);
  for(const s of writing){s.tLift+=extension;s.tDown+=extension;s.tUp+=extension;}
  const talk=base.talk?{...base.talk,start:base.talk.start+extension,end:base.talk.end+extension,blinkAt:base.talk.blinkAt+extension,beats:base.talk.beats.map(b=>({...b,start:b.start+extension,end:b.end+extension}))}:null;
  return {...base,totalMs:base.totalMs+extension,drawEndMs:start,talk,requestedMs:base.totalMs,strokes:[...drawing,...writing],chapters,ai:false,aiLayer:null,faithful:false,croquis:true,studio:true,faceEndMs:0,audio:buildAudioEvents([...drawing,...writing])};
 }
 return {marks,build,regions};
})();
