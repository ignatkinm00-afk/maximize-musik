interface TelegramWebApp {
  initData: string;
  initDataUnsafe?: { user?: { id: number; first_name?: string; username?: string } };
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  enableClosingConfirmation?: () => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const telegram = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export const isTelegram = Boolean(telegram?.initData);

export function initTelegram(): void {
  if (!telegram) return;
  try {
    telegram.ready();
    telegram.expand();
    telegram.setHeaderColor?.('#06060a');
    telegram.setBackgroundColor?.('#06060a');
    telegram.enableClosingConfirmation?.();
    document.documentElement.classList.add('in-telegram');
  } catch {
    // Внутри Mini App доступны не все методы — молча игнорируем.
  }
}

export function haptic(type: 'tap' | 'success' | 'error' = 'tap'): void {
  try {
    if (type === 'tap') telegram?.HapticFeedback?.impactOccurred('light');
    else if (type === 'success') telegram?.HapticFeedback?.notificationOccurred('success');
    else telegram?.HapticFeedback?.notificationOccurred('error');
  } catch {
    // нет доступа — не критично
  }
}

export function useTelegramBackButton(visible: boolean, handler: () => void): void {
  if (typeof window === 'undefined') return;
  const api = telegram?.BackButton;
  if (!api) return;
  if (visible) {
    api.show();
    api.onClick(handler);
  } else {
    api.hide();
    api.offClick(handler);
  }
}
