import { spawn } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const children = [];

function start(label, command, args) {
  console.log(`\n▶ ${label}`);
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env },
    shell: process.platform === 'win32',
  });
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`✖ ${label} завершился с кодом ${code}`);
  });
  children.push(child);
  return child;
}

start('API (Fastify + SQLite) — http://localhost:8787', process.execPath, [
  '--watch',
  '--env-file-if-exists=.env',
  'apps/api/src/server.ts',
]);

start('Web (Vite) — http://localhost:5173', npm, ['--workspace', '@maximize/web', 'run', 'dev']);

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
