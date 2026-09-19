import { InlineKeyboard, Keyboard } from 'grammy';
import type { AvailableDay } from '../services/availability.js';
import { formatKg, formatSom } from '../services/pricing.js';
import type { Category, Order, OrderStatus, Product, ProductOption } from '../types.js';
import { at } from '../texts/admin-uz.js';
import { t } from '../texts/uz.js';

/** Har bir bosqichda "Orqaga" va "Bekor qilish" bo'lishi shart (PRD 5.1). */
function withNav(kb: InlineKeyboard, includeBack = true): InlineKeyboard {
  kb.row();
  if (includeBack) kb.text(t.btnBack, 'nav:back');
  kb.text(t.btnCancel, 'nav:cancel');
  return kb;
}

/**
 * Asosiy menyu. Mini App manzili bo'lsa birinchi tugma katalogni bot ichidagi
 * ilovada ochadi; bo'lmasa eski bosqichma-bosqich oqim ishlaydi.
 */
export function mainMenuKeyboard(appUrl?: string | null): Keyboard {
  const kb = new Keyboard();
  if (appUrl) kb.webApp(t.btnOpenApp, appUrl);
  else kb.text(t.btnOrder);
  return kb.row().text(t.btnMyOrders).text(t.btnContact).resized().persistent();
}

/** /start xabari ostidagi katta tugma — ilovaga eng ko'rinadigan kirish. */
export function openAppKeyboard(appUrl: string): InlineKeyboard {
  return new InlineKeyboard().webApp(t.btnOpenApp, appUrl);
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

/** Buyurtma holatiga qarab keyingi qadam (PRD 8.1). Guruh ham, panel ham shundan foydalanadi. */
function nextStatusActions(order: Order): { label: string; status: OrderStatus }[] {
  switch (order.status) {
    case 'AWAITING_PAYMENT':
    case 'CONFIRMED':
      return [{ label: at.btnAccept, status: 'ACCEPTED' }];
    case 'ACCEPTED':
      return [{ label: at.btnBaking, status: 'BAKING' }];
    case 'BAKING':
      return [{ label: at.btnReady, status: 'READY' }];
    case 'READY':
      return order.deliveryType === 'delivery'
        ? [{ label: at.btnDelivering, status: 'DELIVERING' }]
        : [{ label: at.btnHandedOver, status: 'COMPLETED' }];
    case 'DELIVERING':
      return [{ label: at.btnDelivered, status: 'COMPLETED' }];
    default:
      return [];
  }
}

function isOpen(order: Order): boolean {
  return order.status !== 'COMPLETED' && order.status !== 'CANCELLED';
}

/** Admin guruhidagi buyurtma kartasi. */
export function adminOrderKeyboard(order: Order): InlineKeyboard {
  const kb = new InlineKeyboard();
  const id = order.id;
  if (order.paymentStatus === 'receipt_sent') {
    kb.text(at.btnPayOk, `a:pay:${id}:ok`).text(at.btnPayNo, `a:pay:${id}:no`).row();
  }
  for (const a of nextStatusActions(order)) kb.text(a.label, `a:st:${id}:${a.status}`);
  if (isOpen(order)) kb.row().text(at.btnCancelOrder, `a:st:${id}:CANCELLED`);
  return kb;
}

/* ------------------------------------------------------------ admin panel */

/** Admin shaxsiy chatidagi doimiy menyu. */
export function adminPanelKeyboard(): Keyboard {
  return new Keyboard()
    .text(at.btnOrders)
    .text(at.btnCatalog)
    .row()
    .text(at.btnReport)
    .text(at.btnSettings)
    .row()
    .text(at.btnCustomerMode)
    .resized()
    .persistent();
}

export function panelHomeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(at.btnOrders, 'p:ord')
    .text(at.btnCatalog, 'p:cat')
    .row()
    .text(at.btnReport, 'p:rep')
    .text(at.btnSettings, 'p:set');
}

