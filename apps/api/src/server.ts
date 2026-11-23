import fs from 'node:fs/promises';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { config, uploadsDir } from './config.ts';
import { createDatabase, migrate } from './db/index.ts';
import { ensureAdmin, ensureCatalog } from './db/bootstrap.ts';
import { HttpError } from './lib/errors.ts';
import { telegram } from './lib/telegram.ts';
import { registerAdminRoutes } from './routes/admin.ts';
import { registerAuthRoutes } from './routes/auth.ts';
import { registerLibraryRoutes } from './routes/library.ts';
import { registerNotificationRoutes } from './routes/notifications.ts';
import { registerTrackRoutes } from './routes/tracks.ts';
import { registerUploadRoutes } from './routes/uploads.ts';

const db = createDatabase();
await migrate(db);
await ensureAdmin(db);
await ensureCatalog(db);

const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true,
  bodyLimit: 2 * 1024 * 1024,
});

await app.register(cors, {
  origin:
    config.corsOrigins === '*'
      ? true
      : config.corsOrigins.split(',').map((origin) => origin.trim()),
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
  exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length'],
  maxAge: 86400,
});

await app.register(rateLimit, { max: 400, timeWindow: '1 minute' });
await app.register(multipart, {
  limits: { fileSize: 45 * 1024 * 1024, files: 2, fields: 12 },
});

await fs.mkdir(uploadsDir, { recursive: true });
await app.register(fastifyStatic, {
  root: uploadsDir,
  prefix: '/media/',
  maxAge: '7d',
  immutable: true,
});

app.get('/api/config', async () => ({
  app: 'Maximize Musik',
  version: '1.0.0',
  webUrl: config.webUrl,
  telegram: {
    enabled: telegram.configured,
    username: telegram.username,
  },
}));

app.get('/api/health', async () => {
  const trackRow = await db.get<{ total: number | string }>(
    'SELECT COUNT(*) AS total FROM tracks',
  );
  return {
    ok: true,
    app: 'Maximize Musik',
    version: '1.0.0',
    db: db.dialect,
    tracks: Number(trackRow?.total ?? 0),
    telegram: telegram.live ? 'live' : telegram.configured ? 'configured' : 'off',
    time: new Date().toISOString(),
  };
});

app.get('/', async () => ({
  name: 'Maximize Musik API',
  docs: 'Смотри README.md в репозитории',
  health: '/api/health',
}));

await registerAuthRoutes(app, db);
await registerTrackRoutes(app, db);
await registerLibraryRoutes(app, db);
await registerNotificationRoutes(app, db);
await registerAdminRoutes(app, db);
await registerUploadRoutes(app, db);

app.post('/api/telegram/webhook', async (req, reply) => {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== config.telegram.webhookSecret) {
    reply.code(401);
    return { ok: false };
  }
  await telegram.handleUpdate(req.body as never);
  return { ok: true };
});

app.setNotFoundHandler((req, reply) => {
  reply.code(404).send({ error: 'Маршрут не найден', code: 'not_found' });
});

app.setErrorHandler((error, req, reply) => {
  if (error instanceof HttpError) {
    return reply
      .code(error.status)
      .send({ error: error.message, code: error.code, details: error.details });
  }
  const code = (error as { code?: string }).code;
  const statusCode = (error as { statusCode?: number }).statusCode;
  const message = error instanceof Error ? error.message : 'Ошибка запроса';
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({ error: message, code: code ?? 'bad_request' });
  }
  if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_FILES_LIMIT') {
    return reply.code(413).send({ error: 'Файл слишком большой', code: 'file_too_large' });
  }
  if (code === 'FST_INVALID_MULTIPART_CONTENT_TYPE') {
    return reply.code(400).send({ error: 'Некорректная загрузка файла', code: 'bad_request' });
  }
  req.log.error(error);
  return reply.code(500).send({ error: 'Внутренняя ошибка сервера', code: 'internal' });
});

await telegram.init(db);

const shutdown = async (signal: string) => {
  app.log.info(`Получен ${signal}, останавливаюсь…`);
  await app.close();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: config.port, host: config.host });
  app.log.info(`Maximize Musik API: http://localhost:${config.port}`);
  app.log.info(`Админ по умолчанию: ${config.adminEmail} / ${config.adminPassword}`);
  app.log.info(`База: ${db.dialect}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
