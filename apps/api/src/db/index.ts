import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { config, sqliteFile } from '../config.ts';

export type SqlValue = string | number | null;

export interface Database {
  dialect: 'sqlite' | 'postgres';
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const normalize = (value: unknown): string | number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return value;
  if (typeof value === 'bigint') return Number(value);
  return String(value);
};

class SqliteDatabase implements Database {
  dialect = 'sqlite' as const;
  #db: DatabaseSync;
  #cache = new Map<string, ReturnType<DatabaseSync['prepare']>>();

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.#db = new DatabaseSync(file);
    this.#db.exec('PRAGMA journal_mode = WAL;');
    this.#db.exec('PRAGMA foreign_keys = ON;');
  }

  #stmt(sql: string) {
    let stmt = this.#cache.get(sql);
    if (!stmt) {
      stmt = this.#db.prepare(sql);
      this.#cache.set(sql, stmt);
    }
    return stmt;
  }

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    return this.#stmt(sql).all(...params.map(normalize)) as T[];
  }

  async get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    return this.#stmt(sql).get(...params.map(normalize)) as T | undefined;
  }

  async run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    const result = this.#stmt(sql).run(...params.map(normalize));
    return { changes: Number(result.changes ?? 0) };
  }

  async exec(sql: string): Promise<void> {
    this.#db.exec(sql);
  }

  async close(): Promise<void> {
    this.#db.close();
  }
}

class PostgresDatabase implements Database {
  dialect = 'postgres' as const;
  #pool: pg.Pool;

  constructor(connectionString: string) {
    const needsSsl = /supabase|sslmode=require|neon\.tech/i.test(connectionString);
    this.#pool = new pg.Pool({
      connectionString,
      max: 6,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
  }

  #toPg(sql: string): string {
    let index = 0;
    return sql.replace(/\?/g, () => `$${++index}`);
  }

  async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    const result = await this.#pool.query(this.#toPg(sql), params.map(normalize));
    return result.rows as T[];
  }

  async get<T>(sql: string, params: SqlValue[] = []): Promise<T | undefined> {
    const result = await this.#pool.query(this.#toPg(sql), params.map(normalize));
    return result.rows[0] as T | undefined;
  }

  async run(sql: string, params: SqlValue[] = []): Promise<{ changes: number }> {
    const result = await this.#pool.query(this.#toPg(sql), params.map(normalize));
    return { changes: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.#pool.query(sql);
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }
}

export function createDatabase(): Database {
  if (config.databaseUrl) {
    return new PostgresDatabase(config.databaseUrl);
  }
  return new SqliteDatabase(sqliteFile);
}

export async function migrate(db: Database): Promise<void> {
  const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.exec(schema);
}

export const nowIso = () => new Date().toISOString();
