/**
 * Каталог из Audius API.
 * Документация: https://docs.audius.org/api/
 *
 * Audius может быть недоступен из отдельных стран/дата-центров (Cloudflare 403),
 * поэтому вызывающий код обязан иметь фолбэк на локальный catalog.json.
 */

export interface CatalogTrack {
  title: string;
  artist: string;
  album?: string | null;
  genre?: string | null;
  duration?: number;
  audioUrl: string;
  coverUrl?: string | null;
  color?: string;
}

interface AudiusTrack {
  id: string;
  title?: string;
  duration?: number;
  genre?: string;
  play_count?: number;
  artwork?: Record<string, string>;
  user?: { name?: string; handle?: string };
}

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];

export const audiusAppName = (process.env.AUDIUS_APP_NAME ?? 'MaximizeMusik').trim();
const audiusBase = (process.env.AUDIUS_API_BASE ?? 'https://api.audius.co').replace(/\/$/, '');

async function trending(time: 'week' | 'month', limit: number): Promise<AudiusTrack[]> {
  const url = `${audiusBase}/v1/tracks/trending?app_name=${encodeURIComponent(audiusAppName)}&time=${time}&limit=${limit}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'MaximizeMusik/1.0' },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Audius ${response.status}`);
  const payload = (await response.json()) as { data?: AudiusTrack[] };
  return payload.data ?? [];
}

export async function fetchAudiusCatalog(limit = 100): Promise<CatalogTrack[]> {
  const results = await Promise.allSettled([trending('week', limit), trending('month', limit)]);
  const raw: AudiusTrack[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') raw.push(...result.value);
  }
  if (!raw.length) {
    const reason = results.find((result) => result.status === 'rejected');
    throw new Error(
      reason && reason.status === 'rejected'
        ? (reason.reason as Error).message
        : 'Audius вернул пустой список',
    );
  }

  const catalog: CatalogTrack[] = [];
  const seen = new Set<string>();
  for (const track of raw) {
    if (!track.id || !track.title) continue;
    if (seen.has(track.id)) continue;
    seen.add(track.id);

    const duration = Math.round(Number(track.duration) || 0);
    if (duration < 45 || duration > 1800) continue;

    const artwork = track.artwork ?? {};
    catalog.push({
      title: track.title.slice(0, 120),
      artist: (track.user?.name ?? track.user?.handle ?? 'Audius Artist').slice(0, 120),
      album: null,
      genre: track.genre ? String(track.genre).slice(0, 40) : null,
      duration,
      audioUrl: `${audiusBase}/v1/tracks/${encodeURIComponent(track.id)}/stream?app_name=${encodeURIComponent(audiusAppName)}`,
      coverUrl:
        artwork['480x480'] ?? artwork['1000x1000'] ?? artwork['150x150'] ?? null,
      color: COLORS[catalog.length % COLORS.length]!,
    });
  }

  return catalog;
}
