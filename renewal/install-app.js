(()=>{'use strict';
let installPrompt=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isiOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const isAndroid=()=>/android/i.test(navigator.userAgent);

function guide(){
 if(isiOS())return '<strong>아이폰 · 아이패드</strong>Safari 아래쪽의 공유 버튼(□↑)을 누른 뒤 <b>홈 화면에 추가</b>를 선택해 주세요.';
 if(isAndroid())return '<strong>안드로이드 휴대폰</strong>Chrome 오른쪽 위의 점 3개(⋮)를 누른 뒤 <b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 선택해 주세요.';
 return '<strong>PC · 노트북</strong>Chrome이나 Edge 주소창 오른쪽의 설치 아이콘을 누르거나, 브라우저 메뉴에서 <b>이 사이트를 앱으로 설치</b>를 선택해 주세요.';
}

function makeDialog(){
 const dialog=document.createElement('dialog');dialog.className='install-dialog';dialog.setAttribute('aria-labelledby','installDialogTitle');
 dialog.innerHTML='<div class="install-dialog-card"><button class="install-dialog-close" type="button" aria-label="닫기">×</button><img class="install-dialog-icon" src="icons/woong-rabbit-rounded-192.png" alt="웅토끼 앱 아이콘"><h2 id="installDialogTitle">웅토끼 바로가기 만들기</h2><p class="install-dialog-lead">홈 화면이나 PC 앱 목록에서 웅토끼 아이콘을 누르면 팬 스튜디오가 바로 열립니다.</p><div class="install-dialog-guide"></div><p class="install-dialog-tip">브라우저 보안 정책에 따라 마지막 추가 확인은 직접 눌러야 합니다.</p></div>';
 dialog.querySelector('.install-dialog-guide').innerHTML=guide();dialog.querySelector('.install-dialog-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});document.body.append(dialog);return dialog;
}

function openGuide(dialog){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}

function cleanShareUrl(){const url=new URL(location.href);url.hash='';url.search='';return url.href;}

async function copyShareUrl(button){
 const url=cleanShareUrl();
 try{await navigator.clipboard.writeText(url)}catch{const area=document.createElement('textarea');area.value=url;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove()}
 const label=button.querySelector('.share-label'),original=label.textContent;label.textContent='주소 복사 완료';button.setAttribute('aria-label','공유 주소 복사 완료');button.classList.add('is-copied');setTimeout(()=>{label.textContent=original;button.setAttribute('aria-label','현재 페이지 공유하기');button.classList.remove('is-copied')},1800);
}

async function shareSite(button){
 const description=document.querySelector('meta[name="description"]')?.content||'임영웅을 함께 보고, 만들고, 응원하는 웅토끼 팬 스튜디오입니다.';
 const payload={title:document.title,text:description,url:cleanShareUrl()};
 if(navigator.share){try{await navigator.share(payload);return}catch(error){if(error?.name==='AbortError')return}}
 await copyShareUrl(button);
}

function makeShareButton(){
 const button=document.createElement('button');button.type='button';button.className='share-site-button';button.setAttribute('aria-label','현재 페이지 공유하기');button.innerHTML='<span class="share-mark" aria-hidden="true">↗</span><span class="share-label">공유하기</span>';button.addEventListener('click',()=>shareSite(button));document.body.append(button);
}

async function install(button,dialog){
 if(!installPrompt){openGuide(dialog);return;}
 button.disabled=true;
 try{await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice.outcome==='accepted')button.hidden=true;else openGuide(dialog);}catch{openGuide(dialog);}finally{installPrompt=null;button.disabled=false;}
}

function start(){
 if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});
 makeShareButton();
 if(isStandalone())return;
 const dialog=makeDialog(),button=document.createElement('button');button.type='button';button.className='install-shortcut-button';button.setAttribute('aria-label','웅토끼 팬 스튜디오 바로가기 만들기');button.innerHTML='<img src="icons/woong-rabbit-rounded-32.png" alt=""><span>바로가기 만들기</span>';button.addEventListener('click',()=>install(button,dialog));document.body.append(button);
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;button.classList.add('is-ready')});
 window.addEventListener('appinstalled',()=>{installPrompt=null;button.hidden=true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
