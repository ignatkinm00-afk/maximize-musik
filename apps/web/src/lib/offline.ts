import { streamUrl } from './api';
import type { Track } from '../types';

const DB_NAME = 'maximize-offline';
const STORE = 'tracks';
const VERSION = 1;

export interface OfflineTrack {
  id: string;
  track: Track;
  blob: Blob;
  addedAt: number;
  size: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Офлайн-хранилище недоступно'));
      return;
    }
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть базу'));
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = action(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('Ошибка хранилища'));
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function listOffline(): Promise<OfflineTrack[]> {
  try {
    const rows = await tx<OfflineTrack[]>('readonly', (store) => store.getAll());
    return rows.sort((a, b) => b.addedAt - a.addedAt);
  } catch {
    return [];
  }
}

export async function downloadTrack(track: Track): Promise<OfflineTrack> {
  const response = await fetch(streamUrl(track), { credentials: 'omit' });
  if (!response.ok) throw new Error(`Не удалось скачать трек (${response.status})`);
  const blob = await response.blob();
  if (blob.size < 1024) throw new Error('Сервер вернул пустой файл');
  const entry: OfflineTrack = {
    id: track.id,
    track,
    blob,
    addedAt: Date.now(),
    size: blob.size,
  };
  await tx('readwrite', (store) => store.put(entry));
  return entry;
}

export async function getOffline(id: string): Promise<OfflineTrack | undefined> {
  try {
    return await tx<OfflineTrack | undefined>('readonly', (store) => store.get(id));
  } catch {
    return undefined;
  }
}

export async function removeOffline(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id));
}

export const offlineUrls = new Map<string, string>();

export async function offlineObjectUrl(id: string): Promise<string | null> {
  const cached = offlineUrls.get(id);
  if (cached) return cached;
  const entry = await getOffline(id);
  if (!entry) return null;
  const url = URL.createObjectURL(entry.blob);
  offlineUrls.set(id, url);
  return url;
}

export function revokeOfflineUrl(id: string): void {
  const url = offlineUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  offlineUrls.delete(id);
}

export async function clearOffline(): Promise<void> {
  try {
    const rows = await listOffline();
    for (const row of rows) revokeOfflineUrl(row.id);
    await tx('readwrite', (store) => store.clear());
  } catch {
    // ignore
  }
}
