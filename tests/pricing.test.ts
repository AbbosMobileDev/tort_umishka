import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcPrice, formatKg, formatSom, roundUpTo } from '../src/services/pricing.js';

test('1000 so\'mgacha yuqoriga yaxlitlaydi', () => {
  assert.equal(roundUpTo(194_001), 195_000);
  assert.equal(roundUpTo(195_000), 195_000);
  assert.equal(roundUpTo(1), 1_000);
});

test('to\'liq hisob: 2 kg + per_kg ichlik + yozuv + yetkazish', () => {
  const p = calcPrice({
    pricePerKg: 85_000,
    weightKg: 2,
    options: [{ groupName: 'Ichlik', optionName: 'Qaymoqli', extraPrice: 5_000, priceType: 'per_kg' }],
    hasInscription: true,
    inscriptionPrice: 15_000,
    deliveryFee: 20_000,
    prepaymentPercent: 40,
  });
  assert.equal(p.base, 170_000);
  assert.equal(p.optionsTotal, 10_000);
  assert.equal(p.inscription, 15_000);
  assert.equal(p.subtotal, 195_000);
  assert.equal(p.total, 215_000);
  assert.equal(p.prepaid, 86_000);
  assert.equal(p.remaining, 129_000);
  assert.equal(p.prepaid + p.remaining, p.total);
});

test('kasr kg da ham butun songa keladi', () => {
  const p = calcPrice({
    pricePerKg: 85_000,
    weightKg: 1.5,
    options: [],
    hasInscription: false,
    inscriptionPrice: 15_000,
    deliveryFee: 0,
    prepaymentPercent: 40,
  });
  assert.equal(p.base, 127_500);
  assert.equal(p.total, 128_000);
  assert.equal(p.prepaid, 52_000);
  assert.equal(p.remaining, 76_000);
  assert.ok(Number.isInteger(p.total) && Number.isInteger(p.prepaid));
});

test('fixed va per_kg qo\'shimchalar farqlanadi', () => {
  const p = calcPrice({
    pricePerKg: 100_000,
    weightKg: 3,
    options: [
      { groupName: 'Ichlik', optionName: 'Mevali', extraPrice: 10_000, priceType: 'per_kg' },
      { groupName: 'Bezak', optionName: 'Shokolad naqsh', extraPrice: 25_000, priceType: 'fixed' },
    ],
    hasInscription: false,
    inscriptionPrice: 15_000,
    deliveryFee: 0,
    prepaymentPercent: 50,
  });
  assert.deepEqual(p.optionLines.map((l) => l.amount), [30_000, 25_000]);
  assert.equal(p.total, 355_000);
  assert.equal(p.prepaid, 178_000);
});

test('formatlash', () => {
  assert.equal(formatSom(395_000), "395 000 so'm");
  assert.equal(formatSom(1_240_000), "1 240 000 so'm");
  assert.equal(formatKg(1.5), '1,5 kg');
  assert.equal(formatKg(3), '3 kg');
});
