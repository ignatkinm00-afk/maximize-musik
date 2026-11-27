import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import type { Database } from '../db/index.ts';
import { nowIso } from '../db/index.ts';
import {
  bumpTokenVersion,
  createSession,
  findUserByToken,
  hashPassword,
  requireUser,
  revokeAllSessions,
  revokeSession,
  rotateSession,
  verifyPassword,
  verifyToken,
  type UserRow,
} from '../lib/auth.ts';
import { badRequest, conflict, forbidden, HttpError, unauthorized } from '../lib/errors.ts';
import { mapUser } from '../lib/mappers.ts';
import { verifyInitData } from '../lib/telegram-auth.ts';
import { parse } from '../lib/validate.ts';

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];
const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;

const MAX_ATTEMPTS = 10;
const LOCK_MINUTES = 15;

const passwordPolicy = z
  .string()
  .min(10, 'Пароль должен быть минимум 10 символов')
  .max(200)
  .regex(/[A-Za-zА-Яа-я]/, 'Добавь хотя бы одну букву')
  .regex(/\d/, 'Добавь хотя бы одну цифру');

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: passwordPolicy,
  displayName: z.string().trim().min(2, 'Имя минимум 2 символа').max(40),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль').max(200),
});

const updateMeSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Цвет в формате #RRGGBB')
    .optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordPolicy,
});

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(200) });

const metaFrom = (req: { ip?: string; headers: Record<string, unknown> }) => ({
  ip: req.ip,
  userAgent:
    typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
});

async function registerFailedLogin(db: Database, email: string): Promise<void> {
  const current = await db.get<{ attempts: number; locked_until: string | null }>(
    'SELECT attempts, locked_until FROM login_attempts WHERE email = ?',
    [email],
  );
  const attempts = (Number(current?.attempts) || 0) + 1;
  const lockedUntil =
    attempts >= MAX_ATTEMPTS
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
      : null;
  await db.run(
    `INSERT INTO login_attempts (email, attempts, locked_until, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (email) DO UPDATE SET
       attempts = excluded.attempts,
       locked_until = excluded.locked_until,
       updated_at = excluded.updated_at`,
    [email, attempts === MAX_ATTEMPTS ? 0 : attempts, lockedUntil, nowIso()],
  );
}

