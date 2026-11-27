import { motion } from 'framer-motion';
import { CloudDownload, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatCount, formatTime } from '../../lib/format';
import { useUi } from '../../store/ui';
import type { Track } from '../../types';
import { Cover, Modal, Segmented, Spinner } from '../../components/ui';

const emptyForm = {
  title: '',
  artist: '',
  album: '',
  genre: '',
  audioUrl: '',
  coverUrl: '',
  lyrics: '',
  duration: '',
};

export function AdminTracks() {
  const pushToast = useUi((state) => state.pushToast);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Track | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [r2Open, setR2Open] = useState(false);
  const [r2Prefix, setR2Prefix] = useState('music/');
  const [r2Genre, setR2Genre] = useState('');
  const [r2Importing, setR2Importing] = useState(false);
  const [sources, setSources] = useState<
    Array<{ id: 'audius' | 'jamendo' | 'fma'; label: string; configured: boolean; hint: string }>
  >([]);
  const [source, setSource] = useState<'audius' | 'jamendo' | 'fma'>('audius');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.adminTracks({
        q: query || undefined,
        status: status === 'all' ? undefined : status,
        limit: 60,
      });
      setTracks(data.tracks);
      setTotal(data.total);
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status]);

  const create = async () => {
    if (!form.title.trim() || !form.artist.trim() || !form.audioUrl.trim()) {
      pushToast('Заполни название, исполнителя и ссылку на аудио', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await api.adminCreateTrack({
        title: form.title.trim(),
        artist: form.artist.trim(),
        album: form.album.trim() || null,
        genre: form.genre.trim() || null,
        duration: Number(form.duration) || 0,
        audioUrl: form.audioUrl.trim(),
        coverUrl: form.coverUrl.trim() || null,
        lyrics: form.lyrics.trim() || null,
      });
      setTracks((current) => [data.track, ...current]);
      setTotal((current) => current + 1);
      setCreateOpen(false);
      setForm(emptyForm);
      pushToast('Трек добавлен', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (track: Track) => {
    setBusyId(track.id);
    try {
      const data = await api.adminUpdateTrack(track.id, { published: !track.published });
      setTracks((current) => current.map((item) => (item.id === track.id ? data.track : item)));
      pushToast(data.track.published ? 'Трек опубликован' : 'Трек снят с публикации', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.adminDeleteTrack(deleting.id);
      setTracks((current) => current.filter((item) => item.id !== deleting.id));
      setTotal((current) => Math.max(0, current - 1));
      setDeleting(null);
      pushToast('Трек удалён');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    api
      .adminCatalogSources()
      .then((data) => setSources(data.sources))
      .catch(() => undefined);
  }, []);

  const importCatalog = async () => {
    setImporting(true);
    try {
      const result = await api.adminImportCatalog(source);
      await load();
      pushToast(
        result.added > 0
          ? `${source}: добавлено ${result.added} треков (всего ${result.total})`
          : `${source}: новых треков нет (проверено ${result.fetched})`,
        'success',
      );
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const importR2 = async () => {
    setR2Importing(true);
    try {
      const result = await api.adminImportR2({
        prefix: r2Prefix.trim(),
        genre: r2Genre.trim() || undefined,
      });
      await load();
      setR2Open(false);
      pushToast(
        result.added > 0
          ? `R2: добавлено ${result.added} треков, пропущено ${result.skipped}`
          : `R2: новых треков нет (найдено ${result.total})`,
        result.added > 0 ? 'success' : 'info',
      );
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setR2Importing(false);
    }
  };

  return (
    <div className="admin-stack">
      <div className="admin-toolbar">
        <div className="search-field compact">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по трекам"
          />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Все' },
            { value: 'published', label: 'В каталоге' },
            { value: 'draft', label: 'Черновики' },
          ]}
        />
        <select
          className="input select-compact"
          value={source}
          onChange={(event) =>
            setSource(event.target.value as 'audius' | 'jamendo' | 'fma')
          }
          title={sources.find((item) => item.id === source)?.hint ?? 'Источник каталога'}
        >
          {(sources.length
            ? sources
            : ([
                { id: 'audius', label: 'Audius', configured: true, hint: '' },
                { id: 'jamendo', label: 'Jamendo', configured: true, hint: '' },
                { id: 'fma', label: 'Free Music Archive', configured: true, hint: '' },
              ] as const)
          ).map((item) => (
            <option key={item.id} value={item.id} disabled={!item.configured}>
              {item.label}
              {item.configured ? '' : ' — нет ключа'}
            </option>
          ))}
        </select>
        <button className="btn btn-ghost" onClick={() => void importCatalog()} disabled={importing}>
          {importing ? <Spinner size={16} /> : <RefreshCw size={16} />} Импорт
        </button>
        <button className="btn btn-ghost" onClick={() => setR2Open(true)} title="Импорт из Cloudflare R2">
          <CloudDownload size={16} /> R2
        </button>
        <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Добавить трек
        </button>
      </div>

      <section className="admin-card">
        <header>
          <h2>Треки</h2>
          <span>{total} всего</span>
        </header>

        {loading ? (
          <div className="admin-loading">
            <Spinner size={22} />
          </div>
        ) : tracks.length === 0 ? (
          <p className="muted admin-empty">Ничего не найдено.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Трек</th>
                  <th>Жанр</th>
                  <th>Длительность</th>
                  <th>Прослушивания</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.id}>
                    <td>
                      <div className="table-track">
                        <Cover src={track.coverUrl} color={track.color} name={track.title} size={40} rounded={9} />
                        <div>
                          <strong>{track.title}</strong>
                          <span>{track.artist}</span>
                        </div>
                      </div>
                    </td>
                    <td>{track.genre ?? '—'}</td>
                    <td>{formatTime(track.duration)}</td>
                    <td>{formatCount(track.plays)}</td>
                    <td>
                      <button
                        className={`status-toggle ${track.published ? 'on' : ''}`}
                        onClick={() => void togglePublished(track)}
                        disabled={busyId === track.id}
                      >
                        <span />
                        {track.published ? 'В каталоге' : 'Черновик'}
                      </button>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-btn subtle" aria-label="Редактировать" disabled>
                          <Pencil size={15} />
                        </button>
                        <button
                          className="icon-btn subtle danger"
                          aria-label="Удалить"
                          onClick={() => setDeleting(track)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новый трек" width={620}>
        <div className="form-grid two">
          <label className="field">
            <span>Название*</span>
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          <label className="field">
            <span>Исполнитель*</span>
            <input className="input" value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} />
          </label>
          <label className="field">
            <span>Альбом</span>
            <input className="input" value={form.album} onChange={(event) => setForm({ ...form, album: event.target.value })} />
          </label>
          <label className="field">
            <span>Жанр</span>
            <input className="input" value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })} />
          </label>
          <label className="field">
            <span>Длительность, сек</span>
            <input className="input" value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} />
          </label>
          <label className="field">
            <span>Обложка (URL)</span>
            <input className="input" value={form.coverUrl} onChange={(event) => setForm({ ...form, coverUrl: event.target.value })} />
          </label>
        </div>
        <label className="field">
          <span>Прямая ссылка на аудио*</span>
          <input
            className="input"
            value={form.audioUrl}
            onChange={(event) => setForm({ ...form, audioUrl: event.target.value })}
            placeholder="https://…/track.mp3"
          />
        </label>
        <label className="field">
          <span>Текст песни (LRC или обычный текст)</span>
          <textarea
            className="input textarea"
            rows={5}
            value={form.lyrics}
            onChange={(event) => setForm({ ...form, lyrics: event.target.value })}
            placeholder={'[00:12.40] Первая строка\n[00:18.20] Вторая строка'}
          />
        </label>
        <p className="hint">
          Ссылка должна вести на MP3/аудиофайл с правом на публикацию. Для загрузки файлов
          используй «Загрузить» в разделе «Моя музыка» — админские загрузки публикуются сразу.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={saving}>
            {saving ? <Spinner size={16} /> : <Plus size={16} />} Добавить
          </button>
        </div>
      </Modal>

      <Modal
        open={r2Open}
        onClose={() => setR2Open(false)}
        title="Импорт из Cloudflare R2"
        width={560}
      >
        <p className="hint">
          Сервер просканирует бакет и создаст треки из аудиофайлов. Название и исполнитель
          берутся из имени файла в формате «Исполнитель - Название.mp3». Уже добавленные
          ссылки пропускаются.
        </p>
        <label className="field">
          <span>Папка в бакете (prefix)</span>
          <input
            className="input"
            value={r2Prefix}
            onChange={(event) => setR2Prefix(event.target.value)}
            placeholder="music/"
          />
        </label>
        <p className="hint">
          Если файлы загружены в корень бакета — оставь поле пустым. Для папки `music`
          укажи `music/`.
        </p>
        <label className="field">
          <span>Жанр для новых треков</span>
          <input
            className="input"
            value={r2Genre}
            onChange={(event) => setR2Genre(event.target.value)}
            placeholder="Например, Electronic"
          />
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setR2Open(false)}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={() => void importR2()} disabled={r2Importing}>
            {r2Importing ? <Spinner size={16} /> : <CloudDownload size={16} />} Импортировать
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Удалить трек?">
        <p className="muted">
          «{deleting?.title}» удалится из каталога, плейлистов и истории. Действие необратимо.
        </p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleting(null)}>
            Отмена
          </button>
          <button className="btn btn-danger" onClick={() => void remove()}>
            <Trash2 size={16} /> Удалить
          </button>
        </div>
      </Modal>
    </div>
  );
}
