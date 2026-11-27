/**
 * Добавляет музыку в репозиторий (GitHub Pages) и обновляет каталог.
 *
 *   npm run music:add -- "C:\Users\Digma\Music\Мой альбом"
 *   npm run music:add -- ./music --push
 *
 * Файлы копируются в apps/web/public/music, обложки — в music/covers,
 * каталог пишется в music/catalog.json. С флагом --push изменения
 * коммитятся и отправляются на GitHub.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseFile } from 'music-metadata';

const AUDIO_RE = /\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i;
const root = path.resolve(import.meta.dirname, '..');
const targetDir = path.join(root, 'apps/web/public/music');
const coversDir = path.join(targetDir, 'covers');
const catalogPath = path.join(targetDir, 'catalog.json');

const argv = process.argv.slice(2);
const push = argv.includes('--push');
const source = argv.find((value) => !value.startsWith('--'));

if (!source) {
  console.error('Укажи папку с музыкой: npm run music:add -- "C:\\Music" [--push]');
  process.exit(1);
}

const sourceDir = path.resolve(source);
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`Папка не найдена: ${sourceDir}`);
  process.exit(1);
}

const walk = (dir) => {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (AUDIO_RE.test(entry.name)) result.push(full);
  }
  return result;
};

const files = walk(sourceDir);
if (!files.length) {
  console.error('В папке нет аудиофайлов (mp3, m4a, aac, ogg, opus, wav, flac).');
  process.exit(1);
}

fs.mkdirSync(coversDir, { recursive: true });
const catalog = fs.existsSync(catalogPath)
  ? JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
  : [];
const byFile = new Map(catalog.map((entry) => [entry.file, entry]));

let added = 0;
let skipped = 0;
let totalBytes = 0;

for (const file of files) {
  const size = fs.statSync(file).size;
  if (size > 40 * 1024 * 1024) {
    console.warn(`⚠ пропуск (больше 40 МБ): ${path.basename(file)}`);
    continue;
  }

  let fileName = path.basename(file);
  let target = path.join(targetDir, fileName);
  if (fs.existsSync(target)) {
    if (byFile.has(fileName)) {
      skipped += 1;
      continue;
    }
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let index = 1;
    while (fs.existsSync(target)) {
      fileName = `${base}-${index}${ext}`;
      target = path.join(targetDir, fileName);
      index += 1;
    }
  }

  fs.copyFileSync(file, target);
  totalBytes += size;

  let metadata = {};
  try {
    metadata = await parseFile(target, { duration: true });
  } catch (error) {
    console.warn(`⚠ не удалось прочитать теги: ${fileName} (${error.message})`);
  }
  const common = metadata.common ?? {};

  let cover = null;
  const picture = common.picture?.[0];
  if (picture?.data) {
    const format = (picture.format ?? 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    cover = `covers/${path.basename(fileName, path.extname(fileName))}.${format}`;
    fs.writeFileSync(path.join(targetDir, cover), Buffer.from(picture.data));
  }

  const entry = {
    id: crypto.createHash('sha1').update(fileName).digest('hex').slice(0, 12),
    title: common.title?.trim() || path.basename(fileName, path.extname(fileName)),
    artist: common.artist?.trim() || common.albumartist?.trim() || 'Unknown',
    album: common.album?.trim() || null,
    genre: common.genre?.[0]?.trim() || null,
    duration: Math.round(metadata.format?.duration ?? 0),
    file: fileName,
    cover,
  };

  byFile.set(fileName, entry);
  added += 1;
  console.log(`✔ ${entry.artist} — ${entry.title}`);
}

const nextCatalog = [...byFile.values()].sort((a, b) =>
  a.artist.localeCompare(b.artist, 'ru') || a.title.localeCompare(b.title, 'ru'),
);
fs.writeFileSync(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`, 'utf8');

console.log(
  `\nДобавлено: ${added}, уже было: ${skipped}, всего в каталоге: ${nextCatalog.length}` +
    (totalBytes ? `, скопировано ${(totalBytes / 1024 / 1024).toFixed(1)} МБ` : ''),
);
console.log(`Каталог: ${path.relative(root, catalogPath)}`);

if (push) {
  const git = (args) => spawnSync('git', args, { cwd: root, stdio: 'inherit' });
  git(['add', 'apps/web/public/music']);
  const commit = git(['commit', '-m', `music: add ${added} tracks`]);
  if (commit.status === 0) {
    const pushResult = git(['push', 'origin', 'main']);
    process.exit(pushResult.status ?? 1);
  }
  console.log('Нечего коммитить или git недоступен — запушь вручную.');
} else {
  console.log('\nЧтобы выложить на GitHub:');
  console.log('  git add apps/web/public/music');
  console.log(`  git commit -m "music: add ${added} tracks"`);
  console.log('  git push origin main');
}