export async function registerAuthRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (req, reply) => {
      const body = parse(registerSchema, req.body);
      const existing = await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [
        body.email,
      ]);
      if (existing) throw conflict('Аккаунт с таким email уже существует');

      const user: UserRow = {
        id: randomUUID(),
        email: body.email,
        password_hash: hashPassword(body.password),
        display_name: body.displayName,
        role: 'user',
        telegram_id: null,
        avatar_color: pickColor(),
        banned: 0,
        token_version: 0,
        created_at: nowIso(),
        last_seen_at: nowIso(),
      };
      await db.run(
        `INSERT INTO users (id, email, password_hash, display_name, role, telegram_id, avatar_color, banned, token_version, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.email,
          user.password_hash,
          user.display_name,
          user.role,
          null,
          user.avatar_color,
          0,
          0,
          user.created_at,
          user.last_seen_at,
        ],
      );

      await db.run(
        `INSERT INTO notifications (id, user_id, title, body, link, audience, channels, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 'all', 'inapp', NULL, ?)`,
        [
          randomUUID(),
          user.id,
          'Добро пожаловать в Maximize Musik 👋',
          'Слушай бесплатно: каталог, свои плейлисты, лайки и синхронизация между телефоном, Windows и Telegram.',
          '/library',
          nowIso(),
        ],
      );

      const tokens = await createSession(db, user, metaFrom(req));
      reply.code(201).header('Cache-Control', 'no-store');
      return { ...tokens, user: mapUser(user) };
    },
  );

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = parse(loginSchema, req.body);
      const attempt = await db.get<{ attempts: number; locked_until: string | null }>(
        'SELECT attempts, locked_until FROM login_attempts WHERE email = ?',
        [body.email],
      );
      if (attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) {
        throw new HttpError(
          429,
          `Слишком много попыток входа. Попробуй через ${LOCK_MINUTES} минут.`,
          'too_many_attempts',
        );
      }

      const user = await db.get<UserRow>('SELECT * FROM users WHERE email = ?', [body.email]);
      if (!user || !verifyPassword(body.password, user.password_hash)) {
        await registerFailedLogin(db, body.email);
        throw unauthorized('Неверный email или пароль');
      }
      if (user.banned) throw forbidden('Аккаунт заблокирован');

      await db.run('DELETE FROM login_attempts WHERE email = ?', [body.email]);
      await db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowIso(), user.id]);

      const tokens = await createSession(db, user, metaFrom(req));
      reply.header('Cache-Control', 'no-store');
      return { ...tokens, user: mapUser(user) };
    },
  );

  app.post(
    '/api/auth/refresh',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const body = parse(refreshSchema, req.body);
      const result = await rotateSession(db, body.refreshToken, metaFrom(req));
      if (!result) throw unauthorized('Сессия истекла, войди заново');
      reply.header('Cache-Control', 'no-store');
      return { ...result.tokens, user: mapUser(result.user) };
    },
  );

  app.post('/api/auth/logout', async (req) => {
    const body = parse(refreshSchema, req.body);
    await revokeSession(db, body.refreshToken);
    return { ok: true };
  });

  app.post('/api/auth/logout-all', async (req) => {
    const user = await requireUser(req, db);
    await revokeAllSessions(db, user.id);
    await bumpTokenVersion(db, user.id);
    return { ok: true };
  });

  app.post(
    '/api/auth/telegram',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      if (!config.telegram.token) throw badRequest('Telegram-бот не настроен на сервере');
      const body = parse(z.object({ initData: z.string().min(10) }), req.body);
      const verified = verifyInitData(body.initData, config.telegram.token);
      if (!verified) throw unauthorized('Подпись Telegram недействительна');

      const telegramId = String(verified.user.id);
      let user = await db.get<UserRow>('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
      if (!user) {
        const displayName =
          [verified.user.first_name, verified.user.last_name].filter(Boolean).join(' ').trim() ||
          verified.user.username ||
          'Слушатель';
        user = {
          id: randomUUID(),
          email: null,
          password_hash: null,
          display_name: displayName.slice(0, 40),
          role: 'user',
          telegram_id: telegramId,
          avatar_color: pickColor(),
          banned: 0,
          token_version: 0,
          created_at: nowIso(),
          last_seen_at: nowIso(),
        };
        await db.run(
          `INSERT INTO users (id, email, password_hash, display_name, role, telegram_id, avatar_color, banned, token_version, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            null,
            null,
            user.display_name,
            user.role,
            user.telegram_id,
            user.avatar_color,
            0,
            0,
            user.created_at,
            user.last_seen_at,
          ],
        );
      }
      if (user.banned) throw forbidden('Аккаунт заблокирован');

      await db.run(
        `INSERT INTO telegram_subscribers (telegram_id, username, first_name, notifications, created_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT (telegram_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name`,
        [
          telegramId,
          verified.user.username ?? null,
          verified.user.first_name ?? null,
          nowIso(),
        ],
      );

      await db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowIso(), user.id]);
      const tokens = await createSession(db, user, metaFrom(req));
      reply.header('Cache-Control', 'no-store');
      return { ...tokens, user: mapUser(user) };
    },
  );

  app.get('/api/auth/me', async (req) => {
    const user = await requireUser(req, db);
    return { user: mapUser(user) };
  });

  app.patch('/api/auth/me', async (req) => {
    const user = await requireUser(req, db);
    const body = parse(updateMeSchema, req.body);
    const next = {
      displayName: body.displayName ?? user.display_name,
      avatarColor: body.avatarColor ?? user.avatar_color,
    };
    await db.run('UPDATE users SET display_name = ?, avatar_color = ? WHERE id = ?', [
      next.displayName,
      next.avatarColor,
      user.id,
    ]);
    const updated = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [user.id]);
    return { user: mapUser(updated!) };
  });

  app.post(
    '/api/auth/password',
    { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } },
    async (req) => {
      const user = await requireUser(req, db);
      const body = parse(passwordSchema, req.body);
      if (user.password_hash && !verifyPassword(body.currentPassword, user.password_hash)) {
        throw unauthorized('Текущий пароль неверен');
      }
      await db.run('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [
        hashPassword(body.newPassword),
        user.id,
      ]);
      await revokeAllSessions(db, user.id);
      return { ok: true };
    },
  );

  // Мягкая проверка токена: приложение спрашивает «жив ли вход».
  app.get('/api/auth/check', async (req) => {
    const token = (req.query as { token?: string })?.token ?? '';
    const payload = token ? verifyToken(token) : null;
    if (!payload) return { valid: false };
    const user = await findUserByToken(db, token);
    return { valid: Boolean(user), user: user ? mapUser(user) : null };
  });
}
