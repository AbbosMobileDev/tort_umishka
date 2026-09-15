import { InlineKeyboard, Keyboard } from 'grammy';
import type { AvailableDay } from '../services/availability.js';
import { formatKg, formatSom } from '../services/pricing.js';
import type { Category, Order, Product, ProductOption } from '../types.js';
import { t } from '../texts/uz.js';

/** Har bir bosqichda "Orqaga" va "Bekor qilish" bo'lishi shart (PRD 5.1). */
function withNav(kb: InlineKeyboard, includeBack = true): InlineKeyboard {
  kb.row();
  if (includeBack) kb.text(t.btnBack, 'nav:back');
  kb.text(t.btnCancel, 'nav:cancel');
  return kb;
}

export function mainMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(t.btnOrder)
    .row()
    .text(t.btnMyOrders)
    .text(t.btnContact)
    .resized()
    .persistent();
}

export function phoneKeyboard(): Keyboard {
  return new Keyboard().requestContact(t.btnSharePhone).resized().oneTime();
}

export function locationKeyboard(): Keyboard {
  return new Keyboard().requestLocation(t.btnShareLocation).resized().oneTime();
}

export function categoriesKeyboard(categories: Category[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  categories.forEach((c, i) => {
    kb.text(c.name, `cat:${c.id}`);
    if (i % 2 === 1) kb.row();
  });
  return withNav(kb, false);
}

/** Har bir mahsulot rasmi ostidagi bitta tugma. */
export function productSelectKeyboard(product: Product): InlineKeyboard {
  return new InlineKeyboard().text(`✅ ${product.name} — tanlash`, `prod:${product.id}`);
}

/** Rasmsiz ro'yxat uchun zaxira variant. */
export function productsKeyboard(products: Product[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(`${p.name} — ${formatSom(p.pricePerKg)}/kg`, `prod:${p.id}`).row();
  }
  return withNav(kb);
}

/** Faqat "Orqaga" va "Bekor qilish". */
export function navKeyboard(): InlineKeyboard {
  return withNav(new InlineKeyboard());
}

export function weightKeyboard(product: Product): InlineKeyboard {
  const kb = new InlineKeyboard();
  product.weightOptions
    .filter((w) => w >= product.minKg && w <= product.maxKg)
    .forEach((w, i) => {
      kb.text(formatKg(w), `wt:${w}`);
      if (i % 3 === 2) kb.row();
    });
  kb.row().text(t.btnOther, 'wt:other');
  return withNav(kb);
}

export function optionsKeyboard(options: ProductOption[], weightKg: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const o of options) {
    const extra =
      o.extraPrice === 0
        ? ''
        : ` (+${formatSom(o.priceType === 'per_kg' ? o.extraPrice * weightKg : o.extraPrice)})`;
    kb.text(`${o.optionName}${extra}`, `opt:${o.id}`).row();
  }
  return withNav(kb);
}

export function inscriptionKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard().text(t.btnYes, 'ins:y').text(t.btnNo, 'ins:n');
  return withNav(kb);
}

export function datesKeyboard(days: AvailableDay[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  days.slice(0, 14).forEach((d, i) => {
    kb.text(t.dateOption(d.date, d.slotsForRequest), `date:${d.date}`);
    if (i % 2 === 1) kb.row();
  });
  return withNav(kb);
}

export function timeKeyboard(slots: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  slots.forEach((s, i) => kb.text(s, `time:${i}`).row());
  return withNav(kb);
}

export function deliveryKeyboard(deliveryFee: number): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text(`${t.btnDelivery} (${formatSom(deliveryFee)})`, 'dlv:d')
    .row()
    .text(t.btnPickup, 'dlv:p');
  return withNav(kb);
}

export function addressNoteKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard().text(t.btnSkip, 'addr:skip');
  return withNav(kb);
}

export function summaryKeyboard(): InlineKeyboard {
  const kb = new InlineKeyboard().text(t.btnConfirmPay, 'sum:ok').row().text(t.btnChange, 'sum:edit');
  return withNav(kb, false);
}

/* ------------------------------------------------------------------ admin */

/** Buyurtma holatiga qarab keyingi qadam tugmalari (PRD 8.1). */
export function adminOrderKeyboard(order: Order): InlineKeyboard {
  const kb = new InlineKeyboard();
  const id = order.id;
  if (order.paymentStatus === 'receipt_sent') {
    kb.text('✅ To\'lov tasdiqlandi', `a:pay:${id}:ok`)
      .text('❌ To\'lov yo\'q', `a:pay:${id}:no`)
      .row();
  }
  switch (order.status) {
    case 'AWAITING_PAYMENT':
    case 'CONFIRMED':
      kb.text('👨‍🍳 Qabul qilish', `a:st:${id}:ACCEPTED`);
      break;
    case 'ACCEPTED':
      kb.text('🔥 Pishirilmoqda', `a:st:${id}:BAKING`);
      break;
    case 'BAKING':
      kb.text('🎂 Tayyor', `a:st:${id}:READY`);
      break;
    case 'READY':
      if (order.deliveryType === 'delivery') kb.text('🚚 Yo\'lda', `a:st:${id}:DELIVERING`);
      else kb.text('✅ Topshirildi', `a:st:${id}:COMPLETED`);
      break;
    case 'DELIVERING':
      kb.text('✅ Yetkazildi', `a:st:${id}:COMPLETED`);
      break;
    default:
      break;
  }
  if (order.status !== 'COMPLETED' && order.status !== 'CANCELLED') {
    kb.row().text('❌ Bekor qilish', `a:st:${id}:CANCELLED`);
  }
  return kb;
}

export function adminMenuKeyboard(products: Product[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(`${p.isAvailable ? '✅' : '⛔️'} ${p.name} — ${formatSom(p.pricePerKg)}`, `a:prod:${p.id}`).row();
  }
  return kb;
}

export function adminProductKeyboard(product: Product): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 Narxni o\'zgartirish', `a:price:${product.id}`)
    .row()
    .text(product.isAvailable ? '⛔️ Vaqtincha o\'chirish' : '✅ Sotuvga qaytarish', `a:avail:${product.id}`)
    .row()
    .text('⬅️ Katalogga', 'a:menu');
}

export function adminQuotaKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('Buyurtma soni', 'a:quota:orders')
    .text('Kunlik kg', 'a:quota:kg');
}
