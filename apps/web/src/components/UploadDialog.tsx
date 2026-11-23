import { Music4, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiBase, getToken } from '../lib/api';
import { useUi } from '../store/ui';
import type { Track } from '../types';
import { Modal } from './ui';

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
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setCover(null);
      setTitle('');
      setArtist('');
      setAlbum('');
      setGenre('');
      setDuration(0);
      setProgress(0);
      setBusy(false);
    }
  }, [open]);

  const pickFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith('audio/')) {
      pushToast('Это не аудиофайл', 'error');
      return;
    }
    setFile(selected);
    if (!title) setTitle(selected.name.replace(/\.[^.]+$/, ''));

    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    audio.src = URL.createObjectURL(selected);
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(Math.round(audio.duration));
    };
  };

  const submit = () => {
    if (!file || busy) return;
    const formData = new FormData();
    formData.append('audio', file);
    if (cover) formData.append('cover', cover);
    formData.append('title', title.trim() || file.name.replace(/\.[^.]+$/, ''));
    formData.append('artist', artist.trim());
    formData.append('album', album.trim());
    formData.append('genre', genre.trim());
    formData.append('duration', String(duration));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiBase()}/api/tracks/upload`);
    const token = getToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false);
      try {
        const payload = JSON.parse(xhr.responseText) as { track?: Track; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && payload.track) {
          pushToast('Трек загружен. Он появится в каталоге после публикации.', 'success');
          onUploaded(payload.track);
          onClose();
        } else {
          pushToast(payload.error ?? 'Не удалось загрузить трек', 'error');
        }
      } catch {
        pushToast('Сервер вернул неожиданный ответ', 'error');
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      pushToast('Не удалось связаться с сервером', 'error');
    };
    setBusy(true);
    setProgress(0);
    xhr.send(formData);
  };

  return (
    <Modal open={open} onClose={onClose} title="Загрузить свой трек" width={560}>
      <div className="upload-zone" onClick={() => document.getElementById('upload-audio')?.click()}>
        <input
          id="upload-audio"
          ref={inputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <Music4 size={26} />
            <strong>{file.name}</strong>
            <span>
              {(file.size / 1024 / 1024).toFixed(1)} МБ · {duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}` : '…'}
            </span>
          </>
        ) : (
          <>
            <UploadCloud size={28} />
            <strong>Выбери аудиофайл</strong>
            <span>MP3, M4A, FLAC, WAV, OGG — до 45 МБ</span>
          </>
        )}
      </div>

      <div className="form-grid">
        <label className="field">
          <span>Название</span>
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Название трека" />
        </label>
        <label className="field">
          <span>Исполнитель</span>
          <input className="input" value={artist} onChange={(event) => setArtist(event.target.value)} placeholder="Кто исполняет" />
        </label>
        <label className="field">
          <span>Альбом</span>
          <input className="input" value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Необязательно" />
        </label>
        <label className="field">
          <span>Жанр</span>
          <input className="input" value={genre} onChange={(event) => setGenre(event.target.value)} placeholder="Например, Electronic" />
        </label>
      </div>

      <label className="upload-cover">
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => setCover(event.target.files?.[0] ?? null)}
        />
        <span>{cover ? `Обложка: ${cover.name}` : 'Добавить обложку (необязательно)'}</span>
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
          Отмена
        </button>
        <button className="btn btn-primary" onClick={submit} disabled={!file || busy}>
          {busy ? 'Загружаем…' : 'Загрузить'}
        </button>
      </div>
      <p className="hint">
        Загружать можно только свою музыку или файлы со свободной лицензией. Трек проверит
        администратор перед публикацией.
      </p>
    </Modal>
  );
}
