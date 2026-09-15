import { formatDateLongUz, formatDateUz } from '../services/dates.js';
import { formatKg, formatSom } from '../services/pricing.js';
import type { Order, Product, Shop } from '../types.js';
import { statusUz } from './uz.js';

export const at = {
  notAdmin: 'Bu buyruq faqat do\'kon admini uchun.',

  newOrder: (o: Order): string => {
    const lines = [
      `🎂 *Buyurtma #${o.orderNumber}*`,
      `${o.productSnapshot.name}, ${formatKg(o.weightKg)}`,
    ];
    for (const opt of o.optionsSnapshot) lines.push(`${opt.groupName}: ${opt.optionName}`);
    if (o.inscriptionText) lines.push(`Yozuv: "${o.inscriptionText}"`);
    lines.push(`📅 ${formatDateLongUz(o.pickupDate)}, ${o.pickupTimeSlot ?? ''}`);
    lines.push(
      o.deliveryType === 'delivery'
        ? `🚚 Yetkazish — ${o.addressText ?? ''}${o.addressNote ? ` (${o.addressNote})` : ''}`
        : '🏠 Olib ketish',
    );
    lines.push(`👤 ${o.customerName ?? ''} ${o.customerPhone ?? ''}`);
    lines.push(
      `💰 Jami ${formatSom(o.total)} | Avans ${formatSom(o.prepaidAmount)} ` +
        `${o.paymentStatus === 'paid' ? '✅ to\'landi' : '⏳ kutilmoqda'} | ` +
        `Qoldiq ${formatSom(o.remainingAmount)}`,
    );
    lines.push(`Holat: *${statusUz(o.status)}*`);
    return lines.join('\n');
  },

  receiptCaption: (o: Order) =>
    `🧾 Buyurtma #${o.orderNumber} uchun chek keldi. Avans: ${formatSom(o.prepaidAmount)}`,

  dailyPlan: (date: string, orders: Order[], tomorrowCount: number): string => {
    if (!orders.length) {
      return `☀️ *Bugungi reja — ${formatDateUz(date)}*\n\nBugunga buyurtma yo'q.\nErtaga: ${tomorrowCount} buyurtma`;
    }
    const lines = [`☀️ *Bugungi reja — ${formatDateUz(date)}*`, ''];
    orders.forEach((o, i) => {
      lines.push(
        `${i + 1}. #${o.orderNumber} ${o.productSnapshot.name} ${formatKg(o.weightKg)} — ` +
          `${o.pickupTimeSlot ?? ''}, ${o.deliveryType === 'delivery' ? 'yetkazish' : 'olib ketish'}`,
      );
    });
    const kg = orders.reduce((s, o) => s + o.weightKg, 0);
    const som = orders.reduce((s, o) => s + o.total, 0);
    lines.push('');
    lines.push(`Jami ${orders.length} buyurtma, ${formatKg(kg)}, ${formatSom(som)}`);
    lines.push(`Ertaga: ${tomorrowCount} buyurtma`);
    return lines.join('\n');
  },

  ordersForDate: (date: string, orders: Order[]): string => {
    if (!orders.length) return `${formatDateLongUz(date)} — buyurtma yo'q.`;
    const lines = [`*${formatDateLongUz(date)}*`, ''];
    for (const o of orders) {
      lines.push(
        `#${o.orderNumber} ${o.productSnapshot.name} ${formatKg(o.weightKg)} — ` +
          `${o.pickupTimeSlot ?? ''} — ${statusUz(o.status)}\n` +
          `${o.customerName ?? ''} ${o.customerPhone ?? ''} — ${formatSom(o.total)}`,
      );
      lines.push('');
    }
    return lines.join('\n');
  },

  quota: (shop: Shop, usedKg: number, usedOrders: number, date: string) =>
    `📊 *Kunlik limit — ${formatDateUz(date)}*\n\n` +
    `Buyurtmalar: ${usedOrders} / ${shop.dailyCapacityOrders}\n` +
    `Og'irlik: ${formatKg(usedKg)} / ${formatKg(shop.dailyCapacityKg)}\n` +
    `Minimal muddat: ${shop.leadTimeHours} soat\n` +
    `Ish kunlari: ${shop.workingDays.join(', ')} (1 = dushanba)\n\n` +
    `O'zgartirish uchun tugmani bosing.`,

  quotaAskOrders: 'Kuniga nechta buyurtma qabul qilasiz? Son yozing (masalan: 8)',
  quotaAskKg: 'Kuniga jami necha kg pishira olasiz? Son yozing (masalan: 25)',
  quotaUpdated: 'Limit yangilandi ✅',

  menuHeader: '🍰 *Katalog*\n\nMahsulotni tanlang — narxini o\'zgartirish yoki vaqtincha o\'chirish mumkin.',
  productAdmin: (p: Product) =>
    `*${p.name}*\n1 kg — ${formatSom(p.pricePerKg)}\nHolat: ${p.isAvailable ? '✅ sotuvda' : '⛔️ o\'chirilgan'}`,
  askNewPrice: (p: Product) => `*${p.name}* uchun 1 kg narxini yozing (faqat son, so'mda):`,
  priceInvalid: 'Faqat son yozing. Masalan: 95000',
  priceUpdated: 'Narx yangilandi ✅ Eski buyurtmalar summasi o\'zgarmaydi.',
  availabilityToggled: (p: Product) =>
    p.isAvailable ? `${p.name} — sotuvga qaytarildi ✅` : `${p.name} — vaqtincha o'chirildi ⛔️`,

  askBlockDate: 'Qaysi sanani yopamiz? `YYYY-MM-DD` ko\'rinishida yozing (masalan: 2026-09-20)',
  dateBlocked: (d: string) => `${formatDateUz(d)} yopildi. Bu kunga buyurtma qabul qilinmaydi.`,
  dateInvalid: 'Sana formati noto\'g\'ri. Namuna: 2026-09-20',

  report: (params: { days: number; orders: number; kg: number; som: number }) =>
    `📈 *So'nggi ${params.days} kun*\n\n` +
    `Buyurtmalar: ${params.orders}\n` +
    `Og'irlik: ${formatKg(params.kg)}\n` +
    `Summa: ${formatSom(params.som)}`,

  idInfo: (chatId: number, userId: number, isGroup: boolean) =>
    `Chat ID: \`${chatId}\`\nSizning ID: \`${userId}\`\n` +
    (isGroup ? '\nBu guruh ID sini `.env` dagi ADMIN_GROUP_ID ga yozing.' : ''),

  helpAdmin:
    '*Admin buyruqlari*\n' +
    '/bugun — bugungi buyurtmalar\n' +
    '/ertaga — ertangi buyurtmalar\n' +
    '/menu — katalog va narxlar\n' +
    '/quota — kunlik limit\n' +
    '/yopish — sanani yopish\n' +
    '/hisobot — 30 kunlik statistika\n' +
    '/id — chat ID ni ko\'rish',
};
