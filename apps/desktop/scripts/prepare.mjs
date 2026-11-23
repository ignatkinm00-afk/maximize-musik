import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopDir = path.resolve(__dirname, '..');
const root = path.resolve(desktopDir, '../..');
const dist = path.resolve(root, 'apps/web/dist');
const target = path.resolve(desktopDir, 'renderer');

console.log('▶ Собираю веб-приложение для Windows (base=./)…');
execSync('npm run build --workspace @maximize/web', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE: './' },
});

if (!fs.existsSync(dist)) {
  console.error('Не найдена папка apps/web/dist — сборка не удалась.');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
fs.cpSync(dist, target, { recursive: true });

// Service worker не нужен внутри Electron и может мешать file://.
for (const name of ['sw.js', 'registerSW.js', 'manifest.webmanifest']) {
  const file = path.join(target, name);
  if (fs.existsSync(file)) fs.rmSync(file);
}

console.log(`✔ Renderer готов: ${path.relative(root, target)}`);
