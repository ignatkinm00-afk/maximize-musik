/**
 * Готовит Android-ассеты: копирует production-сборку веба в APK,
 * убирает PWA-файлы (в WebView они не нужны) и внедряет адрес API.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'apps/web/dist');
const target = path.join(root, 'apps/mobile/android/app/src/main/assets/public');
const apiUrl = (process.env.API_URL ?? '').trim().replace(/\/$/, '');

if (!fs.existsSync(dist)) {
  console.error('Нет apps/web/dist — сначала собери веб: npm run build');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(dist, target, { recursive: true });

for (const name of fs.readdirSync(target)) {
  if (/^(sw|registerSW|manifest|workbox-)/.test(name)) {
    fs.rmSync(path.join(target, name), { recursive: true, force: true });
  }
}

const indexPath = path.join(target, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/g, '')
  .replace(/\s*<script[^>]*registerSW[^>]*><\/script>/g, '');

if (apiUrl) {
  const config = `<script>try{localStorage.setItem('mm_api_base',${JSON.stringify(apiUrl)});}catch(e){}</script>`;
  html = html.replace('</head>', `${config}</head>`);
}

fs.writeFileSync(indexPath, html);
console.log(`Android assets ready${apiUrl ? ` (API: ${apiUrl})` : ' (API задаётся на экране входа)'}`);
