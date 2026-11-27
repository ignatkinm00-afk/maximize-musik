import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const API_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(API_ROOT, '../..');

// .env читается до формирования конфига (npm-скрипты дополнительно передают --env-file).
try {
  process.loadEnvFile(path.join(REPO_ROOT, '.env'));
} catch {
  // .env отсутствует — работаем на значениях по умолчанию.
}

const trim = (v: string | undefined) => (v ?? '').trim();

const publicApiUrl = (
  trim(process.env.PUBLIC_API_URL) ||
  trim(process.env.RENDER_EXTERNAL_URL) ||
  'http://localhost:8787'
).replace(/\/$/, '');

export const config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: trim(process.env.JWT_SECRET) || 'dev-secret-change-me',
  adminEmail: (trim(process.env.ADMIN_EMAIL) || 'admin@maximize.local').toLowerCase(),
  adminPassword: trim(process.env.ADMIN_PASSWORD) || 'admin12345',
  databaseUrl: trim(process.env.DATABASE_URL),
  publicApiUrl,
  webUrl: (trim(process.env.WEB_URL) || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: trim(process.env.CORS_ORIGINS) || '*',
  dataDir: path.resolve(trim(process.env.DATA_DIR) || path.join(API_ROOT, 'data')),
  telegram: {
    token: trim(process.env.TELEGRAM_BOT_TOKEN),
    webhookUrl: trim(process.env.TELEGRAM_WEBHOOK_URL).replace(/\/$/, ''),
    webhookSecret: trim(process.env.TELEGRAM_WEBHOOK_SECRET) || 'maximize-webhook',
  },
  supabase: {
    url: trim(process.env.SUPABASE_URL).replace(/\/$/, ''),
    key: trim(process.env.SUPABASE_SERVICE_KEY),
    bucket: trim(process.env.SUPABASE_BUCKET) || 'maximize-media',
  },
  r2: {
    accountId: trim(process.env.R2_ACCOUNT_ID),
    accessKeyId: trim(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: trim(process.env.R2_SECRET_ACCESS_KEY),
    bucket: trim(process.env.R2_BUCKET) || 'maximize-music',
    publicUrl: trim(process.env.R2_PUBLIC_URL).replace(/\/$/, ''),
  },
};

export const uploadsDir = path.join(config.dataDir, 'uploads');
export const sqliteFile = path.join(config.dataDir, 'app.db');
