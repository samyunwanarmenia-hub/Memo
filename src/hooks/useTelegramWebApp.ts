import { useEffect, useState } from 'react';

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_bot?: boolean;
      is_premium?: boolean;
      added_to_attachment_menu?: boolean;
    };
    receiver?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
      is_bot?: boolean;
      is_premium?: boolean;
      added_to_attachment_menu?: boolean;
    };
    chat?: {
      id: number;
      type: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
      title?: string;
      username?: string;
      photo_url?: string;
    };
    start_param?: string;
    auth_date: number;
    hash: string;
  };
  version: string;
  platform: string;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;
  themeParams: {
    bg_color: string;
    text_color: string;
    hint_color: string;
    link_color: string;
    button_color: string;
    button_text_color: string;
    secondary_bg_color: string;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'success' | 'warning' | 'error') => void;
    selectionChanged: () => void;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  onEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  offEvent: (eventType: string, callback: (...args: any[]) => void) => void;
  sendData: (data: string) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  showConfirm: (message: string, callback?: (confirmed: boolean) => void) => void;
  showAlert: (message: string, callback?: () => void) => void;
  showPopup: (params: any, callback?: (buttonId: string) => void) => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  BackButton: {
    isVisible: boolean;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
    show: () => void;
    hide: () => void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export function useTelegramWebApp() {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [initData, setInitData] = useState<string | null>(null);
  const [user, setUser] = useState<TelegramWebApp['initDataUnsafe']['user'] | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (window.Telegram && window.Telegram.WebApp) {
      const tgWebApp = window.Telegram.WebApp;
      setWebApp(tgWebApp);
      setInitData(tgWebApp.initData);
      setUser(tgWebApp.initDataUnsafe.user || null);
      tgWebApp.ready();
      setIsReady(true);
    } else {
      console.warn("Telegram WebApp object not found. Running in standalone mode.");
      // For local development, mock some data
      setInitData("query_id=AAH-..."); // Example mock initData
      setUser({ id: 12345, first_name: "Dev", username: "dev_user" });
      setIsReady(true);
    }
  }, []);

  return { webApp, initData, user, isReady };
}