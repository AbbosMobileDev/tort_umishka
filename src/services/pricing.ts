/**
 * Narx hisoblash. Barcha summalar butun sonda (so'm). Float ishlatilmaydi.
 * PRD 7-bo'lim.
 */

export interface PriceOptionInput {
  groupName: string;
  optionName: string;
  extraPrice: number;
  priceType: 'fixed' | 'per_kg';
}

export interface PriceInput {
  pricePerKg: number;
  weightKg: number;
  options: PriceOptionInput[];
  hasInscription: boolean;
  inscriptionPrice: number;
  deliveryFee: number;
  prepaymentPercent: number;
}

export interface PriceBreakdown {
  base: number;
  optionLines: { label: string; amount: number }[];
  optionsTotal: number;
  inscription: number;
  delivery: number;
  subtotal: number;
  total: number;
  prepaid: number;
  remaining: number;
}

export function roundUpTo(value: number, step = 1000): number {
  return Math.ceil(value / step) * step;
}

export function calcPrice(input: PriceInput): PriceBreakdown {
  const base = Math.round(input.pricePerKg * input.weightKg);

  const optionLines = input.options.map((o) => ({
    label: o.optionName,
    amount:
      o.priceType === 'per_kg' ? Math.round(o.extraPrice * input.weightKg) : Math.round(o.extraPrice),
  }));
  const optionsTotal = optionLines.reduce((s, l) => s + l.amount, 0);

  const inscription = input.hasInscription ? Math.round(input.inscriptionPrice) : 0;
  const delivery = Math.round(input.deliveryFee);

  const subtotal = base + optionsTotal + inscription;
  const total = roundUpTo(subtotal + delivery);
  const prepaid = roundUpTo((total * input.prepaymentPercent) / 100);
  const remaining = total - prepaid;

  return { base, optionLines, optionsTotal, inscription, delivery, subtotal, total, prepaid, remaining };
}

/** 395000 → "395 000 so'm" */
export function formatSom(amount: number): string {
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

/** 1.5 → "1,5 kg" */
export function formatKg(kg: number): string {
  const s = Number.isInteger(kg) ? String(kg) : String(kg).replace('.', ',');
  return `${s} kg`;
}
