import { Search, Shield, ShieldOff, UserX, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useAuth } from '../../store/auth';
import { useUi } from '../../store/ui';
import type { AdminUser } from '../../types';
import { Avatar, Spinner } from '../../components/ui';

export function AdminUsers() {
  const me = useAuth((state) => state.user);
  const pushToast = useUi((state) => state.pushToast);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.adminUsers({ q: query || undefined, limit: 60 });
      setUsers(data.users);
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
  }, [query]);

  const patch = async (user: AdminUser, data: { role?: 'user' | 'admin'; banned?: boolean }) => {
    setBusyId(user.id);
    try {
      await api.adminPatchUser(user.id, data);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                role: data.role ?? item.role,
                banned: data.banned === undefined ? item.banned : data.banned,
              }
            : item,
        ),
      );
      pushToast('Пользователь обновлён', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setBusyId(null);
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
            placeholder="Имя или email"
          />
        </div>
        <span className="toolbar-note">{total} пользователей</span>
      </div>

      <section className="admin-card">
        <header>
          <h2>Пользователи</h2>
        </header>

        {loading ? (
          <div className="admin-loading">
            <Spinner size={22} />
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Пользователь</th>
                  <th>Роль</th>
                  <th>Telegram</th>
                  <th>Регистрация</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isMe = user.id === me?.id;
                  return (
                    <tr key={user.id} className={user.banned ? 'row-banned' : ''}>
                      <td>
                        <div className="table-track">
                          <Avatar name={user.displayName} size={36} />
                          <div>
                            <strong>
                              {user.displayName}
                              {isMe ? <em className="badge">это ты</em> : null}
                            </strong>
                            <span>{user.email ?? 'Telegram-аккаунт'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${user.role === 'admin' ? 'pill-admin' : ''}`}>
                          {user.role === 'admin' ? 'админ' : 'слушатель'}
                        </span>
                      </td>
                      <td>{user.telegramLinked ? 'связан' : '—'}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>{user.banned ? 'заблокирован' : 'активен'}</td>
                      <td>
                        <div className="table-actions">
                          {!isMe ? (
                            <>
                              <button
                                className="icon-btn subtle"
                                title={user.role === 'admin' ? 'Снять админа' : 'Сделать админом'}
                                aria-label="Изменить роль"
                                disabled={busyId === user.id}
                                onClick={() =>
                                  void patch(user, { role: user.role === 'admin' ? 'user' : 'admin' })
                                }
                              >
                                {user.role === 'admin' ? <ShieldOff size={15} /> : <Shield size={15} />}
                              </button>
                              <button
                                className="icon-btn subtle danger"
                                title={user.banned ? 'Разблокировать' : 'Заблокировать'}
                                aria-label="Блокировка"
                                disabled={busyId === user.id}
                                onClick={() => void patch(user, { banned: !user.banned })}
                              >
                                {user.banned ? <UserCheck size={15} /> : <UserX size={15} />}
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
