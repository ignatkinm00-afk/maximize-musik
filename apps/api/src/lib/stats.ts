import type { Database } from '../db/index.ts';

export interface UserStats {
  xp: number;
  level: number;
  levelXp: number;
  nextLevelXp: number;
  progress: number;
  plays: number;
  likes: number;
  playlists: number;
  comments: number;
  followers: number;
  following: number;
  streak: number;
  rank: number;
  achievements: Array<{ code: string; title: string; description: string; unlocked: boolean }>;
}

const ACHIEVEMENTS = [
  { code: 'first_play', title: 'Первый трек', description: 'Послушать первый трек' },
  { code: 'plays_10', title: 'Меломан', description: '10 прослушиваний' },
  { code: 'plays_100', title: 'В теме', description: '100 прослушиваний' },
  { code: 'plays_500', title: 'Фанат', description: '500 прослушиваний' },
  { code: 'likes_10', title: 'Коллекционер', description: '10 лайков' },
  { code: 'likes_50', title: 'Гурман', description: '50 лайков' },
  { code: 'playlists_3', title: 'Диджей', description: 'Создать 3 плейлиста' },
  { code: 'comments_10', title: 'Комментатор', description: '10 комментариев' },
  { code: 'followers_3', title: 'Популярный', description: '3 подписчика' },
  { code: 'following_5', title: 'Свой круг', description: 'Подписаться на 5 человек' },
  { code: 'night_owl', title: 'Ночной слушатель', description: 'Слушать музыку после полуночи' },
] as const;

async function count(db: Database, sql: string, params: Array<string | number> = []): Promise<number> {
  const row = await db.get<{ total: number | string }>(sql, params);
  return Number(row?.total ?? 0);
}

export async function collectStats(db: Database, userId: string): Promise<UserStats> {
  const [plays, likes, playlists, comments, followers, following] = await Promise.all([
    count(db, 'SELECT COUNT(*) AS total FROM plays WHERE user_id = ?', [userId]),
    count(db, 'SELECT COUNT(*) AS total FROM likes WHERE user_id = ?', [userId]),
    count(db, 'SELECT COUNT(*) AS total FROM playlists WHERE user_id = ?', [userId]),
    count(db, 'SELECT COUNT(*) AS total FROM comments WHERE user_id = ?', [userId]),
    count(db, 'SELECT COUNT(*) AS total FROM follows WHERE following_id = ?', [userId]),
    count(db, 'SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?', [userId]),
  ]);

  const xp = plays * 2 + likes * 5 + playlists * 10 + comments * 3 + followers * 20 + following * 2;
  const level = Math.floor(Math.sqrt(xp / 40)) + 1;
  const levelXp = (level - 1) ** 2 * 40;
  const nextLevelXp = level ** 2 * 40;
  const progress = nextLevelXp > levelXp ? Math.min(100, ((xp - levelXp) / (nextLevelXp - levelXp)) * 100) : 100;

  const days = await db.all<{ day: string }>(
    `SELECT DISTINCT substr(played_at, 1, 10) AS day FROM plays
     WHERE user_id = ? ORDER BY day DESC LIMIT 400`,
    [userId],
  );
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const dayset = new Set(days.map((row) => row.day));
  if (!dayset.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (dayset.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const night = await db.all<{ played_at: string }>(
    'SELECT played_at FROM plays WHERE user_id = ? ORDER BY played_at DESC LIMIT 500',
    [userId],
  );
  const nightOwl = night.some((row) => {
    const hour = new Date(row.played_at).getHours();
    return hour >= 0 && hour < 5;
  });

  const unlocked: Record<string, boolean> = {
    first_play: plays >= 1,
    plays_10: plays >= 10,
    plays_100: plays >= 100,
    plays_500: plays >= 500,
    likes_10: likes >= 10,
    likes_50: likes >= 50,
    playlists_3: playlists >= 3,
    comments_10: comments >= 10,
    followers_3: followers >= 3,
    following_5: following >= 5,
    night_owl: nightOwl,
  };

  const better = await count(
    db,
    `SELECT COUNT(*) AS total FROM (
       SELECT user_id, COUNT(*) AS c FROM plays GROUP BY user_id
     ) ranked WHERE c > (SELECT COUNT(*) FROM plays WHERE user_id = ?)`,
    [userId],
  );

  return {
    xp,
    level,
    levelXp,
    nextLevelXp,
    progress: Math.round(progress),
    plays,
    likes,
    playlists,
    comments,
    followers,
    following,
    streak,
    rank: better + 1,
    achievements: ACHIEVEMENTS.map((item) => ({
      ...item,
      unlocked: Boolean(unlocked[item.code]),
    })),
  };
}
