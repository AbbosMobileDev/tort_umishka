import { config } from '../config.js';

/**
 * Mini App manzili. Telegram faqat HTTPS ni qabul qiladi, shuning uchun lokal
 * `http://localhost` da `null` qaytadi — bu holda bot eski bosqichma-bosqich
 * oqimda ishlaydi va hech qayerda ishlamaydigan tugma chiqmaydi.
 */
export function miniAppUrl(): string | null {
  const raw = config.webappUrl.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}
