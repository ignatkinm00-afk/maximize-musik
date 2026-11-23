/**
 * Мини-сервер для локальной проверки production-сборки:
 * отдаёт apps/web/dist, проксирует /api и /media на backend,
 * умеет /__login?token=...&to=/admin — ставит токен в localStorage (только для скриншотов).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../apps/web/dist');
const API = process.env.API_ORIGIN ?? 'http://127.0.0.1:8899';
const PORT = Number(process.env.PORT ?? 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  if (url.pathname === '/__login') {
    const token = (url.searchParams.get('token') ?? '').replace(/'/g, '');
    const to = (url.searchParams.get('to') ?? '/').replace(/'/g, '');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><meta charset="utf-8"><script>
      localStorage.setItem('mm_token', '${token}');
      localStorage.setItem('mm_api_base', '');
      location.replace('/#${to}');
    </script>`);
    return;
  }

  if (url.pathname === '/__logout') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`<!doctype html><meta charset="utf-8"><script>
      localStorage.removeItem('mm_token');
      location.replace('/#/');
    </script>`);
    return;
  }

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/media')) {
    const target = new URL(API);
    const proxyReq = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        path: `${url.pathname}${url.search}`,
        method: req.method,
        headers: { ...req.headers, host: target.host },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', (error) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `API недоступен: ${error.message}` }));
    });
    req.pipe(proxyReq);
    return;
  }

  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(ROOT, safePath);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html');
  }

  const extension = path.extname(file).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[extension] ?? 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=60',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Maximize Musik static preview: http://127.0.0.1:${PORT} (API: ${API})`);
});
