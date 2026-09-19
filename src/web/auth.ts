import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

export interface WebAppUser {
  id: number;
  firstName: string | null;
  username: string | null;
}

/** initData eskirgan hisoblanadigan muddat (Telegram tavsiyasi — 24 soat). */
const MAX_AGE_SECONDS = 24 * 3600;

function equalHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Telegram WebApp `initData` ni tekshiradi (Telegram Bot API, "Validating data").
 *
 * Mini App brauzerda ishlaydi, ya'ni har qanday odam API ga so'rov yubora oladi.
 * Foydalanuvchi ID si faqat shu imzo tekshirilgandan keyin ishonchli bo'ladi —
 * boshqa hech qayerda `user.id` ga ishonmaymiz.
 */
export function verifyInitData(initData: string, botToken: string): WebAppUser | null {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === 'hash' || key === 'signature') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  if (!equalHex(computed, hash)) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!Number.isFinite(authDate) || authDate <= 0) return null;
  if (Date.now() / 1000 - authDate > MAX_AGE_SECONDS) return null;

  const rawUser = params.get('user');
  if (!rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as { id?: number; first_name?: string; username?: string };
    if (typeof user.id !== 'number') return null;
    return {
      id: user.id,
      firstName: user.first_name ?? null,
      username: user.username ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * So'rovdan foydalanuvchini aniqlaydi.
 * Lokal test uchun (polling + WEBAPP_DEV_USER_ID) imzo talab qilinmaydi — serverda
 * BOT_MODE=webhook bo'lgani uchun bu yo'l yopiq.
 */
export function authenticate(initData: string | undefined, botToken: string): WebAppUser | null {
  if (initData) {
    const user = verifyInitData(initData, botToken);
    if (user) return user;
  }
  if (config.mode === 'polling' && config.webappDevUserId) {
    return { id: config.webappDevUserId, firstName: null, username: null };
  }
  return null;
}
