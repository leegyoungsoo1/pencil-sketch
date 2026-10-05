(()=>{
'use strict';
const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const smooth=value=>{value=clamp(value);return value*value*(3-2*value)};
const profiles={
 'sing-dance':{frameSeconds:.115,sway:42,hop:15,tilt:.035,breath:.018},
 'sing-close':{frameSeconds:.16,sway:16,hop:6,tilt:.018,breath:.012},
 'sing-stage':{frameSeconds:.09,sway:58,hop:20,tilt:.045,breath:.024}
};
function interleave(keyFrames,transitionFrames){const result=[];for(let index=0;index<Math.min(keyFrames.length,transitionFrames.length);index++)result.push(keyFrames[index],transitionFrames[index]);return result}
function interleave24(keyFrames,quarterAFrames,transitionFrames,quarterBFrames){const result=[],length=Math.min(keyFrames.length,quarterAFrames.length,transitionFrames.length,quarterBFrames.length);for(let index=0;index<length;index++)result.push(keyFrames[index],quarterAFrames[index],transitionFrames[index],quarterBFrames[index]);return result}
function sample(name,time,{speed=1,intensity=1,offset=0,frameCount=24}={}){
 const count=Math.max(1,frameCount),profile=profiles[name]||profiles['sing-dance'],adjusted=Math.max(0,time*speed+offset),position=adjusted/profile.frameSeconds,step=Math.floor(position),within=position-step,frame=step%count,previous=(frame+count-1)%count,blend=smooth(clamp(within/.34)),beat=adjusted*Math.PI*2/1.18;
 return {frame,previous,blend,x:(Math.sin(beat*.48)*profile.sway+Math.sin(beat*1.05)*8)*intensity,y:-Math.abs(Math.sin(beat))*profile.hop*intensity,rotate:Math.sin(beat*.52)*profile.tilt*intensity,scaleX:1+Math.sin(beat)*profile.breath*intensity,scaleY:1-Math.sin(beat)*profile.breath*.72*intensity};
}
window.WoongMotionLibrary={interleave,interleave24,sample,names:Object.freeze(Object.keys(profiles))};
})();
