/* Tone is accumulated by individual graphite marks, never a photo reveal mask. */
window.StudioGraphite=(()=>{
 function marks(A){
  if(A.studioMarks)return A.studioMarks;
  const {gw:w,gh:h,b,soft,rgba,face,subject}=A,rnd=random(40871),tone=new Float32Array(w*h);
  const values=[];for(let i=0;i<soft.length;i+=5)if(subject[i]>.25)values.push(soft[i]);values.sort((a,b)=>a-b);
  const white=values[Math.floor(values.length*.96)]||245,black=values[Math.floor(values.length*.025)]||15;
  for(let i=0;i<tone.length;i++){
   const gray=rgba[i*4]*.299+rgba[i*4+1]*.587+rgba[i*4+2]*.114;
   const local=clamp((white-(gray*.6+soft[i]*.4))/Math.max(90,white-black));
   const mask=subject[i];
   const nx=(i%w-w*.5)/(w*.54),ny=(Math.floor(i/w)-h*.42)/(h*.68);
   const fade=clamp((1.25-Math.hypot(nx,ny))/.3);
   tone[i]=Math.pow(local,1.22)*clamp(mask*1.3)*fade*clamp((h-Math.floor(i/w))/(h*.15));
  }
  const sample=(x,y)=>tone[Math.min(h-1,Math.max(0,Math.round(y)))*w+Math.min(w-1,Math.max(0,Math.round(x)))];
  const all=[];
  // Three passes use alternating directions and increasingly fine, dark marks.
  for(let pass=0;pass<3;pass++){
   const list=[],step=pass===0?2.2:pass===1?1.8:1.7;
   for(let y=2;y<h-2;y+=step)for(let x=2;x<w-2;x+=step){
    const px=x+(rnd()-.5)*step,py=y+(rnd()-.5)*step,d=sample(px,py);
    const threshold=pass===0?.015:pass===1?.14:.40;
    if(d<threshold || rnd()>Math.min(.98,(d-threshold)*(pass===0?2.8:2.0)))continue;
    const idx=Math.round(py)*w+Math.round(px),detail=A.detail[idx]||0;
    let theta=(pass===1?-.95:-.50)+(rnd()-.5)*.20;
    if((A.coh[idx]||0)>.3)theta+=Math.atan2(Math.sin(2*(A.ang[idx]-theta)),Math.cos(2*(A.ang[idx]-theta)))*.38;
    const length=(pass===0?12:pass===1?9:6)*(1-detail*.45)*( .7+rnd()*.6);
    const dx=Math.cos(theta)*length/2,dy=Math.sin(theta)*length/2;
    const xx=new Float32Array([b.x+px-dx,b.x+px,b.x+px+dx]),yy=new Float32Array([b.y+py-dy,b.y+py+(rnd()-.5)*.25,b.y+py+dy]);
    const coverage=Math.min(sample(px-dx,py-dy),sample(px+dx,py+dy));
    if(coverage<d*.25)continue;
    const alpha=(pass===0?.22:pass===1?.34:.50)*(.4+d*.85);
    list.push({x:xx,y:yy,pr:new Float32Array([.48,1,.42]),n:3,len:length,width:pass===0?1.1:pass===1?.8:.55,alpha,ghost:0,kind:'hatch',shade:d,studio:true,
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
 // Narrow pencil-side sweeps. Every source mark is deposited once, within
 // a few pixels of the moving tip; no face regions or finished tone tiles.
 function localShading(list,A){
  const groups=new Map(),width=5,length=38,angleStep=.4;
  for(const s of list){
   const angle=Math.atan2(s.y[2]-s.y[0],s.x[2]-s.x[0]);
   const bin=Math.round(angle/angleStep),theta=bin*angleStep,c=Math.cos(theta),d=Math.sin(theta);
   const u=s.x[1]*c+s.y[1]*d,v=-s.x[1]*d+s.y[1]*c;
   const row=Math.floor(v/width),col=Math.floor((u+(row%2)*length*.5)/length),key=bin+':'+row+':'+col;
   if(!groups.has(key))groups.set(key,{c,d,marks:[],min:Infinity,max:-Infinity,v:0});
   const g=groups.get(key);g.marks.push({s,u});g.min=Math.min(g.min,u);g.max=Math.max(g.max,u);g.v+=v;
  }
  const sweeps=[];
  for(const g of groups.values()){
   const v=g.v/g.marks.length,lo=g.min-1,hi=g.max+1,n=Math.max(2,Math.ceil((hi-lo)/1.5)+1);
   const x=new Float32Array(n),y=new Float32Array(n),pr=new Float32Array(n).fill(.8),inkGroups=Array.from({length:n-1},()=>[]);
   for(let i=0;i<n;i++){const u=lo+(hi-lo)*i/(n-1);x[i]=u*g.c-v*g.d;y[i]=u*g.d+v*g.c;}
   for(const {s,u} of g.marks)inkGroups[Math.min(n-2,Math.floor((u-lo)/(hi-lo)*(n-1)))].push(s);
   sweeps.push({x,y,pr,n,len:hi-lo,width:1,alpha:1,ghost:0,kind:'hatch',studio:true,inkGroups});
  }
  // Spatial index avoids an O(N²) nearest-neighbour search for dense photos.
  const buckets=new Map(),size=48,key=(x,y)=>Math.floor(x/size)+':'+Math.floor(y/size);
  for(const s of sweeps){const k=key(s.x[0],s.y[0]);if(!buckets.has(k))buckets.set(k,new Set());buckets.get(k).add(s);s.bucket=k;}
  let at={x:A.b.x+A.face.x,y:A.b.y+A.face.y-A.face.ry*.25};const out=[];
  while(buckets.size){
   const cx=Math.floor(at.x/size),cy=Math.floor(at.y/size);let candidates=[];
   for(let r=1;r<=24&&!candidates.length;r++)for(let yy=cy-r;yy<=cy+r;yy++)for(let xx=cx-r;xx<=cx+r;xx++){
    const set=buckets.get(xx+':'+yy);if(set)candidates.push(...set);
   }
   if(!candidates.length)candidates=[...buckets.values().next().value];
   let best=candidates[0],distance=Infinity,reverse=false;
   for(const s of candidates){const a=Math.hypot(s.x[0]-at.x,s.y[0]-at.y),b=Math.hypot(s.x[s.n-1]-at.x,s.y[s.n-1]-at.y);if(Math.min(a,b)<distance){distance=Math.min(a,b);best=s;reverse=b<a;}}
   const set=buckets.get(best.bucket);set.delete(best);if(!set.size)buckets.delete(best.bucket);
   if(reverse)best={...best,x:best.x.slice().reverse(),y:best.y.slice().reverse(),pr:best.pr.slice().reverse(),inkGroups:best.inkGroups.slice().reverse()};
   out.push(best);at={x:best.x[best.n-1],y:best.y[best.n-1]};
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
   {name:'형태 잡기',weight:.17,list:gestures},
   {name:'이목구비 그리기',weight:.20,list:details},
   {name:'머리카락과 옷의 선',weight:.14,list:rest.filter(s=>!finishing.has(s))},
   {name:'연필로 명암 칠하기',weight:.44,list:localShading(shading,A),ordered:true},
   {name:'마지막 세부 묘사',weight:.05,list:accents}
  ].filter(p=>p.list.length);
  const lead=(base.intro?base.intro.hold+base.intro.fade:0)+650,duration=Math.max(100,base.drawEndMs-lead),weight=phases.reduce((n,p)=>n+p.weight,0);
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
   const span=phase.ordered?Math.max(requested,raw):Math.max(requested,list.length*70),scale=span/Math.max(1,raw);
   for(const s of list){s.tLift=start+s.tLift*scale;s.tDown=start+s.tDown*scale;s.tUp=start+s.tUp*scale;}
   chapters.push({name:phase.name,start,end:start+span,count:list.length});for(const s of list)drawing.push(s);start+=span;
  }
  const extension=Math.max(0,start-base.drawEndMs);
  for(const s of writing){s.tLift+=extension;s.tDown+=extension;s.tUp+=extension;}
  const talk=base.talk?{...base.talk,start:base.talk.start+extension,end:base.talk.end+extension,blinkAt:base.talk.blinkAt+extension,beats:base.talk.beats.map(b=>({...b,start:b.start+extension,end:b.end+extension}))}:null;
  return {...base,totalMs:base.totalMs+extension,drawEndMs:start,talk,requestedMs:base.totalMs,strokes:[...drawing,...writing],chapters,ai:false,aiLayer:null,faithful:false,croquis:true,studio:true,faceEndMs:0,audio:buildAudioEvents([...drawing,...writing])};
 }
 return {marks,build};
})();
