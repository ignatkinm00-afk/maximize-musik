import { BellRing, Megaphone, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { formatTime, relativeTime } from '../../lib/format';import { useUi } from '../../store/ui';
import type { AppNotification, SubscribersInfo } from '../../types';
import { Spinner } from '../../components/ui';

type Audience = 'all' | 'users' | 'admins';

export function AdminBroadcast() {
  const pushToast = useUi((state) => state.pushToast);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [telegram, setTelegram] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AppNotification[]>([]);
  const [subscribers, setSubscribers] = useState<SubscribersInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      const data = await api.adminNotifications(20, 0);
      setHistory(data.notifications);
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    Promise.all([loadHistory(), api.adminSubscribers().then(setSubscribers)])
      .catch((error: Error) => pushToast(error.message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      pushToast('Заполни заголовок и текст', 'error');
      return;
    }
    setSending(true);
    try {
      const channels: Array<'inapp' | 'telegram'> = ['inapp'];
      if (telegram) channels.push('telegram');
      const data = await api.adminBroadcast({
        title: title.trim(),
        body: body.trim(),
        link: link.trim() || null,
        audience,
        channels,
      });
      pushToast(
        data.telegramQueued
          ? 'Уведомление отправлено в приложение, Telegram-рассылка пошла'
          : 'Уведомление отправлено в приложение',
        'success',
      );
      setTitle('');
      setBody('');
      setLink('');
      await loadHistory();
      window.setTimeout(() => void loadHistory(), 2500);
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = (value: string) =>
    value === 'admins' ? 'Админам' : value === 'users' ? 'Слушателям' : 'Всем';

  return (
    <div className="admin-stack">
      <div className="admin-columns broadcast-columns">
        <section className="admin-card">
          <header>
            <h2>
              <Megaphone size={17} /> Новая рассылка
            </h2>
            <span>Push внутри приложения и в Telegram</span>
          </header>

          <div className="form-grid">
            <label className="field">
              <span>Заголовок</span>
              <input
                className="input"
                value={title}
                maxLength={120}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например: Новый альбом уже в каталоге"
              />
            </label>
            <label className="field">
              <span>Текст</span>
              <textarea
                className="input"
                rows={4}
                value={body}
                maxLength={2000}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Коротко и по делу — что случилось и что сделать"
              />
            </label>
            <label className="field">
              <span>Ссылка (необязательно)</span>
              <input
                className="input"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                placeholder="/search или https://…"
              />
            </label>

            <div className="field">
              <span>Кому</span>
              <div className="segmented">
                {(['all', 'users', 'admins'] as Audience[]).map((value) => (
                  <button
                    key={value}
                    className={audience === value ? 'active' : ''}
                    onClick={() => setAudience(value)}
                  >
                    {audienceLabel(value)}
                  </button>
                ))}
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={telegram}
                onChange={(event) => setTelegram(event.target.checked)}
              />
              <span>
                <strong>Продублировать в Telegram</strong>
                <em>
                  {subscribers?.bot.live
                    ? `Подписчиков: ${subscribers.total}`
                    : 'Бот не запущен — уйдёт только в приложение'}
                </em>
              </span>
            </label>
          </div>

          <div className="modal-actions">
            <button className="btn btn-primary btn-lg" onClick={() => void send()} disabled={sending}>
              {sending ? <Spinner size={16} /> : <Send size={16} />} Отправить
            </button>
          </div>
        </section>

        <aside className="admin-card preview-card">
          <header>
            <h2>Предпросмотр</h2>
          </header>
          <div className="phone-preview">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="preview-app-head">
                <span className="brand-mark small">M</span>
                <strong>Maximize Musik</strong>
              </div>
              <div className="preview-notification">
                <div className="preview-icon">
                  <BellRing size={15} />
                </div>
                <div>
                  <strong>{title || 'Заголовок уведомления'}</strong>
                  <p>{body || 'Текст появится здесь — как его увидят слушатели.'}</p>
                  <em>{link || 'сейчас'}</em>
                </div>
              </div>
              <div className="preview-telegram">
                <span>
                  <Send size={12} /> Telegram
                </span>
                <p>
                  {telegram
                    ? `${title || 'Заголовок'}\n${body || 'Текст сообщения'}`
                    : 'Telegram-канал выключен'}
                </p>
              </div>
            </div>
          </div>

          <div className="subscriber-stats">
            <div>
              <Users size={16} />
              <strong>{subscribers?.total ?? 0}</strong>
              <span>в боте</span>
            </div>
            <div>
              <strong>{subscribers?.muted ?? 0}</strong>
              <span>отключили</span>
            </div>
            <div>
              <strong>{subscribers?.bot.live ? 'live' : 'выкл'}</strong>
              <span>статус</span>
            </div>
          </div>
        </aside>
      </div>

      <section className="admin-card">
        <header>
          <h2>История рассылок</h2>
          <span>{history.length} последних</span>
        </header>
        {loading ? (
          <div className="admin-loading">
            <Spinner size={20} />
          </div>
        ) : history.length === 0 ? (
          <p className="muted admin-empty">Пока не было рассылок.</p>
        ) : (
          <div className="admin-list">
            {history.map((item) => (
              <div key={item.id} className="history-row">
                <div className="history-main">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </div>
                <div className="history-meta">
                  <span className="pill">{audienceLabel(item.audience)}</span>
                  {item.channels.includes('telegram') ? (
                    <span className="pill">
                      <Send size={11} /> {item.sent} / {item.failed}
                    </span>
                  ) : null}
                  <time>{relativeTime(item.createdAt)}</time>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="hint">
        Доставка в Telegram идёт в фоне: счётчики «отправлено / ошибок» обновятся через несколько
        секунд. Пользователи могут отключить рассылку командой /mute.
      </p>
    </div>
  );
}
