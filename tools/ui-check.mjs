/**
 * Визуальная и функциональная проверка собранного приложения.
 * Запуск: node tools/ui-check.mjs
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173';
const OUT = 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const login = async () => {
  const response = await fetch('http://127.0.0.1:8899/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@maximize.local', password: 'admin12345' }),
  });
  const data = await response.json();
  if (!data.token) throw new Error('Не удалось получить токен админа');
  return data.token;
};

const problems = [];
const attachLogging = (page, label) => {
  page.on('pageerror', (error) => problems.push(`[${label}] pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`[${label}] console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('archive.org')) return;
    problems.push(`[${label}] requestfailed: ${url} ${request.failure()?.errorText ?? ''}`);
  });
};

const shot = async (page, name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}`);
};

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage'],
});

const token = await login();

// ─── Десктоп ────────────────────────────────────────────────────────────────
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await desktop.newPage();
attachLogging(page, 'desktop');

console.log('Десктоп:');
await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.hero', { timeout: 20000 });
await shot(page, '01-home');

await page.goto(`${BASE}/#/search`, { waitUntil: 'networkidle' });
await page.waitForSelector('.track-row', { timeout: 20000 });
await page.fill('.search-head input', 'Jahzzar');
await page.waitForTimeout(1200);
const searchCount = await page.locator('.track-row').count();
console.log(`  поиск: найдено карточек ${searchCount}`);
await shot(page, '02-search');

await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' });
await page.waitForSelector('.track-card', { timeout: 20000 });
await page.locator('.track-card .card-play').first().click();
await page.waitForTimeout(7000);
const playing = await page.locator('.player-bar.is-playing').count();
const timeText = await page.locator('.pb-progress span').first().innerText().catch(() => '0:00');
console.log(`  плеер: is-playing=${playing === 1}, позиция=${timeText}`);
if (playing !== 1) problems.push('Плеер не начал воспроизведение');
await shot(page, '03-playing');

await page.locator('.pb-track').click();
await page.waitForSelector('.full-player');
await page.waitForTimeout(1200);
await shot(page, '04-full-player');
await page.keyboard.press('Escape');

await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shot(page, '05-login');

await page.fill('input[type="email"]', 'admin@maximize.local');
await page.fill('input[type="password"]', 'admin12345');
await page.click('button[type="submit"]');
await page.waitForURL(/#\/$/, { timeout: 20000 });
await page.waitForSelector('.hero', { timeout: 20000 });
await shot(page, '06-home-auth');

await page.goto(`${BASE}/#/library`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot(page, '07-library');

await page.goto(`${BASE}/#/notifications`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await shot(page, '08-notifications');

await page.goto(`${BASE}/#/admin`, { waitUntil: 'networkidle' });
await page.waitForSelector('.stat-card', { timeout: 20000 });
await page.waitForTimeout(800);
await shot(page, '09-admin-dashboard');

await page.goto(`${BASE}/#/admin/tracks`, { waitUntil: 'networkidle' });
await page.waitForSelector('.admin-table', { timeout: 20000 });
await page.waitForTimeout(800);
await shot(page, '10-admin-tracks');

await page.goto(`${BASE}/#/admin/users`, { waitUntil: 'networkidle' });
await page.waitForSelector('.admin-table', { timeout: 20000 });
await shot(page, '11-admin-users');

await page.goto(`${BASE}/#/admin/broadcast`, { waitUntil: 'networkidle' });
await page.waitForSelector('.phone-preview', { timeout: 20000 });
await shot(page, '12-admin-broadcast');

// ─── Мобильный ──────────────────────────────────────────────────────────────
console.log('Мобильный:');
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const phone = await mobile.newPage();
attachLogging(phone, 'mobile');

await phone.goto(`${BASE}/__login?token=${encodeURIComponent(token)}&to=/`, { waitUntil: 'networkidle' });
await phone.waitForSelector('.hero', { timeout: 20000 });
await shot(phone, '13-mobile-home');

await phone.goto(`${BASE}/#/search`, { waitUntil: 'networkidle' });
await phone.waitForSelector('.track-row', { timeout: 20000 });
await shot(phone, '14-mobile-search');

await phone.locator('.track-row').first().click();
await phone.waitForTimeout(6000);
await phone.locator('.pb-mobile-expand').click();
await phone.waitForSelector('.full-player');
await phone.waitForTimeout(1200);
await shot(phone, '15-mobile-player');

await phone.goto(`${BASE}/#/library`, { waitUntil: 'networkidle' });
await phone.waitForTimeout(1500);
await shot(phone, '16-mobile-library');

await phone.goto(`${BASE}/#/admin/broadcast`, { waitUntil: 'networkidle' });
await phone.waitForSelector('.phone-preview', { timeout: 20000 }).catch(() => undefined);
await shot(phone, '17-mobile-admin');

await browser.close();

console.log('\nПроблемы:', problems.length === 0 ? 'нет' : '');
for (const problem of problems) console.log(' -', problem);
process.exit(problems.length ? 1 : 0);
