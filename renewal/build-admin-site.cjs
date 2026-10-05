const fs = require('node:fs');
const path = require('node:path');

const renewalRoot = __dirname;
const repoRoot = path.resolve(renewalRoot, '..');
const outputRoot = path.join(repoRoot, '.admin-site');
const outputRenewal = path.join(outputRoot, 'renewal');
const excludedDirectories = new Set(['.test-output', '__pycache__']);
const excludedFiles = file => /^verify-.*\.cjs$/i.test(file) || /^build-.*-site\.cjs$/i.test(file);

function copyTree(source, destination) {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    if (excludedDirectories.has(path.basename(source))) return;
    fs.mkdirSync(destination, { recursive: true });
    for (const entry of fs.readdirSync(source)) {
      copyTree(path.join(source, entry), path.join(destination, entry));
    }
    return;
  }

  if (excludedFiles(path.basename(source))) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
copyTree(renewalRoot, outputRenewal);

const redirect = '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=renewal/woong-studio.html"><meta name="robots" content="noindex,nofollow"><title>웅토끼 관리자 작업실</title><p><a href="renewal/woong-studio.html">관리자 작업실 열기</a></p></html>';
fs.writeFileSync(path.join(outputRoot, 'index.html'), redirect);
fs.writeFileSync(path.join(outputRoot, '404.html'), redirect);
fs.writeFileSync(path.join(outputRoot, '.nojekyll'), '');
fs.writeFileSync(path.join(outputRoot, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

for (const required of ['woong-studio.html', 'official-promo-baila.html', 'official-promo-moise.html', 'official-promo.js', 'official-promo.css']) {
  if (!fs.existsSync(path.join(outputRenewal, required))) {
    throw Error(`GitHub 관리자 배포 파일이 없습니다: ${required}`);
  }
}

const copiedFiles = [];
function collect(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) collect(full);
    else copiedFiles.push(full);
  }
}
collect(outputRoot);
const totalBytes = copiedFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
console.log(`GitHub 관리자 작업실 빌드 완료: ${path.relative(repoRoot, outputRoot)}`);
console.log(`관리자 허브: renewal/woong-studio.html`);
console.log(`파일 ${copiedFiles.length}개 · ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
