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
 function localShading(list,A){
  const {face,b}=A,groups=new Map();
  for(const s of list){
   const x=s.x[1]-b.x,y=s.y[1]-b.y,nx=(x-face.x)/face.rx,ny=(y-face.y)/face.ry;
   let region;
   if(Math.abs(nx)<1.05&&ny>-.52&&ny<-.05)region=nx<0?0:1;
   else if(Math.abs(nx)<.34&&ny>=-.05&&ny<.4)region=2;
   else if(Math.abs(nx)<.65&&ny>=.4&&ny<.8)region=3;
   else if(Math.hypot(nx,ny)<1.12)region=nx<0?4:5;
   else if(ny<.6)region=6;
   else region=7;
   // All graphite densities/directions are mixed inside one small patch.
   // Warp the patch grid gently so the moving edge never reads as square tiles.
   const u=x+5*Math.sin(y*.13)+3*Math.sin(y*.037);
   const v=y+5*Math.sin(x*.11)+3*Math.sin(x*.041);
   const key=region+':'+Math.floor(u/10)+':'+Math.floor(v/10);
   if(!groups.has(key))groups.set(key,{region,x:s.x[1],y:s.y[1],strokes:[]});
   groups.get(key).strokes.push(s);
  }
  let at={x:b.x+face.x-face.rx*.45,y:b.y+face.y-face.ry*.25};const out=[];
  for(let region=0;region<8;region++){
   const cells=[...groups.values()].filter(g=>g.region===region);
   while(cells.length){let best=0,dist=Infinity;for(let i=0;i<cells.length;i++){const d=Math.hypot(cells[i].x-at.x,cells[i].y-at.y);if(d<dist){dist=d;best=i;}}
    const cell=cells.splice(best,1)[0],ordered=nearest(cell.strokes,at);out.push(...ordered);const last=ordered.at(-1);at={x:last.x[last.n-1],y:last.y[last.n-1]};
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
   {name:'형태 잡기',weight:.17,list:gestures},
   {name:'이목구비 그리기',weight:.20,list:details},
   {name:'머리카락과 옷의 선',weight:.14,list:rest.filter(s=>!finishing.has(s))},
   {name:'부분별 명암 쌓기',weight:.44,list:localShading(shading,A),ordered:true},
   {name:'마지막 세부 묘사',weight:.05,list:accents}
  ].filter(p=>p.list.length);
  const lead=(base.intro?base.intro.hold+base.intro.fade:0)+650,duration=Math.max(100,base.drawEndMs-lead),weight=phases.reduce((n,p)=>n+p.weight,0);
  let at=base.entry,start=lead;const drawing=[],chapters=[];
  for(const phase of phases){
   const list=phase.ordered?phase.list:nearest(phase.list,at);let raw=0;
   for(let i=0;i<list.length;i++){
    const s=list[i],gap=Math.hypot(s.x[0]-at.x,s.y[0]-at.y),speed=phase.ordered?3:1.5;
    s.tLift=raw;raw+=phase.ordered?2+Math.min(70,gap*.7):24+Math.min(280,gap*1.3);
    s.tDown=raw;raw+=prepareStrokeMotion(s,i)/speed+(phase.ordered?2:25);s.tUp=raw;
    s.chapter=phase.name;at={x:s.x[s.n-1],y:s.y[s.n-1]};
   }
   const span=duration*phase.weight/weight,scale=span/Math.max(1,raw);
   for(const s of list){s.tLift=start+s.tLift*scale;s.tDown=start+s.tDown*scale;s.tUp=start+s.tUp*scale;}
   chapters.push({name:phase.name,start,end:start+span,count:list.length});for(const s of list)drawing.push(s);start+=span;
  }
  return {...base,strokes:[...drawing,...writing],chapters,ai:false,aiLayer:null,faithful:false,croquis:true,studio:true,faceEndMs:0,audio:buildAudioEvents([...drawing,...writing])};
 }
 return {marks,build};
})();
