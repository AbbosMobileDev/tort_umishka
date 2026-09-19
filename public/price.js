/**
 * Narx hisobining brauzer nusxasi — foydalanuvchi variantni bosgan zahoti summa
 * ko'rinsin, har bosishda serverga so'rov ketmasin.
 *
 * DIQQAT: bu `src/services/pricing.ts` ning aynan nusxasi. Ikkalasi bir xil natija
 * berishi `tests/webapp-price.test.ts` da tekshiriladi. Biri o'zgarsa — ikkinchisi ham.
 * Buyurtmadagi haqiqiy summa har doim serverda qayta hisoblanadi.
 */

export function roundUpTo(value, step = 1000) {
  return Math.ceil(value / step) * step;
}

export function calcPrice(input) {
  const base = Math.round(input.pricePerKg * input.weightKg);

  const optionLines = input.options.map((o) => ({
    label: o.optionName,
    amount:
      o.priceType === 'per_kg'
        ? Math.round(o.extraPrice * input.weightKg)
        : Math.round(o.extraPrice),
  }));
  const optionsTotal = optionLines.reduce((s, l) => s + l.amount, 0);

  const inscription = input.hasInscription ? Math.round(input.inscriptionPrice) : 0;
  const delivery = Math.round(input.deliveryFee);

  const subtotal = base + optionsTotal + inscription;
  const total = roundUpTo(subtotal + delivery);
  const prepaid = roundUpTo((total * input.prepaymentPercent) / 100);
  const remaining = total - prepaid;

  return {
    base,
    optionLines,
    optionsTotal,
    inscription,
    delivery,
    subtotal,
    total,
    prepaid,
    remaining,
  };
}

/** 395000 → "395 000 so'm" */
export function formatSom(amount) {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

/** 1.5 → "1,5 kg" */
export function formatKg(kg) {
  const s = Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ',');
  return `${s} kg`;
}
