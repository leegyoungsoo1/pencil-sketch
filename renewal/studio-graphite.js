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
 function build(A,base,density=40){
  const drawing=marks(A).map(s=>({...s,alpha:s.alpha*(.8+density/200)})),writing=base.strokes.filter(s=>s.message||s.kind==='sign'||s.kind==='dot');
  let t=0;const lead=(base.intro?base.intro.hold+base.intro.fade:0)+380;
  for(let i=0;i<drawing.length;i++){
   const s=drawing[i];s.tLift=t;t+=3;s.tDown=t;t+=prepareStrokeMotion(s,i)/3+2;s.tUp=t;
  }
  DrawingHand.schedule(drawing,t,Math.max(100,base.drawEndMs-lead),lead,Math.max(0,lead-380));
  return {...base,strokes:[...drawing,...writing],ai:false,aiLayer:null,faithful:false,croquis:true,studio:true,faceEndMs:0,audio:buildAudioEvents([...drawing,...writing])};
 }
 return {marks,build};
})();
