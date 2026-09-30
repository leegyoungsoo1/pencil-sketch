'use strict';
const narrationDefault = [
 '건행! 오늘은 제가 먼저 왔어요.',
 '잠깐! 아직 문 열면 안 돼요!',
 '오래 앉아 계실 텐데… 음, 조금 딱딱하네?',
 '이 자리엔 폭신함을 추가!',
 '맨 뒤에서도 잘 보이나? 어… 무대가 콩알만 하잖아!',
 '화면을 키웠더니… 앗! 제 얼굴이 너무 큰데요?',
 '편하게 웃으실 준비, 완료!',
 '당신의 자리를 먼저 생각해요. 오늘도 건행!'
].join('\n\n');
const narrationEditor=document.getElementById('narration-text');
narrationEditor.value=narrationDefault;
const narrationStatus=document.getElementById('narration-status');
document.getElementById('narration-copy').onclick=async()=>{
 const value=narrationEditor.value.trim();
 if(!value){narrationStatus.textContent='먼저 나레이션을 입력해 주세요.';return;}
 try{await navigator.clipboard.writeText(value);narrationStatus.textContent='전체 대본을 복사했습니다. TTS 서비스에 붙여 넣어 한 번에 음성을 만들어 주세요.';}
 catch{narrationEditor.focus();narrationEditor.select();narrationStatus.textContent='대본을 선택했습니다. 복사 메뉴 또는 Ctrl+C로 복사해 주세요.';}
};
document.getElementById('narration-save').onclick=()=>{
 const value=narrationEditor.value.trim();
 if(!value){narrationStatus.textContent='먼저 나레이션을 입력해 주세요.';return;}
 const url=URL.createObjectURL(new Blob(['\uFEFF'+value],{type:'text/plain;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='웅토끼-01-TTS-전체대본.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
 narrationStatus.textContent='시간 표시 없는 전체 TTS 대본을 저장했습니다.';
};
narrationEditor.addEventListener('input',()=>{narrationStatus.textContent='수정한 문장으로 복사·저장됩니다. 영상 자막과 길이는 바뀌지 않습니다.';});
