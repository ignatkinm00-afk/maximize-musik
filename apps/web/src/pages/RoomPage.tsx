import { ArrowLeft, Pause, Play, Radio, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { RoomInfo } from '../types';
import { Avatar, Cover, PageLoader } from '../components/ui';

export function RoomPage() {
  const { id = '' } = useParams();
  const user = useAuth((state) => state.user);
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const playTrack = usePlayer((state) => state.playTrack);
  const togglePlay = usePlayer((state) => state.togglePlay);
  const seek = usePlayer((state) => state.seek);
  const time = usePlayer((state) => state.time);
  const pushToast = useUi((state) => state.pushToast);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const lastSynced = useRef('');
  const live = useRef({ current, playing, time });
  live.current = { current, playing, time };

  const isHost = user?.id === room?.hostId;

  useEffect(() => {
    if (!user) return;
    void api.joinRoom(id).catch(() => undefined);
  }, [id, user]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api.room(id);
        if (!active) return;
        setRoom(data.room);
        setLoading(false);

        const shared = data.room.track;
        if (!shared) return;

        const signature = `${shared.id}:${data.room.playing}`;
        if (live.current.current?.id !== shared.id) {
          playTrack(shared);
        }
        if (data.room.playing && lastSynced.current !== signature) {
          const drift = Math.abs(live.current.time - data.room.position);
          if (drift > 4) seek(data.room.position);
          lastSynced.current = signature;
        }
      } catch {
        setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, playTrack, seek]);

  useEffect(() => {
    if (!isHost) return;
    const timer = window.setInterval(() => {
      void api
        .updateRoom(id, {
          trackId: live.current.current?.id ?? null,
          playing: live.current.playing,
          position: Math.round(live.current.time),
        })
        .catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [id, isHost]);

  const broadcast = async () => {
    if (!current) {
      pushToast('Сначала включи трек в плеере', 'error');
      return;
    }
    try {
      await api.updateRoom(id, { trackId: current.id, playing, position: Math.round(time) });
      pushToast('Трек отправлен в комнату', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  if (loading) return <PageLoader />;
  if (!room) return <p className="hint">Комната не найдена.</p>;

  return (
    <div className="page room-page">
      <Link to="/rooms" className="back-link">
        <ArrowLeft size={16} /> Все комнаты
      </Link>

      <header className="room-hero">
        <span className="room-live-dot" />
        <div>
          <h1>{room.name}</h1>
          <p>
            Хост: {room.memberList?.find((member) => member.id === room.hostId)?.displayName ?? '—'} ·{' '}
            {room.members} <Users size={13} />
          </p>
        </div>
        <span className={`room-status ${room.playing ? 'live' : ''}`}>
          {room.playing ? 'в эфире' : 'пауза'}
        </span>
      </header>

      <div className="room-stage">
        {room.track ? (
          <>
            <Cover
              src={room.track.coverUrl}
              color={room.track.color}
              name={room.track.title}
              size={220}
              rounded={24}
            />
            <h2>{room.track.title}</h2>
            <p>{room.track.artist}</p>
          </>
        ) : (
          <div className="empty-state">
            <Radio size={34} />
            <h3>Пока тишина</h3>
            <p>Хост ещё не выбрал трек.</p>
          </div>
        )}
        <div className="room-controls">
          {isHost ? (
            <>
              <button className="btn btn-primary" onClick={() => void broadcast()}>
                <Radio size={16} /> Транслировать мой трек
              </button>
              <button className="btn btn-ghost" onClick={togglePlay}>
                {playing ? <Pause size={16} /> : <Play size={16} />}
                {playing ? 'Пауза' : 'Играть'}
              </button>
            </>
          ) : (
            <span className="hint">Управляет хост — музыка синхронизируется автоматически.</span>
          )}
        </div>
      </div>

      <section className="room-members">
        <h2>В комнате</h2>
        <div className="room-members-list">
          {(room.memberList ?? []).map((member) => (
            <div key={member.id} className="room-member">
              <Avatar name={member.displayName} color={member.avatarColor} size={38} />
              <span>{member.displayName}</span>
              {member.id === room.hostId ? <em>хост</em> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
