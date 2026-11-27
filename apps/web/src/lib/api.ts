import type {
  AdminStats,
  AdminUser,
  AppNotification,
  Genre,
  HomeData,
  Playlist,
  SubscribersInfo,
  Track,
  User,
} from '../types';

const ACCESS_KEY = 'mm_token';
const REFRESH_KEY = 'mm_refresh';
const API_KEY = 'mm_api_base';

let token = typeof localStorage !== 'undefined' ? localStorage.getItem(ACCESS_KEY) ?? '' : '';
let refreshToken =
  typeof localStorage !== 'undefined' ? localStorage.getItem(REFRESH_KEY) ?? '' : '';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string {
  return token;
}

export function getRefreshToken(): string {
  return refreshToken;
}

export function setSessionTokens(accessToken: string, nextRefreshToken: string): void {
  token = accessToken;
  refreshToken = nextRefreshToken;
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, nextRefreshToken);
}

export function clearSession(): void {
  token = '';
  refreshToken = '';
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function apiBase(): string {
  if (typeof localStorage !== 'undefined') {
    const override = localStorage.getItem(API_KEY);
    if (override !== null && override.trim() !== '') return override.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.mmDesktop?.apiUrl) {
    return window.mmDesktop.apiUrl.replace(/\/$/, '');
  }
  return (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
}

export function setApiBase(value: string): void {
  localStorage.setItem(API_KEY, value.trim().replace(/\/$/, ''));
}

function resolveUrl(path: string): string {
  if (/^(https?:|file:|data:|blob:)/i.test(path)) return path;
  return `${apiBase()}${path}`;
}

export function mediaUrl(path: string | null | undefined): string {
  if (!path) return '';
  if (/^(https?:|file:|data:|blob:)/i.test(path)) return path;
  return `${apiBase()}${path}`;
}

export function streamUrl(track: Track): string {
  const base = resolveUrl(track.streamUrl);
  // Токен нужен только для аудио нашего API (черновиков), не для статики GitHub/file://
  if (!token || !track.streamUrl.startsWith('/api/')) return base;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${apiBase()}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (!response.ok) return false;
        const data = (await response.json()) as {
          accessToken?: string;
          refreshToken?: string;
        };
        if (!data.accessToken || !data.refreshToken) return false;
        setSessionTokens(data.accessToken, data.refreshToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

const NO_REFRESH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/telegram',
  '/api/auth/refresh',
]);

async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowRefresh = true,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError('Не удалось связаться с сервером. Проверь адрес API в настройках.');
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      allowRefresh &&
      refreshToken &&
      !NO_REFRESH_PATHS.has(path)
    ) {
      const refreshed = await refreshAccess();
      if (refreshed) return request<T>(path, options, false);
    }

    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('mm:unauthorized'));
    }
    const payload = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(
      payload.error ?? `Ошибка запроса (${response.status})`,
      response.status,
      payload.code,
    );
  }

  return data as T;
}
const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const result = search.toString();
  return result ? `?${result}` : '';
};

