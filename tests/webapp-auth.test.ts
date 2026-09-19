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

function sign(fields: Record<string, string>, token = TOKEN): string {
  const pairs = Object.entries(fields)
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
