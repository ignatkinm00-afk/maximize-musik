import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.ts';
import type { Database } from '../db/index.ts';
import { nowIso } from '../db/index.ts';
import {
  currentUser,
  findUserByToken,
  hashPassword,
  requireUser,
  signToken,
  verifyPassword,
  verifyToken,
  type UserRow,
} from '../lib/auth.ts';
import { badRequest, conflict, forbidden, unauthorized } from '../lib/errors.ts';
import { mapUser } from '../lib/mappers.ts';
import { verifyInitData } from '../lib/telegram-auth.ts';
import { parse } from '../lib/validate.ts';

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];
const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Некорректный email'),
  password: z.string().min(8, 'Пароль должен быть минимум 8 символов').max(200),
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
  newPassword: z.string().min(8, 'Новый пароль минимум 8 символов').max(200),
});

export async function registerAuthRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.post('/api/auth/register', async (req, reply) => {
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
      created_at: nowIso(),
      last_seen_at: nowIso(),
    };
    await db.run(
      `INSERT INTO users (id, email, password_hash, display_name, role, telegram_id, avatar_color, banned, created_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.email,
        user.password_hash,
        user.display_name,
        user.role,
        null,
        user.avatar_color,
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

    reply.code(201);
    return { token: signToken(user), user: mapUser(user) };
  });

  app.post('/api/auth/login', async (req, reply) => {
    const body = parse(loginSchema, req.body);
    const user = await db.get<UserRow>('SELECT * FROM users WHERE email = ?', [body.email]);
    if (!user || !verifyPassword(body.password, user.password_hash)) {
      throw unauthorized('Неверный email или пароль');
    }
    if (user.banned) throw forbidden('Аккаунт заблокирован');

    await db.run('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowIso(), user.id]);
    reply.header('Cache-Control', 'no-store');
    return { token: signToken(user), user: mapUser(user) };
  });

  app.post('/api/auth/telegram', async (req, reply) => {
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
        created_at: nowIso(),
        last_seen_at: nowIso(),
      };
      await db.run(
        `INSERT INTO users (id, email, password_hash, display_name, role, telegram_id, avatar_color, banned, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          null,
          null,
          user.display_name,
          user.role,
          user.telegram_id,
          user.avatar_color,
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
    reply.header('Cache-Control', 'no-store');
    return { token: signToken(user), user: mapUser(user) };
  });

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

  app.post('/api/auth/password', async (req) => {
    const user = await requireUser(req, db);
    const body = parse(passwordSchema, req.body);
    if (user.password_hash && !verifyPassword(body.currentPassword, user.password_hash)) {
      throw unauthorized('Текущий пароль неверен');
    }
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [
      hashPassword(body.newPassword),
      user.id,
    ]);
    return { ok: true };
  });

  // Мягкая проверка токена: приложение спрашивает «жив ли вход».
  app.get('/api/auth/check', async (req) => {
    const token = (req.query as { token?: string })?.token ?? '';
    const payload = token ? verifyToken(token) : null;
    if (!payload) return { valid: false };
    const user = await findUserByToken(db, token);
    return { valid: Boolean(user), user: user ? mapUser(user) : null };
  });
}
