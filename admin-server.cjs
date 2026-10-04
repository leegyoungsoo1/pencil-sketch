const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const host = '127.0.0.1';
const port = Number(process.env.WOONG_ADMIN_PORT || 4173);
const home = '/renewal/woong-studio.html';
const mime = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
};

const server = http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  if (pathname === '/') pathname = home;
  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.stat(file, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('파일을 찾을 수 없습니다.');
      return;
    }

    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream'
    });
    fs.createReadStream(file).pipe(response);
  });
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.log(`관리자 작업실이 이미 실행 중입니다: http://${host}:${port}${home}`);
    process.exit(0);
  }
  throw error;
});

server.listen(port, host, () => {
  console.log(`웅토끼 관리자 작업실: http://${host}:${port}${home}`);
  console.log('이 창을 닫으면 관리자 작업실 서버도 종료됩니다.');
});
