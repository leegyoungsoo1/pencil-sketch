const atelierStage=document.querySelector('#stage');
document.querySelector('#shrinkCanvas').addEventListener('click',()=>{
 const width=document.querySelector('.canvas-wrap').getBoundingClientRect().width;
 atelierStage.classList.remove('is-expanded');atelierStage.style.setProperty('--preview-width',`${Math.max(200,width*.8)}px`);
 document.querySelector('#expandCanvas').setAttribute('aria-pressed','false');document.querySelector('#expandCanvas').textContent='화면 폭으로 확대';
});
document.querySelector('#expandCanvas').addEventListener('click',event=>{
 atelierStage.style.removeProperty('--preview-width');
 const expanded=atelierStage.classList.toggle('is-expanded');
 event.currentTarget.setAttribute('aria-pressed',String(expanded));
 event.currentTarget.textContent=expanded?'기본 크기로':'화면 폭으로 확대';
});
document.querySelector('#fullscreenCanvas').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await atelierStage.requestFullscreen();}
 catch{atelierStage.classList.add('is-expanded');document.querySelector('#expandCanvas').setAttribute('aria-pressed','true');document.querySelector('#expandCanvas').textContent='기본 크기로';atelierStage.scrollIntoView({behavior:'smooth'});}
});
document.addEventListener('fullscreenchange',()=>document.querySelector('#fullscreenCanvas').textContent=document.fullscreenElement?'전체 화면 닫기 ↙':'전체 화면 ↗');
