const BASE = process.env.API_BASE ?? 'http://127.0.0.1:8787';

const call = async (path, options = {}) => {
  const headers = { ...(options.headers ?? {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 200);
  }
  if (!response.ok) console.log(`  ✖ ${options.method ?? 'GET'} ${path} → ${response.status}`, data);
  return { status: response.status, data };
};

const check = (name, condition, extra = '') => {
  console.log(`${condition ? '✔' : '✖'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!condition) process.exitCode = 1;
};

// health
const health = await call('/api/health');
check('health', health.data.ok === true, `${health.data.tracks} треков, ${health.data.db}`);

// admin login
const login = await call('/api/auth/login', {
  body: { email: 'admin@maximize.local', password: 'admin12345' },
});
check('вход админа', login.status === 200 && login.data.accessToken, login.data.user?.role);
const admin = login.data.accessToken;

// home
const home = await call('/api/home');
check(
  'главная',
  home.status === 200 && home.data.newest.length > 0 && home.data.totalTracks > 0,
  `${home.data.totalTracks} треков, ${home.data.genres.length} жанров`,
);

// search
const search = await call('/api/tracks?q=a&limit=5');
check('поиск', search.status === 200 && Array.isArray(search.data.tracks), `${search.data.total} найдено`);

// track + stream
const track = home.data.featured ?? home.data.newest[0];
const stream = await fetch(`${BASE}${track.streamUrl}`, { headers: { Range: 'bytes=0-1023' } });
const bytes = await stream.arrayBuffer();
check(
  'стриминг аудио',
  (stream.status === 206 || stream.status === 200) && bytes.byteLength > 0,
  `${stream.status}, ${bytes.byteLength} байт, ${stream.headers.get('content-type')}`,
);

// like
const like = await call(`/api/library/likes/${track.id}`, { method: 'POST', token: admin, body: {} });
check('лайк', like.status === 200 && typeof like.data.liked === 'boolean', String(like.data.liked));
await call(`/api/library/likes/${track.id}`, { method: 'POST', token: admin, body: {} });

// playlist
const created = await call('/api/library/playlists', { token: admin, body: { title: 'Тестовый плейлист' } });
check('создание плейлиста', created.status === 201 && created.data.playlist.id);
const playlistId = created.data.playlist.id;
const add = await call(`/api/library/playlists/${playlistId}/tracks`, {
  token: admin,
  body: { trackId: track.id },
});
check('добавление в плейлист', add.status === 200);
const playlist = await call(`/api/library/playlists/${playlistId}`, { token: admin });
check('плейлист с треками', playlist.data.tracks?.length === 1, `mine=${playlist.data.playlist.mine}`);

// register + user actions
const email = `test${Date.now()}@example.com`;
const reg = await call('/api/auth/register', {
  body: { email, password: 'password123', displayName: 'Тестовый Слушатель' },
});
check('регистрация', reg.status === 201 && reg.data.accessToken, reg.data.user?.displayName);

const weak = await call('/api/auth/register', {
  body: { email: `weak${Date.now()}@example.com`, password: 'short', displayName: 'Weak' },
});
check('слабый пароль отклонён', weak.status === 400);

const refreshed = await call('/api/auth/refresh', {
  body: { refreshToken: reg.data.refreshToken },
});
check('refresh-токен', refreshed.status === 200 && Boolean(refreshed.data.accessToken));
const user = refreshed.data.accessToken;

const bad = await call('/api/auth/login', { body: { email, password: 'wrongpass' } });
check('неверный пароль отклонён', bad.status === 401);

const forbidden = await call('/api/admin/stats', { token: user });
check('запрет админки для юзера', forbidden.status === 401 || forbidden.status === 403);

const unreadBefore = await call('/api/notifications/unread-count', { token: user });
check('счётчик уведомлений', typeof unreadBefore.data.count === 'number', String(unreadBefore.data.count));

const broadcast = await call('/api/admin/notifications', {
  token: admin,
  body: {
    title: 'Проверка рассылки',
    body: 'Это тестовое уведомление из автотеста.',
    audience: 'all',
    channels: ['inapp'],
    link: '/search',
  },
});
check('рассылка', broadcast.status === 201 && broadcast.data.notification.id);

const inbox = await call('/api/notifications', { token: user });
check('уведомление в инбоксе', inbox.data.notifications?.some((n) => n.title === 'Проверка рассылки'));
const unreadAfter = await call('/api/notifications/unread-count', { token: user });
check('непрочитанных стало больше', unreadAfter.data.count > unreadBefore.data.count, `${unreadBefore.data.count} → ${unreadAfter.data.count}`);

// admin stats
const stats = await call('/api/admin/stats', { token: admin });
check(
  'статистика',
  stats.status === 200 && stats.data.totals.tracks >= 60 && stats.data.daily.length === 14,
  `${stats.data.totals.users} пользователей, ${stats.data.totals.plays} прослушиваний`,
);

// user upload (small fake mp3)
const form = new FormData();
form.append('audio', new Blob([new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0])], { type: 'audio/mpeg' }), 'demo.mp3');
form.append('title', 'Мой тестовый трек');
form.append('artist', 'Автотест');
form.append('duration', '12');
const upload = await fetch(`${BASE}/api/tracks/upload`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${user}` },
  body: form,
});
const uploadData = await upload.json();
check('загрузка трека', upload.status === 201 && uploadData.track?.published === false, uploadData.track?.title);

// admin publish
const publish = await call(`/api/admin/tracks/${uploadData.track.id}`, {
  method: 'PATCH',
  token: admin,
  body: { published: true },
});
check('публикация трека', publish.status === 200 && publish.data.track.published === true);

const logout = await call('/api/auth/logout', {
  body: { refreshToken: refreshed.data.refreshToken },
});
check('выход из сессии', logout.status === 200);

const afterLogout = await call('/api/auth/refresh', {
  body: { refreshToken: refreshed.data.refreshToken },
});
check('отозванный refresh не работает', afterLogout.status === 401);

// cleanup created playlist
await call(`/api/library/playlists/${playlistId}`, { method: 'DELETE', token: admin });
await call(`/api/admin/tracks/${uploadData.track.id}`, { method: 'DELETE', token: admin });

console.log('\nГотово.');
process.exit(process.exitCode ?? 0);
