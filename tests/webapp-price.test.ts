import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcPrice, formatKg, formatSom } from '../src/services/pricing.js';
import {
  calcPrice as webCalcPrice,
  formatKg as webFormatKg,
  formatSom as webFormatSom,
} from '../public/price.js';

/**
 * Mini App narxni brauzerda ham hisoblaydi (har bosishda serverga bormaslik uchun).
 * Ikki nusxa bir xil natija berishi shart — aks holda mijoz bir summani ko'rib,
 * buyurtmada boshqasini oladi.
 */

const CASES = [
  {
    name: 'oddiy: 1 kg, variantsiz',
    input: {
      pricePerKg: 150_000,
      weightKg: 1,
      options: [],
      hasInscription: false,
      inscriptionPrice: 15_000,
      deliveryFee: 0,
      prepaymentPercent: 40,
    },
  },
  {
    name: 'kasr og\'irlik + fixed variant',
    input: {
      pricePerKg: 145_000,
      weightKg: 1.5,
      options: [{ groupName: 'Ichlik', optionName: 'Shokolad', extraPrice: 20_000, priceType: 'fixed' as const }],
      hasInscription: false,
      inscriptionPrice: 15_000,
      deliveryFee: 0,
      prepaymentPercent: 40,
    },
  },
  {
    name: 'per_kg variant + yozuv + yetkazish',
    input: {
      pricePerKg: 180_000,
      weightKg: 2.5,
      options: [
        { groupName: 'Ichlik', optionName: 'Yong\'oq', extraPrice: 12_000, priceType: 'per_kg' as const },
        { groupName: 'Bezak', optionName: 'Gul', extraPrice: 0, priceType: 'fixed' as const },
      ],
      hasInscription: true,
      inscriptionPrice: 15_000,
      deliveryFee: 20_000,
      prepaymentPercent: 40,
    },
  },
  {
    name: 'yaxlitlash chegarasi: summa 1000 ga bo\'linmaydi',
    input: {
      pricePerKg: 133_333,
      weightKg: 1.7,
      options: [{ groupName: 'Ichlik', optionName: 'Krem', extraPrice: 7_777, priceType: 'per_kg' as const }],
      hasInscription: true,
      inscriptionPrice: 15_555,
      deliveryFee: 19_999,
      prepaymentPercent: 35,
    },
  },
  {
    name: '100% avans',
    input: {
      pricePerKg: 200_000,
      weightKg: 3,
      options: [],
      hasInscription: false,
      inscriptionPrice: 15_000,
      deliveryFee: 20_000,
      prepaymentPercent: 100,
    },
  },
];

for (const c of CASES) {
  test(`narx bir xil — ${c.name}`, () => {
    const server = calcPrice(c.input);
    const browser = webCalcPrice(c.input);
    assert.deepEqual(browser, server);
  });
}

test('summa va og\'irlik formati bir xil', () => {
  for (const amount of [0, 1000, 395_000, 1_250_000]) {
    assert.equal(webFormatSom(amount), formatSom(amount));
  }
  for (const kg of [1, 1.5, 2.25, 10]) {
    assert.equal(webFormatKg(kg), formatKg(kg));
  }
});
