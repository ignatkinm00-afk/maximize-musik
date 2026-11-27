import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import type { Database } from '../db/index.ts';
import { config } from '../config.ts';
import { unauthorized } from './errors.ts';

export interface UserRow {
  id: string;
  email: string | null;
  password_hash: string | null;
  display_name: string;
  role: 'user' | 'admin';
  telegram_id: string | null;
  avatar_color: string;
  banned: number;
  token_version: number;
  created_at: string;
  last_seen_at: string | null;
}

export interface TokenPayload {
  sub: string;
  role: 'user' | 'admin';
  sid: string;
  ver: number;
  iat: number;
  exp: number;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TTL_SECONDS = 60 * 60 * 2;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${b64url(salt)}$${b64url(hash)}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, saltPart, hashPart] = stored.split('$');
  if (scheme !== 'scrypt' || !saltPart || !hashPart) return false;
  const salt = Buffer.from(saltPart, 'base64url');
  const expected = Buffer.from(hashPart, 'base64url');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signToken(user: Pick<UserRow, 'id' | 'role' | 'token_version'>, sid: string): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub: user.id,
      role: user.role,
      sid,
      ver: Number(user.token_version) || 0,
      iat: now,
      exp: now + ACCESS_TTL_SECONDS,
    }),
  );
  const signature = createHmac('sha256', config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = createHmac('sha256', config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;
    if (!decoded.sub || typeof decoded.exp !== 'number') return null;
    if (decoded.exp * 1000 < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function readToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null;
  const query = req.query as Record<string, unknown> | undefined;
  if (query && typeof query.token === 'string' && query.token) return query.token;
  return null;
}

const hashRefresh = (token: string) => createHash('sha256').update(token).digest('hex');

interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export async function createSession(
  db: Database,
  user: UserRow,
  meta: RequestMeta = {},
): Promise<SessionTokens> {
  const sid = randomUUID();
  const refreshToken = randomBytes(48).toString('base64url');
  const now = Date.now();

  await db.run(
    `INSERT INTO sessions (id, user_id, refresh_hash, created_at, expires_at, user_agent, ip, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
    [
      sid,
      user.id,
      hashRefresh(refreshToken),
      new Date(now).toISOString(),
      new Date(now + REFRESH_TTL_MS).toISOString(),
      meta.userAgent ?? null,
      meta.ip ?? null,
    ],
  );

  return { accessToken: signToken(user, sid), refreshToken };
}

export async function rotateSession(
  db: Database,
  refreshToken: string,
  meta: RequestMeta = {},
): Promise<{ user: UserRow; tokens: SessionTokens } | null> {
  const session = await db.get<{
    id: string;
    user_id: string;
    expires_at: string;
    revoked_at: string | null;
  }>('SELECT * FROM sessions WHERE refresh_hash = ?', [hashRefresh(refreshToken)]);

  if (!session || session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const user = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (!user || user.banned) return null;

  const nextRefresh = randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  await db.run(
    `UPDATE sessions SET refresh_hash = ?, expires_at = ?, user_agent = ?, ip = ?
     WHERE id = ?`,
    [hashRefresh(nextRefresh), expiresAt, meta.userAgent ?? null, meta.ip ?? null, session.id],
  );

  return {
    user,
    tokens: { accessToken: signToken(user, session.id), refreshToken: nextRefresh },
  };
}

export async function revokeSession(db: Database, refreshToken: string): Promise<void> {
  await db.run(
    'UPDATE sessions SET revoked_at = ? WHERE refresh_hash = ? AND revoked_at IS NULL',
    [new Date().toISOString(), hashRefresh(refreshToken)],
  );
}

export async function revokeAllSessions(db: Database, userId: string): Promise<void> {
  await db.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [
    new Date().toISOString(),
    userId,
  ]);
}

export async function bumpTokenVersion(db: Database, userId: string): Promise<void> {
  await db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [userId]);
}

export async function findUserByToken(db: Database, token: string): Promise<UserRow | null> {
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.banned) return null;
  if (Number(payload.ver ?? 0) !== Number(user.token_version ?? 0)) return null;
  return user;
}

export async function currentUser(req: FastifyRequest, db: Database): Promise<UserRow | null> {
  const token = readToken(req);
  if (!token) return null;
  return findUserByToken(db, token);
}

export async function requireUser(req: FastifyRequest, db: Database): Promise<UserRow> {
  const user = await currentUser(req, db);
  if (!user) throw unauthorized();
  return user;
}

export async function requireAdmin(req: FastifyRequest, db: Database): Promise<UserRow> {
  const user = await requireUser(req, db);
  if (user.role !== 'admin') throw unauthorized('Только для администраторов');
  return user;
}
