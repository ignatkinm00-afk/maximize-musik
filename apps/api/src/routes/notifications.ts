import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.ts';
import { currentUser, requireUser } from '../lib/auth.ts';
import { mapNotification, type NotificationRow } from '../lib/mappers.ts';
import { parse, pagination } from '../lib/validate.ts';

function audienceClause(role: string): { sql: string; params: string[] } {
  if (role === 'admin') {
    return { sql: "(n.user_id IS NULL AND n.audience IN ('all','admins'))", params: [] };
  }
  return { sql: "(n.user_id IS NULL AND n.audience IN ('all','users'))", params: [] };
}

export async function registerNotificationRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/notifications', async (req) => {
    const user = await requireUser(req, db);
    const query = parse(pagination, req.query);
    const audience = audienceClause(user.role);

    const rows = await db.all<NotificationRow>(
      `SELECT n.*, (SELECT r.read_at FROM notification_reads r
                    WHERE r.notification_id = n.id AND r.user_id = ?) AS read_at
       FROM notifications n
       WHERE n.user_id = ? OR ${audience.sql}
       ORDER BY n.created_at DESC
       LIMIT ? OFFSET ?`,
      [user.id, user.id, query.limit, query.offset],
    );

    return { notifications: rows.map(mapNotification) };
  });

  app.get('/api/notifications/unread-count', async (req) => {
    const user = await currentUser(req, db);
    if (!user) return { count: 0 };
    const audience = audienceClause(user.role);
    const row = await db.get<{ total: number | string }>(
      `SELECT COUNT(*) AS total FROM notifications n
       WHERE (n.user_id = ? OR ${audience.sql})
         AND NOT EXISTS (SELECT 1 FROM notification_reads r
                         WHERE r.notification_id = n.id AND r.user_id = ?)`,
      [user.id, user.id],
    );
    return { count: Number(row?.total ?? 0) };
  });

  app.post('/api/notifications/:id/read', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    await db.run(
      `INSERT INTO notification_reads (notification_id, user_id, read_at)
       VALUES (?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [id, user.id, new Date().toISOString()],
    );
    return { ok: true };
  });

  app.post('/api/notifications/read-all', async (req) => {
    const user = await requireUser(req, db);
    const audience = audienceClause(user.role);
    await db.run(
      `INSERT INTO notification_reads (notification_id, user_id, read_at)
       SELECT n.id, ?, ? FROM notifications n
       WHERE n.user_id = ? OR ${audience.sql}
       ON CONFLICT DO NOTHING`,
      [user.id, new Date().toISOString(), user.id],
    );
    return { ok: true };
  });
}
