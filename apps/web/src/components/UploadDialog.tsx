import { FolderOpen, Music4, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiBase, getToken } from '../lib/api';
import { formatTime } from '../lib/format';
import { useUi } from '../store/ui';
import type { Track } from '../types';
import { Modal, Spinner } from './ui';

type Status = 'wait' | 'uploading' | 'done' | 'error';

interface PendingFile {
  id: string;
  file: File;
  title: string;
  duration: number;
  status: Status;
  progress: number;
  error?: string;
}

const AUDIO_RE = /\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)$/i;

const readDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.src = url;
    audio.onloadedmetadata = () => {
      const value = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });

const uploadOne = (
  formData: FormData,
  onProgress: (percent: number) => void,
): Promise<Track> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase()}/api/tracks/upload`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText) as { track?: Track; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && payload.track) resolve(payload.track);
        else reject(new Error(payload.error ?? `Ошибка ${xhr.status}`));
      } catch {
        reject(new Error('Сервер вернул неожиданный ответ'));
      }
    };
    xhr.onerror = () => reject(new Error('Не удалось связаться с сервером'));
    xhr.send(formData);
  });

export function UploadDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (track: Track) => void;
}) {
  const pushToast = useUi((state) => state.pushToast);
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setCover(null);
      setArtist('');
      setAlbum('');
      setGenre('');
      setBusy(false);
      setProgress(0);
    }
  }, [open]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const selected = Array.from(list).filter(
      (file) => file.type.startsWith('audio/') || AUDIO_RE.test(file.name),
    );
    if (!selected.length) {
      pushToast('Не найдено аудиофайлов', 'error');
      return;
    }
    const items: PendingFile[] = selected.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      title: file.name.replace(/\.[^.]+$/, ''),
      duration: 0,
      status: 'wait',
      progress: 0,
    }));
    setFiles((current) => [...current, ...items]);
    for (const item of items) {
      void readDuration(item.file).then((duration) => {
        setFiles((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, duration } : entry)),
        );
      });
    }
  };

  const removeFile = (id: string) => {
    if (busy) return;
    setFiles((current) => current.filter((entry) => entry.id !== id));
  };

  const pending = files.filter((entry) => entry.status === 'wait' || entry.status === 'error');

  const submit = async () => {
    if (!pending.length || busy) return;
    setBusy(true);
    setProgress(0);
    let uploaded = 0;
    let failed = 0;

    for (const [index, entry] of pending.entries()) {
      setFiles((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, status: 'uploading', progress: 0, error: undefined } : item,
        ),
      );

      const formData = new FormData();
      formData.append('audio', entry.file);
      if (cover) formData.append('cover', cover);
      formData.append('title', entry.title.trim() || entry.file.name);
      formData.append('artist', artist.trim());
      formData.append('album', album.trim());
      formData.append('genre', genre.trim());
      formData.append('duration', String(entry.duration));

      try {
        const track = await uploadOne(formData, (percent) => {
          setFiles((current) =>
            current.map((item) => (item.id === entry.id ? { ...item, progress: percent } : item)),
          );
          setProgress(Math.round(((index + percent / 100) / pending.length) * 100));
        });
        uploaded += 1;
        onUploaded(track);
        setFiles((current) =>
          current.map((item) =>
            item.id === entry.id ? { ...item, status: 'done', progress: 100 } : item,
          ),
        );
      } catch (error) {
        failed += 1;
        setFiles((current) =>
          current.map((item) =>
            item.id === entry.id
              ? { ...item, status: 'error', error: (error as Error).message }
              : item,
          ),
        );
      }
    }

    setBusy(false);
    setProgress(100);
    if (uploaded > 0) {
      pushToast(
        failed > 0
          ? `Загружено ${uploaded}, ошибок ${failed}`
          : `Загружено треков: ${uploaded}`,
        failed > 0 ? 'info' : 'success',
      );
    }
    if (failed === 0) onClose();
  };

  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title="Добавить свою музыку" width={640}>
      <div
        className="upload-zone"
        onClick={() => fileInput.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <input
          ref={folderInput}
          type="file"
          multiple
          hidden
          // @ts-expect-error нестандартные атрибуты Chromium для выбора папки
          webkitdirectory="true"
          directory="true"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = '';
          }}
        />
        <UploadCloud size={28} />
        <strong>Перетащи файлы сюда или нажми</strong>
        <span>MP3, M4A, FLAC, WAV, OGG — можно сразу много, до 45 МБ каждый</span>
        <div className="upload-actions" onClick={(event) => event.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={() => fileInput.current?.click()}>
            Выбрать файлы
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => folderInput.current?.click()}>
            <FolderOpen size={15} /> Выбрать папку
          </button>
        </div>
      </div>

      {files.length > 0 ? (
        <div className="upload-list">
          <div className="upload-list-head">
            <span>Файлы: {files.length}</span>
            <button
              className="link-more"
              disabled={busy}
              onClick={() => setFiles((current) => current.filter((item) => item.status === 'done'))}
            >
              Очистить
            </button>
          </div>
          {files.map((entry) => (
            <div key={entry.id} className={`upload-item status-${entry.status}`}>
              <Music4 size={16} />
              <div className="upload-item-main">
                <strong title={entry.file.name}>{entry.title}</strong>
                <span>
                  {entry.duration ? formatTime(entry.duration) : '…'} ·{' '}
                  {(entry.file.size / 1024 / 1024).toFixed(1)} МБ
                </span>
                {entry.status === 'uploading' ? (
                  <div className="progress upload-item-progress">
                    <span style={{ width: `${entry.progress}%` }} />
                  </div>
                ) : null}
                {entry.error ? <em>{entry.error}</em> : null}
              </div>
              {entry.status === 'uploading' ? <Spinner size={16} /> : null}
              {entry.status === 'done' ? <span className="upload-ok">✓</span> : null}
              {entry.status === 'wait' || entry.status === 'error' ? (
                <button
                  className="icon-btn subtle"
                  onClick={() => removeFile(entry.id)}
                  disabled={busy}
                  aria-label="Убрать файл"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="form-grid two">
        <label className="field">
          <span>Исполнитель для всех</span>
          <input
            className="input"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            placeholder="Необязательно"
          />
        </label>
        <label className="field">
          <span>Жанр для всех</span>
          <input
            className="input"
            value={genre}
            onChange={(event) => setGenre(event.target.value)}
            placeholder="Например, Rock"
          />
        </label>
      </div>

      <label className="field">
        <span>Альбом для всех</span>
        <input
          className="input"
          value={album}
          onChange={(event) => setAlbum(event.target.value)}
          placeholder="Необязательно"
        />
      </label>

      <label className="upload-cover">
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => setCover(event.target.files?.[0] ?? null)}
        />
        <span>{cover ? `Обложка: ${cover.name}` : 'Обложка для всех треков (необязательно)'}</span>
      </label>

      {busy ? (
        <div className="upload-progress">
          <div className="progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <em>{progress}%</em>
        </div>
      ) : null}

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Закрыть
        </button>
        <button className="btn btn-primary" onClick={() => void submit()} disabled={!pending.length || busy}>
          {busy ? <Spinner size={16} /> : <UploadCloud size={16} />}
          Загрузить {pending.length > 0 ? pending.length : ''}
        </button>
      </div>
      <p className="hint">
        Загружать можно только свою музыку или файлы со свободной лицензией. Треки попадают в
        «Мои загрузки», а после проверки администратором — в общий каталог.
      </p>
    </Modal>
  );
}
