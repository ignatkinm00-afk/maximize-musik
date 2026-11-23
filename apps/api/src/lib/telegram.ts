import { Bot, InlineKeyboard } from 'grammy';
import type { Update } from 'grammy/types';
import { config } from '../config.ts';
import type { Database } from '../db/index.ts';
import { nowIso } from '../db/index.ts';

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface BroadcastResult {
  sent: number;
  failed: number;
}

class TelegramService {
  #db: Database | null = null;
  #bot: Bot | null = null;
  started = false;
  username: string | null = null;

  get configured(): boolean {
    return Boolean(config.telegram.token);
  }

  get live(): boolean {
    return this.started && this.#bot !== null;
  }

  async init(db: Database): Promise<void> {
    this.#db = db;
    if (!this.configured) {
      console.log('[telegram] TELEGRAM_BOT_TOKEN не задан — бот выключен');
      return;
    }

    const bot = new Bot(config.telegram.token);
    this.#bot = bot;

    try {
      const me = await bot.api.getMe();
      this.username = me.username ?? null;
    } catch (error) {
      console.error('[telegram] getMe:', (error as Error).message);
    }

    bot.command('start', async (ctx) => {
      await this.#remember(ctx.from);
      const name = ctx.from?.first_name ?? 'друг';
      await ctx.reply(
        `Привет, ${escapeHtml(name)}! 👋\n\n` +
          `<b>Maximize Musik</b> — твоя музыка без подписки.\n` +
          `Мини-приложение открывается прямо здесь, в Telegram.\n\n` +
          `Команды:\n/app — открыть плеер\n/mute — выключить рассылку\n/unmute — включить рассылку\n/help — помощь`,
        { parse_mode: 'HTML', reply_markup: this.#appKeyboard() },
      );
    });

    bot.command('app', async (ctx) => {
      await this.#remember(ctx.from);
      await ctx.reply('Открывай плеер 👇', { reply_markup: this.#appKeyboard() });
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(
        `🎧 <b>Maximize Musik</b>\n\n/app — мини-приложение с плеером\n/mute — не присылать уведомления\n/unmute — снова присылать\n\nВеб-версия: ${config.webUrl}`,
        { parse_mode: 'HTML', link_preview_options: { is_disabled: true } },
      );
    });

    bot.command('mute', async (ctx) => {
      await this.#setNotifications(ctx.from?.id, 0);
      await ctx.reply('Ок, больше не присылаю уведомления. Вернуть: /unmute');
    });

    bot.command('unmute', async (ctx) => {
      await this.#setNotifications(ctx.from?.id, 1);
      await ctx.reply('Готово, уведомления снова включены 🔔');
    });

    bot.catch((error) => {
      console.error('[telegram] update error:', error.message);
    });

    try {
      if (config.telegram.webhookUrl) {
        await bot.api.setWebhook(`${config.telegram.webhookUrl}/api/telegram/webhook`, {
          secret_token: config.telegram.webhookSecret,
          drop_pending_updates: true,
          allowed_updates: ['message', 'callback_query'],
        });
        console.log(`[telegram] webhook: ${config.telegram.webhookUrl}/api/telegram/webhook`);
      } else {
        void bot.start({
          drop_pending_updates: true,
          onStart: (info) => console.log(`[telegram] polling as @${info.username}`),
        });
      }
      this.started = true;
    } catch (error) {
      console.error('[telegram] не удалось запустить:', (error as Error).message);
    }
  }

  #appKeyboard(): InlineKeyboard {
    const keyboard = new InlineKeyboard();
    try {
      keyboard.webApp('🎧 Открыть Maximize Musik', `${config.webUrl}/`);
    } catch {
      keyboard.url('🎧 Открыть Maximize Musik', config.webUrl);
    }
    return keyboard;
  }

  async #remember(from?: {
    id?: number;
    username?: string;
    first_name?: string;
  }): Promise<void> {
    if (!this.#db || !from?.id) return;
    await this.#db.run(
      `INSERT INTO telegram_subscribers (telegram_id, username, first_name, notifications, created_at)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT (telegram_id) DO UPDATE SET username = excluded.username, first_name = excluded.first_name`,
      [String(from.id), from.username ?? null, from.first_name ?? null, nowIso()],
    );
  }

  async #setNotifications(telegramId: number | undefined, value: number): Promise<void> {
    if (!this.#db || !telegramId) return;
    await this.#db.run(
      `INSERT INTO telegram_subscribers (telegram_id, username, first_name, notifications, created_at)
       VALUES (?, NULL, NULL, ?, ?)
       ON CONFLICT (telegram_id) DO UPDATE SET notifications = excluded.notifications`,
      [String(telegramId), value, nowIso()],
    );
  }

  async handleUpdate(update: Update): Promise<void> {
    if (!this.#bot) return;
    await this.#bot.handleUpdate(update);
  }

  async broadcast(notification: {
    id: string;
    title: string;
    body: string;
    link: string | null;
  }): Promise<BroadcastResult> {
    if (!this.live || !this.#db) return { sent: 0, failed: 0 };
    const bot = this.#bot;
    if (!bot) return { sent: 0, failed: 0 };
    const subscribers = await this.#db.all<{ telegram_id: string }>(
      'SELECT telegram_id FROM telegram_subscribers WHERE notifications = 1',
    );

    const link = notification.link
      ? notification.link.startsWith('http')
        ? notification.link
        : `${config.webUrl}/#${notification.link.startsWith('/') ? '' : '/'}${notification.link}`
      : `${config.webUrl}/`;

    const text =
      `🔔 <b>${escapeHtml(notification.title)}</b>\n\n` +
      `${escapeHtml(notification.body)}\n\n` +
      `<a href="${link}">Открыть в Maximize Musik</a>`;

    let sent = 0;
    let failed = 0;
    for (const subscriber of subscribers) {
      try {
        await bot.api.sendMessage(Number(subscriber.telegram_id), text, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: this.#appKeyboard(),
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = (error as Error).message;
        if (/blocked|deactivated|not found/i.test(message)) {
          await this.#db.run('DELETE FROM telegram_subscribers WHERE telegram_id = ?', [
            subscriber.telegram_id,
          ]);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 45));
    }

    await this.#db.run(
      'UPDATE notifications SET telegram_sent = ?, telegram_failed = ? WHERE id = ?',
      [sent, failed, notification.id],
    );
    console.log(`[telegram] рассылка «${notification.title}»: ${sent} отправлено, ${failed} ошибок`);
    return { sent, failed };
  }
}

export const telegram = new TelegramService();
