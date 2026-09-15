const atelierStage=document.querySelector('#stage');
document.querySelector('#expandCanvas').addEventListener('click',event=>{
 const expanded=atelierStage.classList.toggle('is-expanded');
 event.currentTarget.setAttribute('aria-pressed',String(expanded));
 event.currentTarget.textContent=expanded?'기본 크기로':'화면 폭으로 확대';
});
document.querySelector('#fullscreenCanvas').addEventListener('click',async()=>{
 try{if(document.fullscreenElement)await document.exitFullscreen();else await atelierStage.requestFullscreen();}
 catch{atelierStage.classList.add('is-expanded');document.querySelector('#expandCanvas').setAttribute('aria-pressed','true');document.querySelector('#expandCanvas').textContent='기본 크기로';atelierStage.scrollIntoView({behavior:'smooth'});}
});
document.addEventListener('fullscreenchange',()=>document.querySelector('#fullscreenCanvas').textContent=document.fullscreenElement?'전체 화면 닫기 ↙':'전체 화면 ↗');
