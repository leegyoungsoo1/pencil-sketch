/* Original user hand/arm asset. Rigid rotation only: no mesh, skin extension,
   width changes, added shading, grip swaps or rest gestures. */
window.DrawingHand = (() => {
  const tip={x:16.6,y:243.1},pencilLength=423.6,poses={};
  const ready=(async()=>{
    const image=new Image();image.src='assets/hand-right.webp';
    try {await image.decode();poses.draw={image};}
    catch(error){console.warn('Original drawing arm unavailable:',error.message);}
  })();
  const clamp=x=>Math.max(0,Math.min(1,x));
  function schedule(strokes,rawMs,drawMs,leadMs,introMs) {
    const scale=rawMs>0?drawMs/rawMs:0;
    strokes.forEach((s,i)=>{
      s.tLift=s.tLift*scale+(i===0?introMs:leadMs);
      s.tDown=s.tDown*scale+leadMs;s.tUp=s.tUp*scale+leadMs;
    });
  }
  function draw(ctx,pen,point,board,time,enabled) {
    if(!poses.draw)return false;
    const horizontal=clamp((point.x-board.x)/board.w),vertical=clamp((point.y-board.y)/board.h);
    let angle=enabled?-.42+.58*horizontal-.10*(1-vertical):-.16;
    const scale=380/pencilLength;
    // The original photo is cropped along its right edge from y=704.
    // Rotate the intact arm downward until that entire cut lies below the frame.
    if(ctx.canvas.width>ctx.canvas.height) {
      const dx=poses.draw.image.width-1-tip.x,dy=700-tip.y;
      const radius=Math.hypot(dx,dy),required=(ctx.canvas.height+12-point.y)/scale;
      const safe=Math.asin(Math.max(-1,Math.min(1,required/radius)))-Math.atan2(dy,dx);
      angle=Math.max(angle,safe);
    }
    ctx.save();ctx.translate(point.x,point.y);ctx.rotate(angle);ctx.scale(scale,scale);
    ctx.drawImage(poses.draw.image,-tip.x,-tip.y);ctx.restore();return true;
  }
  return {ready,poses,schedule,draw};
})();
