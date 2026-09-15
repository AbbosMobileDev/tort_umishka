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

  // --- buyurtma kartasi tugmalari
  btnAccept: '👨‍🍳 Qabul qilish',
  btnBaking: '🔥 Pishirilmoqda',
  btnReady: '🎂 Tayyor',
  btnDelivering: '🚚 Yo\'lda',
  btnDelivered: '✅ Yetkazildi',
  btnHandedOver: '✅ Topshirildi',
  btnCancelOrder: '❌ Bekor qilish',
  btnPayOk: '✅ To\'lov tasdiqlandi',
  btnPayNo: '❌ To\'lov yo\'q',
  payConfirmed: '✅ To\'lov tasdiqlandi',

  // --- katalog kartasi tugmalari
  btnChangePrice: '💰 Narxni o\'zgartirish',
  btnDisableProduct: '⛔️ Sotuvdan olish',
  btnEnableProduct: '✅ Sotuvga qaytarish',
  btnBackCatalog: '⬅️ Katalogga',
  btnQuotaOrders: 'Buyurtma soni',
  btnQuotaKg: 'Kunlik kg',

  /* ------------------------------------------------------------- panel */

  // Reply keyboard tugmalari (admin shaxsiy chatida)
  btnOrders: '📥 Buyurtmalar',
  btnCatalog: '🍰 Katalog',
  btnReport: '📊 Hisobot',
  btnSettings: '⚙️ Sozlamalar',
  btnCustomerMode: '👤 Mijoz rejimi',

  panelWelcome: (shopName: string) =>
    `🔑 *${shopName} — admin panel*\n\n` +
    'Pastdagi tugmalar orqali buyurtmalarni boshqaring, katalogni yangilang va ' +
    'hisobotni yuklab oling.',
  panelHome: '🔑 *Admin panel*\n\nKerakli bo\'limni tanlang.',
  customerMode:
    '👤 Mijoz rejimi yoqildi — botni xaridor ko\'zi bilan ko\'rasiz.\n' +
    'Panelga qaytish: /panel',
  panelOnlyPrivate: 'Panel shaxsiy chatda ishlaydi. Botga yozing: /panel',

  // --- buyurtmalar
  ordersHeader: '📥 *Buyurtmalar*\n\nQaysi ro\'yxatni ochamiz?',
  filterNew: '🆕 Yangi',
  filterActive: '🔥 Jarayonda',
  filterToday: '📅 Bugun',
  filterTomorrow: '➡️ Ertaga',
  filterArchive: '🗃 Arxiv',
  filterLabel: (key: string): string =>
    ({
      new: at.filterNew,
      act: at.filterActive,
      tdy: at.filterToday,
      tmw: at.filterTomorrow,
      arc: at.filterArchive,
    })[key] ?? key,
  ordersListHeader: (filterKey: string, count: number) =>
    `*${at.filterLabel(filterKey)}* — ${count} ta buyurtma\n\nTafsilot uchun ustiga bosing.`,
  ordersEmpty: (filterKey: string) => `*${at.filterLabel(filterKey)}* — hozircha bo\'sh.`,
  orderButton: (o: Order) =>
    `#${o.orderNumber} ${o.productSnapshot.name} ${formatKg(o.weightKg)} • ` +
    `${formatDateUz(o.pickupDate)} • ${statusUz(o.status)}`,
  statusSaved: (o: Order) => `#${o.orderNumber} → ${statusUz(o.status)}`,
  orderNotFound: 'Buyurtma topilmadi.',
  btnBackOrders: '⬅️ Ro\'yxatga',
  btnBackPanel: '⬅️ Panel',
  btnRefresh: '🔄 Yangilash',

  // --- katalog
  btnNewProduct: '➕ Yangi mahsulot',
  btnDeleteProduct: '🗑 O\'chirish',
  btnDeleteYes: '🗑 Ha, o\'chirilsin',
  btnDeleteNo: '⬅️ Yo\'q',
  deleteConfirm: (p: Product) =>
    `*${p.name}* butunlay o\'chirilsinmi?\n\n` +
    'Katalogdan yo\'qoladi. Eski buyurtmalar o\'zgarmaydi — ularda nomi va narxi ' +
    'nusxa qilib saqlangan.\n\n' +
    'Vaqtincha to\'xtatmoqchi bo\'lsangiz, o\'chirish o\'rniga "sotuvdan olish"ni tanlang.',
  productDeleted: (name: string) => `${name} katalogdan o\'chirildi 🗑`,

  askProductName:
    '➕ *Yangi mahsulot*\n\n1/4 — nomini yozing. Masalan: `Pista tort`\n\n' +
    'Bekor qilish: /panel',
  nameTooLong: 'Nom juda uzun. 60 belgidan oshmasin.',
  askProductCategory: (name: string) => `*${name}*\n\n2/4 — qaysi kategoriyaga qo\'shamiz?`,
  btnNewCategory: '➕ Yangi kategoriya',
  askCategoryName: 'Yangi kategoriya nomini yozing. Masalan: `Pirojniylar`',
  categoryCreated: (name: string) => `Kategoriya qo\'shildi: ${name} ✅`,
  askProductPhoto:
    '3/4 — mahsulot *rasmini* yuboring. Rasm mijozga katalogda ko\'rinadi.\n\n' +
    'Hozircha rasm bo\'lmasa — pastdagi tugmani bosing.',
  btnSkipPhoto: '🖼 Rasmsiz davom etish',
  photoSaved: 'Rasm saqlandi ✅',
  askProductPrice: '4/4 — 1 kg narxini yozing (faqat son, so\'mda). Masalan: `95000`',
  productCreated: (p: Product, copiedOptions: number) =>
    `✅ *${p.name}* katalogga qo\'shildi.\n` +
    `1 kg — ${formatSom(p.pricePerKg)}\n` +
    (copiedOptions
      ? `Ichlik/bezak variantlari shu kategoriyadan nusxalandi (${copiedOptions} ta).\n`
      : 'Ichlik/bezak variantlari yo\'q — mijoz to\'g\'ridan-to\'g\'ri og\'irlikni tanlaydi.\n') +
    'Mahsulot hoziroq sotuvda ✅',
  noCategories: 'Avval kategoriya qo\'shing.',

  // --- hisobot
  reportPeriodLabel: (key: string): string =>
    ({
      today: 'Bugun',
      week: 'So\'nggi 7 kun',
      month: 'So\'nggi 30 kun',
      next: 'Kelgusi buyurtmalar',
    })[key] ?? key,
  reportHint:
    '📊 *Hisobot*\n\nDavrni tanlang. Keyin ro\'yxatni Excel fayl qilib yuklab olsangiz bo\'ladi.',
  btnReportToday: 'Bugun',
  btnReportWeek: '7 kun',
  btnReportMonth: '30 kun',
  btnReportNext: 'Kelgusi',
  btnCsv: '⬇️ Excel (CSV) yuklab olish',
  reportBody: (params: {
    periodKey: string;
    from: string;
    to: string;
    orders: number;
    kg: number;
    som: number;
    prepaid: number;
    cancelled: number;
    topProducts: { name: string; count: number }[];
  }) => {
    const lines = [
      `📊 *${at.reportPeriodLabel(params.periodKey)}*`,
      `${formatDateUz(params.from)} — ${formatDateUz(params.to)}`,
      '',
      `Buyurtmalar: ${params.orders}`,
      `Og'irlik: ${formatKg(params.kg)}`,
      `Summa: ${formatSom(params.som)}`,
      `Olingan avans: ${formatSom(params.prepaid)}`,
    ];
    if (params.cancelled) lines.push(`Bekor qilingan: ${params.cancelled}`);
    if (params.topProducts.length) {
      lines.push('');
      lines.push('Ko\'p buyurtma qilinganlari:');
      for (const p of params.topProducts) lines.push(`• ${p.name} — ${p.count}`);
    }
    lines.push('');
    lines.push('To\'liq ro\'yxatni fayl qilib yuklab olishingiz mumkin ⬇️');
    return lines.join('\n');
  },
  reportEmpty: (periodKey: string) =>
    `📊 *${at.reportPeriodLabel(periodKey)}*\n\nBu davrda buyurtma yo'q.`,
  csvHeader: [
    'Buyurtma',
    'Olish sanasi',
    'Vaqt',
    'Mahsulot',
    'Kg',
    'Variantlar',
    'Yozuv',
    'Yetkazish',
    'Manzil',
    'Mijoz',
    'Telefon',
    'Jami',
    'Avans',
    'Qoldiq',
    'To\'lov',
    'Holat',
  ],
  csvFileName: (from: string, to: string) => `hisobot_${from}_${to}.csv`,
  csvCaption: (periodKey: string, count: number) =>
    `${at.reportPeriodLabel(periodKey)} — ${count} ta buyurtma. Excel yoki Google Sheets'da ochiladi.`,

  // --- sozlamalar
  settingsHeader: (shop: Shop, date: string) =>
    `⚙️ *Sozlamalar*\n\n` +
    `Kunlik limit: ${shop.dailyCapacityOrders} buyurtma / ${formatKg(shop.dailyCapacityKg)}\n` +
    `Minimal muddat: ${shop.leadTimeHours} soat\n` +
    `Ish kunlari: ${shop.workingDays.join(', ')} (1 = dushanba)\n` +
    `Bugun: ${formatDateUz(date)}`,
  btnQuota: '📦 Kunlik limit',
  btnBlockDate: '🚫 Sanani yopish',
  btnUnblockDate: '✅ Sanani ochish',
  askUnblockDate: 'Qaysi sanani qayta ochamiz? `YYYY-MM-DD` ko\'rinishida yozing',
  dateUnblocked: (d: string) => `${formatDateUz(d)} qayta ochildi. Buyurtma qabul qilinadi.`,

  // --- shaxsiy chatga bildirishnoma
  newOrderAlert: (o: Order) =>
    `🔔 *Yangi buyurtma #${o.orderNumber}*\n` +
    `${o.productSnapshot.name}, ${formatKg(o.weightKg)} • ${formatDateUz(o.pickupDate)} ` +
    `${o.pickupTimeSlot ?? ''}\n${formatSom(o.total)}`,
  receiptAlert: (o: Order) =>
    `🧾 *Chek keldi — #${o.orderNumber}*\n` +
    `Avans: ${formatSom(o.prepaidAmount)}. Tasdiqlash uchun kartani oching.`,
  btnOpenOrder: '👁 Ko\'rish',

  cmdId: 'Chat ID ni ko\'rish',
  adminCommands: [
    { command: 'panel', description: 'Admin panel' },
    { command: 'bugun', description: 'Bugungi buyurtmalar' },
    { command: 'ertaga', description: 'Ertangi buyurtmalar' },
    { command: 'menu', description: 'Katalog' },
    { command: 'quota', description: 'Kunlik limit' },
    { command: 'yopish', description: 'Sanani yopish' },
    { command: 'hisobot', description: 'Statistika' },
    { command: 'id', description: 'Chat ID ni ko\'rish' },
  ],

  idInfo: (chatId: number, userId: number, isGroup: boolean) =>
    `Chat ID: \`${chatId}\`\nSizning ID: \`${userId}\`\n` +
    (isGroup ? '\nBu guruh ID sini `.env` dagi ADMIN_GROUP_ID ga yozing.' : ''),

  helpAdmin:
    '*Admin buyruqlari*\n' +
    '/panel — admin panel (tugmalar bilan)\n' +
    '/bugun — bugungi buyurtmalar\n' +
    '/ertaga — ertangi buyurtmalar\n' +
    '/menu — katalog va narxlar\n' +
    '/quota — kunlik limit\n' +
    '/yopish — sanani yopish\n' +
    '/hisobot — 30 kunlik statistika\n' +
    '/id — chat ID ni ko\'rish',
};
