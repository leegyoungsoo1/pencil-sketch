/* Rigid photographic hand: pencil tip remains registered to the live stroke. */
window.DrawingHand=(()=>{
 const poses={},tip={x:190,y:658};
 const ready=(async()=>{const image=new Image();image.src='assets/atelier/artist-hand.png';try{await image.decode();poses.draw={image};}catch(error){console.warn('Drawing hand unavailable:',error.message);}})();
 function schedule(strokes,rawMs,drawMs,leadMs,introMs){const scale=rawMs>0?drawMs/rawMs:0;strokes.forEach((s,i)=>{s.tLift=s.tLift*scale+(i===0?introMs:leadMs);s.tDown=s.tDown*scale+leadMs;s.tUp=s.tUp*scale+leadMs;});}
 function draw(ctx,pen,point,board,time,enabled){
  if(!poses.draw)return false;
  const vertical=Math.max(0,Math.min(1,(point.y-board.y)/board.h)),target=enabled?.14+.30*vertical:.28;
  let best={angle:target,scale:.7,cost:Infinity};
  // Keep every photographed forearm crop edge outside the frame, without bending skin.
  const cuts=[[1535,580],[1535,1023],[1240,1023]];
  for(let angle=target-.16;angle<=1.46;angle+=.035)for(let scale=.52;scale<=1.15;scale+=.035){
   const c=Math.cos(angle),s=Math.sin(angle);
   if(!cuts.every(([x,y])=>{const dx=(x-tip.x)*scale,dy=(y-tip.y)*scale;return point.x+dx*c-dy*s>ctx.canvas.width+12||point.y+dx*s+dy*c>ctx.canvas.height+12;}))continue;
   const cost=(scale-.60)**2*5+(angle-target)**2*.25;if(cost<best.cost)best={angle,scale,cost};
  }
  ctx.save();ctx.translate(point.x,point.y);ctx.rotate(best.angle);ctx.scale(best.scale,best.scale);ctx.drawImage(poses.draw.image,-tip.x,-tip.y);ctx.restore();return true;
 }
 return {ready,poses,schedule,draw};
})();
