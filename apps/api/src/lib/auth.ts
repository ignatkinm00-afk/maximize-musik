import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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
  created_at: string;
  last_seen_at: string | null;
}

export interface TokenPayload {
  sub: string;
  role: 'user' | 'admin';
  iat: number;
  exp: number;
}

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

export function signToken(user: Pick<UserRow, 'id' | 'role'>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({ sub: user.id, role: user.role, iat: now, exp: now + 60 * 60 * 24 * 30 }),
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

export async function findUserByToken(db: Database, token: string): Promise<UserRow | null> {
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.banned) return null;
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
