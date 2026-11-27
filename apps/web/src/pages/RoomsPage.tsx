import { Radio, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useUi } from '../store/ui';
import type { RoomInfo } from '../types';
import { Modal, PageLoader } from '../components/ui';

export function RoomsPage() {
  const user = useAuth((state) => state.user);
  const pushToast = useUi((state) => state.pushToast);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Наша волна');
  const [creating, setCreating] = useState(false);

  const load = () => {
    api
      .rooms()
      .then((data) => setRooms(data.rooms))
      .catch((error) => pushToast((error as Error).message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const { room } = await api.createRoom({ name: name.trim() });
      await api.joinRoom(room.id);
      window.location.hash = `#/room/${room.id}`;
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Radio size={14} /> вместе
          </p>
          <h1>Комнаты</h1>
          <p className="page-subtitle">Слушайте один трек одновременно с друзьями.</p>
        </div>
        {user ? (
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Radio size={16} /> Создать комнату
          </button>
        ) : (
          <Link className="btn btn-primary" to="/login">
            Войти
          </Link>
        )}
      </header>

      {rooms.length === 0 ? (
        <div className="empty-state">
          <Radio size={34} />
          <h3>Комнат пока нет</h3>
          <p>Создай первую и позови друзей — трек будет играть у всех.</p>
        </div>
      ) : (
        <div className="rooms-grid">
          {rooms.map((room) => (
            <Link key={room.id} to={`/room/${room.id}`} className="room-card">
              <span className="room-icon">
                <Radio size={22} />
              </span>
              <div className="room-meta">
                <strong>{room.name}</strong>
                <span>
                  {room.hostName} · {room.members} <Users size={12} />
                </span>
              </div>
              <span className={`room-status ${room.playing ? 'live' : ''}`}>
                {room.playing ? 'в эфире' : 'пауза'}
              </span>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Новая комната" width={440}>
        <label className="field">
          <span>Название</span>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={() => void create()} disabled={creating}>
            {creating ? 'Создаю…' : 'Создать'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
