import { Download, Play, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listOffline, removeOffline, revokeOfflineUrl, type OfflineTrack } from '../lib/offline';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import { Cover } from '../components/ui';

const formatSize = (bytes: number) => {
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
};

export function DownloadsPage() {
  const [rows, setRows] = useState<OfflineTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const playTrack = usePlayer((state) => state.playTrack);
  const refreshOffline = usePlayer((state) => state.refreshOffline);
  const pushToast = useUi((state) => state.pushToast);

  const load = async () => {
    setLoading(true);
    setRows(await listOffline());
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (row: OfflineTrack) => {
    await removeOffline(row.id);
    revokeOfflineUrl(row.id);
    setRows((current) => current.filter((item) => item.id !== row.id));
    await refreshOffline();
    pushToast('Трек удалён из офлайна');
  };

  const total = rows.reduce((sum, row) => sum + row.size, 0);

  return (
    <div className="page downloads-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Download size={14} /> без интернета
          </p>
          <h1>Скачано</h1>
          <p className="page-subtitle">
            {rows.length
              ? `${rows.length} треков · ${formatSize(total)}`
              : 'Сохраняй треки кнопкой скачивания в плеере — они будут играть без сети.'}
          </p>
        </div>
      </header>

      {loading ? (
        <p className="hint">Загружаю…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <Download size={34} />
          <h3>Пока ничего не скачано</h3>
          <p>Открой любой трек, нажми иконку загрузки в полноэкранном плеере.</p>
          <Link className="btn btn-primary" to="/">
            <Play size={16} /> К музыке
          </Link>
        </div>
      ) : (
        <div className="downloads-list">
          {rows.map((row) => (
            <div key={row.id} className="download-row">
              <Cover
                src={row.track.coverUrl}
                color={row.track.color}
                name={row.track.title}
                size={46}
                rounded={12}
              />
              <div className="download-meta">
                <strong>{row.track.title}</strong>
                <span>
                  {row.track.artist} · {formatSize(row.size)}
                </span>
              </div>
              <button
                className="icon-btn"
                onClick={() => playTrack(row.track, rows.map((item) => item.track))}
                aria-label="Играть"
              >
                <Play size={18} />
              </button>
              <button
                className="icon-btn"
                onClick={() => void remove(row)}
                aria-label="Удалить"
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
