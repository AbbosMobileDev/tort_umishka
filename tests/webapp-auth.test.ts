import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyInitData } from '../src/web/auth.js';

/**
 * Mini App API ochiq internetda turadi: foydalanuvchi ID siga faqat Telegram imzosi
 * tekshirilgandan keyin ishonamiz. Bu yerda buzilgan/soxta initData o'tmasligi
 * tekshiriladi.
 */

const TOKEN = '123456:AAAA-test-token';

function sign(
  fields: Record<string, string>,
  token = TOKEN,
  opts: { skipSignatureInHash?: boolean } = {},
): string {
  const pairs = Object.entries(fields)
    .filter(([k]) => !(opts.skipSignatureInHash && k === 'signature'))
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

function freshFields(overrides: Record<string, string> = {}) {
  return {
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: 42, first_name: 'Dilnoza', username: 'dilnoza' }),
    ...overrides,
  };
}

test('to\'g\'ri imzo — foydalanuvchi qaytadi', () => {
  const user = verifyInitData(sign(freshFields()), TOKEN);
  assert.equal(user?.id, 42);
  assert.equal(user?.firstName, 'Dilnoza');
  assert.equal(user?.username, 'dilnoza');
});

/**
 * Yangi Telegram mijozlari `signature` maydonini ham yuboradi. U `hash` hisobiga
 * kiradi, lekin ba'zi mijozlar uni chiqarib tashlaydi — ikkala holat ham o'tishi kerak,
 * aks holda foydalanuvchi ilovani ocholmaydi.
 */
test('signature bor: hash unga ham hisoblangan — qabul qilinadi', () => {
  const fields = freshFields({ signature: 'abc_Ed25519_imzo' });
  assert.equal(verifyInitData(sign(fields), TOKEN)?.id, 42);
});

test('signature bor: hash usiz hisoblangan — baribir qabul qilinadi', () => {
  const fields = freshFields({ signature: 'abc_Ed25519_imzo' });
  const initData = sign(fields, TOKEN, { skipSignatureInHash: true });
  assert.equal(verifyInitData(initData, TOKEN)?.id, 42);
});

test('signature bor, lekin user o\'zgartirilgan — rad etiladi', () => {
  const initData = sign(freshFields({ signature: 'abc_Ed25519_imzo' }));
  const params = new URLSearchParams(initData);
  params.set('user', JSON.stringify({ id: 999, first_name: 'Soxta' }));
  assert.equal(verifyInitData(params.toString(), TOKEN), null);
});

test('ma\'lumot o\'zgartirilsa — rad etiladi', () => {
  const initData = sign(freshFields());
  const params = new URLSearchParams(initData);
  params.set('user', JSON.stringify({ id: 999, first_name: 'Soxta' }));
  assert.equal(verifyInitData(params.toString(), TOKEN), null);
});

test('boshqa token bilan imzolangan — rad etiladi', () => {
  const initData = sign(freshFields(), '999999:BOSHQA-token');
  assert.equal(verifyInitData(initData, TOKEN), null);
});

test('eskirgan initData — rad etiladi', () => {
  const old = String(Math.floor(Date.now() / 1000) - 25 * 3600);
  assert.equal(verifyInitData(sign(freshFields({ auth_date: old })), TOKEN), null);
});

test('hash yo\'q yoki bo\'sh initData — rad etiladi', () => {
  const noHash = new URLSearchParams(freshFields()).toString();
  assert.equal(verifyInitData(noHash, TOKEN), null);
  assert.equal(verifyInitData('', TOKEN), null);
});

test('user maydoni yo\'q — rad etiladi', () => {
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE' };
  assert.equal(verifyInitData(sign(fields), TOKEN), null);
});
