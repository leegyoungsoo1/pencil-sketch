const fs=require('node:fs');
const path=require('node:path');

const renewalRoot=__dirname;
const repoRoot=path.resolve(renewalRoot,'..');
const outputRoot=path.join(repoRoot,'.public-site');
const outputRenewal=path.join(outputRoot,'renewal');
const cloudflareConfigPath=path.join(repoRoot,'wrangler.jsonc');

const publicFiles=[
  'index.html','fan-site.css','fan-site.js','install-app.css','install-app.js','service-worker.js','public-content.json',
  'fan-maker.html','fan-maker.css','fan-maker.js',
  'news-baila.html','news-view.css',
  'official-promo.html','official-promo-hub.css','official-promo-hub.js','official-promo.js',
  'work-view.html','work-view.css','work-view.js',
  'atelier.html','atelier.css','style-upgraded.css','mode-switch.css','studio.css','portrait.js','hand-motion.js','studio-graphite.js','atelier-app.js','atelier.js',
  'manifest.webmanifest',
  'icons/woong-rabbit-rounded-32.png','icons/woong-rabbit-rounded-180.png','icons/woong-rabbit-rounded-192.png','icons/woong-rabbit-rounded-512.png','icons/woong-rabbit-maskable-v2-512.png'
];
const publicAssetFolders=['assets/official-news','assets/public-works','assets/woong-rabbit','assets/first-stadium','assets/warm-meal','assets/heroic-age','assets/hero-contest','assets/summer-kindness','assets/site','assets/atelier','assets/backgrounds'];
const forbiddenPages=['official-promo-baila.html','woong-studio.html','story.html','woong-rabbit.html','woong-rabbit-series.html','sprite-stage.html','woong-rabbit-3d.html','warm-meal.html','summer-kindness.html','first-stadium.html','heroic-age.html','hero-contest.html'];
const maxPublicFileBytes=25*1024*1024;
function copyTree(source,destination){const stat=fs.statSync(source);if(stat.isDirectory()){fs.mkdirSync(destination,{recursive:true});for(const entry of fs.readdirSync(source))copyTree(path.join(source,entry),path.join(destination,entry))}else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(source,destination)}}
function allFiles(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(entry=>{const full=path.join(folder,entry.name);return entry.isDirectory()?allFiles(full):[full]})}

if(!fs.existsSync(cloudflareConfigPath))throw Error('Cloudflare 설정 파일이 없습니다: wrangler.jsonc');
const cloudflareConfig=JSON.parse(fs.readFileSync(cloudflareConfigPath,'utf8'));
const configuredAssetRoot=path.resolve(repoRoot,cloudflareConfig.assets?.directory||'');
if(configuredAssetRoot!==outputRoot)throw Error(`Cloudflare 공개 경로는 .public-site여야 합니다. 현재 설정: ${cloudflareConfig.assets?.directory||'(없음)'}`);

fs.rmSync(outputRoot,{recursive:true,force:true});
fs.mkdirSync(outputRenewal,{recursive:true});
for(const relative of publicFiles){const source=path.join(renewalRoot,relative);if(!fs.existsSync(source))throw Error(`공개 파일이 없습니다: ${relative}`);copyTree(source,path.join(outputRenewal,relative))}
for(const relative of publicAssetFolders){const source=path.join(renewalRoot,relative);if(!fs.existsSync(source))throw Error(`공개 자산 폴더가 없습니다: ${relative}`);copyTree(source,path.join(outputRenewal,relative))}

const redirect='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=renewal/index.html"><title>웅토끼 팬 스튜디오</title><p><a href="renewal/index.html">웅토끼 팬 스튜디오 열기</a></p></html>';
fs.writeFileSync(path.join(outputRoot,'index.html'),redirect);
fs.writeFileSync(path.join(outputRoot,'404.html'),redirect);
fs.writeFileSync(path.join(outputRoot,'.nojekyll'),'');

for(const forbiddenRoot of ['.git','.github','.test-output','node_modules']){
  if(fs.existsSync(path.join(outputRoot,forbiddenRoot)))throw Error(`공개 결과물에 내부 폴더가 포함됐습니다: ${forbiddenRoot}`);
}

const publicHtml=publicFiles.filter(file=>file.endsWith('.html')).map(file=>fs.readFileSync(path.join(outputRenewal,file),'utf8')).join('\n');
for(const forbidden of forbiddenPages){if(publicHtml.includes(forbidden))throw Error(`공개 페이지에 관리자 링크가 남아 있습니다: ${forbidden}`);if(fs.existsSync(path.join(outputRenewal,forbidden)))throw Error(`관리자 페이지가 공개 결과물에 포함됐습니다: ${forbidden}`)}
const localReference=/\b(?:src|href)=["']([^"']+)["']/g;
for(const relative of publicFiles.filter(file=>file.endsWith('.html'))){const htmlPath=path.join(outputRenewal,relative),html=fs.readFileSync(htmlPath,'utf8');for(const match of html.matchAll(localReference)){const value=match[1];if(!value||value.startsWith('#')||/^(?:https?:|data:|mailto:|javascript:)/i.test(value))continue;const clean=decodeURIComponent(value.split(/[?#]/)[0]);if(!clean)continue;const target=path.resolve(path.dirname(htmlPath),clean);if(!target.startsWith(outputRoot+path.sep)||!fs.existsSync(target))throw Error(`공개 HTML의 연결 파일이 없습니다: ${relative} -> ${clean}`)}}
const cssReference=/url\(\s*["']?([^"')]+)["']?\s*\)/g;
for(const relative of publicFiles.filter(file=>file.endsWith('.css'))){const cssPath=path.join(outputRenewal,relative),css=fs.readFileSync(cssPath,'utf8');for(const match of css.matchAll(cssReference)){const value=match[1];if(!value||/^(?:https?:|data:)/i.test(value))continue;const clean=decodeURIComponent(value.split(/[?#]/)[0]);const target=path.resolve(path.dirname(cssPath),clean);if(!target.startsWith(outputRoot+path.sep)||!fs.existsSync(target))throw Error(`공개 CSS의 연결 파일이 없습니다: ${relative} -> ${clean}`)}}
const oversized=allFiles(outputRoot).filter(file=>fs.statSync(file).size>=maxPublicFileBytes);
if(oversized.length)throw Error(`Cloudflare의 파일당 25MB 제한을 넘었습니다:\n${oversized.map(file=>`${path.relative(outputRoot,file)} (${(fs.statSync(file).size/1024/1024).toFixed(2)}MB)`).join('\n')}`);
console.log(`공개 사이트 빌드 완료: ${path.relative(repoRoot,outputRoot)}`);
console.log(`Cloudflare 공개 경로: ${cloudflareConfig.assets.directory}`);
console.log(`공개 HTML ${publicFiles.filter(file=>file.endsWith('.html')).length}개 · 관리자 제작 HTML 0개 · 내부 폴더 0개 · 25MB 이상 파일 0개`);
