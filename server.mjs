// Simple static server for the built Vite app (dist)
// Serves SPA with history fallback to index.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const port = process.env.PORT ? Number(process.env.PORT) : 8080;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendFile(res, filePath, statusCode = 200) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.writeHead(statusCode, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  try {
    const reqUrl = new URL(req.url || '/', 'http://localhost');
    let pathname = decodeURIComponent(reqUrl.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.join(distDir, pathname);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return sendFile(res, filePath);
    }
    // History fallback
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      return sendFile(res, indexPath);
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server error');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Static server running: http://localhost:${port}`);
});