export const api = {
  // ─── Авторизация ──────────────────────────────────────────────────────────
  register: (data: { email: string; password: string; displayName: string }) =>
    request<{ accessToken: string; refreshToken: string; user: User }>('/api/auth/register', {
      body: data,
    }),
  login: (data: { email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string; user: User }>('/api/auth/login', {
      body: data,
    }),
  telegramLogin: (initData: string) =>
    request<{ accessToken: string; refreshToken: string; user: User }>('/api/auth/telegram', {
      body: { initData },
    }),
  logout: () => {
    const currentRefresh = getRefreshToken();
    if (!currentRefresh) return Promise.resolve({ ok: true });
    return request<{ ok: boolean }>('/api/auth/logout', {
      body: { refreshToken: currentRefresh },
    }).catch(() => ({ ok: true }));
  },
  logoutAll: () => request<{ ok: boolean }>('/api/auth/logout-all', { body: {} }),
  me: () => request<{ user: User }>('/api/auth/me'),
  updateMe: (data: { displayName?: string; avatarColor?: string }) =>
    request<{ user: User }>('/api/auth/me', { method: 'PATCH', body: data }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>('/api/auth/password', { body: data }),

  // ─── Каталог ──────────────────────────────────────────────────────────────
  home: () => request<HomeData>('/api/home'),
  tracks: (params: { q?: string; genre?: string; sort?: string; limit?: number; offset?: number } = {}) =>
    request<{ tracks: Track[]; total: number }>(`/api/tracks${query(params)}`),
  track: (id: string) => request<{ track: Track }>(`/api/tracks/${id}`),
  genres: () => request<{ genres: Genre[] }>('/api/genres'),
  recordPlay: (id: string) => request<{ ok: boolean }>(`/api/tracks/${id}/play`, { body: {} }),

  // ─── Библиотека ───────────────────────────────────────────────────────────
  likes: () => request<{ tracks: Track[] }>('/api/library/likes'),
  toggleLike: (trackId: string) =>
    request<{ liked: boolean }>(`/api/library/likes/${trackId}`, { body: {} }),
  recent: () => request<{ tracks: Track[] }>('/api/library/recent'),
  uploads: () => request<{ tracks: Track[] }>('/api/library/uploads'),
  summary: () => request<{ likes: number; playlists: number; plays: number }>('/api/library/summary'),
  playlists: () => request<{ playlists: Playlist[] }>('/api/library/playlists'),
  playlist: (id: string) =>
    request<{ playlist: Playlist; tracks: Track[] }>(`/api/library/playlists/${id}`),
  createPlaylist: (data: { title: string; description?: string }) =>
    request<{ playlist: Playlist }>('/api/library/playlists', { body: data }),
  updatePlaylist: (id: string, data: { title?: string; description?: string | null }) =>
    request<{ ok: boolean }>(`/api/library/playlists/${id}`, { method: 'PATCH', body: data }),
  deletePlaylist: (id: string) =>
    request<{ ok: boolean }>(`/api/library/playlists/${id}`, { method: 'DELETE' }),
  addToPlaylist: (playlistId: string, trackId: string) =>
    request<{ ok: boolean }>(`/api/library/playlists/${playlistId}/tracks`, { body: { trackId } }),
  removeFromPlaylist: (playlistId: string, trackId: string) =>
    request<{ ok: boolean }>(`/api/library/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
    }),

  uploadTrack: (formData: FormData) =>
    request<{ track: Track }>('/api/tracks/upload', { formData }),

  // ─── Уведомления ──────────────────────────────────────────────────────────
  notifications: (limit = 50) =>
    request<{ notifications: AppNotification[] }>(`/api/notifications?limit=${limit}`),
  unreadCount: () => request<{ count: number }>('/api/notifications/unread-count'),
  readNotification: (id: string) =>
    request<{ ok: boolean }>(`/api/notifications/${id}/read`, { body: {} }),
  readAllNotifications: () =>
    request<{ ok: boolean }>('/api/notifications/read-all', { body: {} }),

  // ─── Админка ──────────────────────────────────────────────────────────────
  adminStats: () => request<AdminStats>('/api/admin/stats'),
  adminUsers: (params: { q?: string; limit?: number; offset?: number } = {}) =>
    request<{ users: AdminUser[]; total: number }>(`/api/admin/users${query(params)}`),
  adminPatchUser: (id: string, data: { role?: 'user' | 'admin'; banned?: boolean }) =>
    request<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'PATCH', body: data }),
  adminTracks: (params: { q?: string; status?: string; limit?: number; offset?: number } = {}) =>
    request<{ tracks: Track[]; total: number }>(`/api/admin/tracks${query(params)}`),
  adminCreateTrack: (data: {
    title: string;
    artist: string;
    album?: string | null;
    genre?: string | null;
    duration?: number;
    audioUrl: string;
    coverUrl?: string | null;
    published?: boolean;
  }) => request<{ track: Track }>('/api/admin/tracks', { body: data }),
  adminUpdateTrack: (id: string, data: Partial<{ title: string; artist: string; published: boolean; genre: string | null }>) =>
    request<{ track: Track }>(`/api/admin/tracks/${id}`, { method: 'PATCH', body: data }),
  adminDeleteTrack: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/tracks/${id}`, { method: 'DELETE' }),
  adminCatalogSources: () =>
    request<{
      sources: Array<{
        id: 'audius' | 'jamendo' | 'fma';
        label: string;
        configured: boolean;
        hint: string;
      }>;
    }>('/api/admin/catalog/sources'),
  adminImportCatalog: (source: 'audius' | 'jamendo' | 'fma') =>
    request<{ source: string; fetched: number; added: number; total: number }>(
      '/api/admin/catalog/import',
      { body: { source } },
    ),
  adminNotifications: (limit = 30, offset = 0) =>
    request<{ notifications: AppNotification[]; total: number; bot: { configured: boolean; live: boolean } }>(
      `/api/admin/notifications?limit=${limit}&offset=${offset}`,
    ),
  adminBroadcast: (data: {
    title: string;
    body: string;
    link?: string | null;
    audience: 'all' | 'users' | 'admins';
    channels: Array<'inapp' | 'telegram'>;
  }) =>
    request<{ notification: AppNotification; telegramQueued: boolean }>(
      '/api/admin/notifications',
      { body: data },
    ),
  adminSubscribers: () => request<SubscribersInfo>('/api/admin/subscribers'),
  health: () => request<{ ok: boolean; db: string; tracks: number; telegram: string }>('/api/health'),
};

export const apiOrigin = () => apiBase();
