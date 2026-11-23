import { motion } from 'framer-motion';
import { Bell, BellRing, CheckCheck, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { useNotifications } from '../store/notifications';
import { useUi } from '../store/ui';
import type { AppNotification } from '../types';
import { EmptyState, Spinner } from '../components/ui';

export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const pushToast = useUi((state) => state.pushToast);
  const refresh = useNotifications((state) => state.refresh);
  const setUnread = useNotifications((state) => state.setUnread);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.notifications();
      setItems(data.notifications);
      setUnread(data.notifications.filter((item) => !item.readAt).length);
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNotification = async (item: AppNotification) => {
    if (!item.readAt) {
      try {
        await api.readNotification(item.id);
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
          ),
        );
        void refresh();
      } catch {
        // не критично
      }
    }
  };

  const readAll = async () => {
    try {
      await api.readAllNotifications();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      setUnread(0);
      pushToast('Все уведомления прочитаны', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  return (
    <motion.div className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-head">
        <div>
          <h1>Уведомления</h1>
          <p>Новости сервиса, новые релизы и сообщения от администрации</p>
        </div>
        <button className="btn btn-ghost" onClick={() => void readAll()} disabled={items.every((item) => item.readAt)}>
          <CheckCheck size={16} /> Прочитать все
        </button>
      </div>

      {loading ? (
        <div className="page-loader">
          <Spinner size={22} />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Пока тихо"
          description="Здесь появятся важные новости и сообщения от команды Maximize."
        />
      ) : (
        <div className="notification-list">
          {items.map((item) => (
            <article key={item.id} className={`notification ${item.readAt ? '' : 'unread'}`}>
              <div className="notification-icon">
                {item.readAt ? <Bell size={18} /> : <BellRing size={18} />}
              </div>
              <div className="notification-body">
                <div className="notification-title-row">
                  <h3>{item.title}</h3>
                  <time>{relativeTime(item.createdAt)}</time>
                </div>
                <p>{item.body}</p>
                <div className="notification-meta">
                  {item.channels.includes('telegram') ? (
                    <span className="pill">
                      <Send size={11} /> Telegram
                    </span>
                  ) : null}
                  {item.link ? (
                    <Link
                      to={item.link}
                      className="link-more"
                      onClick={() => void openNotification(item)}
                    >
                      Открыть
                    </Link>
                  ) : (
                    <button className="link-more" onClick={() => void openNotification(item)}>
                      {item.readAt ? 'Прочитано' : 'Отметить прочитанным'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </motion.div>
  );
}
