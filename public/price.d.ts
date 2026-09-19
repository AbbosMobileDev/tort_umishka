/**
 * `public/price.js` uchun tiplar — TypeScript testi brauzer nusxasini import qila olsin.
 * Shakl `src/services/pricing.ts` bilan bir xil.
 */
export interface WebPriceOption {
  optionName: string;
  extraPrice: number;
  priceType: 'fixed' | 'per_kg';
}

export interface WebPriceInput {
  pricePerKg: number;
  weightKg: number;
  options: WebPriceOption[];
  hasInscription: boolean;
  inscriptionPrice: number;
  deliveryFee: number;
  prepaymentPercent: number;
}

export interface WebPriceBreakdown {
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

export function roundUpTo(value: number, step?: number): number;
export function calcPrice(input: WebPriceInput): WebPriceBreakdown;
export function formatSom(amount: number): string;
export function formatKg(kg: number): string;