/** Buyurtmalar bo'limi: ro'yxat turlari va ularning soni. */
export function panelOrderFiltersKeyboard(counts: Record<string, number>): InlineKeyboard {
  const label = (key: string) => `${at.filterLabel(key)} (${counts[key] ?? 0})`;
  return new InlineKeyboard()
    .text(label('new'), 'p:ord:new')
    .text(label('act'), 'p:ord:act')
    .row()
    .text(label('tdy'), 'p:ord:tdy')
    .text(label('tmw'), 'p:ord:tmw')
    .row()
    .text(at.filterArchive, 'p:ord:arc')
    .row()
    .text(at.btnBackPanel, 'p:home');
}

export function panelOrderListKeyboard(orders: Order[], filter: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const o of orders) kb.text(at.orderButton(o), `p:o:${o.id}:${filter}`).row();
  kb.text(at.btnRefresh, `p:ord:${filter}`).text(at.btnBackOrders, 'p:ord');
  return kb;
}

/** Panel ichidagi buyurtma kartasi — holat tugmalari shu xabarning o'zini yangilaydi. */
export function panelOrderKeyboard(order: Order, filter: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  const id = order.id;
  if (order.paymentStatus === 'receipt_sent') {
    kb.text(at.btnPayOk, `p:pay:${id}:ok:${filter}`)
      .text(at.btnPayNo, `p:pay:${id}:no:${filter}`)
      .row();
  }
  for (const a of nextStatusActions(order)) kb.text(a.label, `p:st:${id}:${a.status}:${filter}`).row();
  if (isOpen(order)) kb.text(at.btnCancelOrder, `p:st:${id}:CANCELLED:${filter}`).row();
  kb.text(at.btnBackOrders, `p:ord:${filter}`);
  return kb;
}

export function adminMenuKeyboard(products: Product[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const p of products) {
    kb.text(
      `${p.isAvailable ? '✅' : '⛔️'} ${p.name} — ${formatSom(p.pricePerKg)}`,
      `a:prod:${p.id}`,
    ).row();
  }
  kb.text(at.btnNewProduct, 'p:new').row();
  kb.text(at.btnBackPanel, 'p:home');
  return kb;
}

export function adminProductKeyboard(product: Product): InlineKeyboard {
  return new InlineKeyboard()
    .text(at.btnChangePrice, `a:price:${product.id}`)
    .row()
    .text(
      product.isAvailable ? at.btnDisableProduct : at.btnEnableProduct,
      `a:avail:${product.id}`,
    )
    .row()
    .text(at.btnDeleteProduct, `p:del:${product.id}`)
    .row()
    .text(at.btnBackCatalog, 'a:menu');
}

export function panelDeleteKeyboard(product: Product): InlineKeyboard {
  return new InlineKeyboard()
    .text(at.btnDeleteYes, `p:delok:${product.id}`)
    .row()
    .text(at.btnDeleteNo, `a:prod:${product.id}`);
}

export function panelCategoryKeyboard(categories: Category[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const c of categories) kb.text(c.name, `p:newcat:${c.id}`).row();
  return kb.text(at.btnNewCategory, 'p:newcat:new');
}

export function panelSkipPhotoKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text(at.btnSkipPhoto, 'p:nophoto');
}

export function panelReportKeyboard(period?: string): InlineKeyboard {
  const kb = new InlineKeyboard()
    .text(at.btnReportToday, 'p:rep:today')
    .text(at.btnReportWeek, 'p:rep:week')
    .row()
    .text(at.btnReportMonth, 'p:rep:month')
    .text(at.btnReportNext, 'p:rep:next')
    .row();
  if (period) kb.text(at.btnCsv, `p:csv:${period}`).row();
  return kb.text(at.btnBackPanel, 'p:home');
}

export function panelSettingsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(at.btnQuota, 'p:quota')
    .row()
    .text(at.btnBlockDate, 'p:block')
    .text(at.btnUnblockDate, 'p:unblock')
    .row()
    .text(at.btnBackPanel, 'p:home');
}

export function adminQuotaKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text(at.btnQuotaOrders, 'a:quota:orders')
    .text(at.btnQuotaKg, 'a:quota:kg');
}

/** Shaxsiy chatga keladigan qisqa bildirishnoma — kartani ochadigan bitta tugma. */
export function panelOpenOrderKeyboard(orderId: number): InlineKeyboard {
  return new InlineKeyboard().text(at.btnOpenOrder, `p:o:${orderId}:new`);
}
