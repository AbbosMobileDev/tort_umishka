import { formatDateLongUz, formatDateUz } from '../services/dates.js';
import { formatKg, formatSom, type PriceBreakdown } from '../services/pricing.js';
import type { Order, OrderStatus } from '../types.js';

/**
 * Barcha foydalanuvchiga ko'rinadigan matnlar shu faylda.
 * Kodda hardcode qilingan matn bo'lmasin (PRD 11.3).
 */
export const t = {
  // --- bot buyruqlari (Telegram menyusi)
  cmdStart: 'Boshlash',

  // --- umumiy tugmalar
  btnOrder: '🎂 Buyurtma berish',
  btnMyOrders: '📋 Mening buyurtmalarim',
  btnContact: '☎️ Bog\'lanish',
  btnBack: '⬅️ Orqaga',
  btnCancel: '❌ Bekor qilish',
  btnSharePhone: '📱 Raqamni yuborish',
  btnShareLocation: '📍 Lokatsiyani yuborish',
  btnSkip: 'O\'tkazib yuborish',
  btnYes: 'Ha',
  btnNo: 'Yo\'q',
  btnOther: 'Boshqa',
  btnConfirmPay: '✅ Tasdiqlash',
  btnChange: '✏️ O\'zgartirish',

  // --- start
  welcome: (shopName: string) =>
    `Assalomu alaykum! 👋\n\n*${shopName}* botiga xush kelibsiz.\n\n` +
    `Bu yerda tortni o'zingiz tanlab, narxini ko'rib, bo'sh kunga buyurtma bera olasiz. ` +
    `Sotuvchini kutish shart emas.`,
  cancelled: 'Buyurtma bekor qilindi. Yangi buyurtma uchun 🎂 tugmasini bosing.',
  unknownCommand: 'Tushunmadim. Quyidagi tugmalardan foydalaning.',
  sessionExpired: 'Sessiya eskirdi. Iltimos, buyurtmani qaytadan boshlang.',

  // --- phone
  askPhone:
    'Buyurtma uchun telefon raqamingiz kerak. Pastdagi tugmani bosing yoki raqamni ' +
    '`+998901234567` ko\'rinishida yozing.',
  phoneInvalid: 'Raqam formati noto\'g\'ri. Namuna: +998901234567',
  phoneSaved: 'Rahmat! Raqam saqlandi.',

  // --- katalog
  askCategory: 'Qaysi turdagi shirinlik kerak?',
  emptyCatalog: 'Hozircha katalog bo\'sh. Keyinroq urinib ko\'ring.',
  askProduct: 'Yuqoridagilardan birini tanlang \u2b06\ufe0f',
  productCard: (name: string, description: string | null, pricePerKg: number) =>
    `*${name}*\n${description ? description + '\n' : ''}1 kg — ${formatSom(pricePerKg)}`,

  // --- konfigurator
  askWeight: (name: string) => `*${name}* — necha kg kerak?`,
  askWeightCustom: (min: number, max: number) =>
    `Kerakli og'irlikni yozing (${formatKg(min)} dan ${formatKg(max)} gacha). Masalan: 2,5`,
  weightInvalid: (min: number, max: number) =>
    `Faqat ${formatKg(min)} dan ${formatKg(max)} gacha bo'lgan son yozing.`,
  askOption: (groupName: string) => `${groupName} tanlang:`,
  askInscription: 'Tort ustiga yozuv kerakmi?',
  askInscriptionText: 'Yozuvni yuboring (maksimal 40 belgi). Masalan: Dilnoza 25 yosh',
  inscriptionTooLong: 'Yozuv juda uzun. 40 belgidan oshmasin.',

  // --- sana
  askDate: (kg: number) =>
    `Qaysi kunga kerak? Faqat ${formatKg(kg)} sig'adigan bo'sh kunlar ko'rsatilgan.`,
  noDates:
    'Afsuski, yaqin kunlarda bu og\'irlik uchun bo\'sh joy yo\'q. Kamroq kg tanlab ko\'ring ' +
    'yoki do\'kon bilan bog\'laning.',
  dateOption: (date: string, slots: number) =>
    `${formatDateUz(date)}${slots <= 2 ? ` (${slots} o'rin)` : ''}`,
  askTime: (date: string) => `${formatDateLongUz(date)}. Qaysi vaqtda olasiz?`,

  // --- yetkazish
  askDelivery: 'Tortni qanday olasiz?',
  btnDelivery: '🚚 Yetkazib berish',
  btnPickup: '🏠 O\'zim olib ketaman',
  askAddress:
    'Manzilni yuboring. Lokatsiya tugmasi eng aniq usul, xohlasangiz matn ham yozishingiz mumkin.',
  askAddressNote: 'Qo\'shimcha izoh bormi? (uy raqami, mo\'ljal). Bo\'lmasa — o\'tkazib yuboring.',

  // --- hisob
  summary: (params: {
    productName: string;
    weightKg: number;
    optionLines: { label: string; amount: number }[];
    inscription: string | null;
    date: string;
    timeSlot: string;
    deliveryType: 'delivery' | 'pickup';
    address: string | null;
    price: PriceBreakdown;
  }) => {
    const p = params.price;
    const lines: string[] = [
      '🧾 *Buyurtma tafsiloti*',
      '',
      `${params.productName} — ${formatKg(params.weightKg)}`,
      `${formatSom(p.base)}`,
    ];
    for (const o of params.optionLines) {
      lines.push(`${o.label} — ${o.amount > 0 ? formatSom(o.amount) : 'bepul'}`);
    }
    if (params.inscription) lines.push(`Yozuv: "${params.inscription}" — ${formatSom(p.inscription)}`);
    lines.push('');
    lines.push(`📅 ${formatDateLongUz(params.date)}, ${params.timeSlot}`);
    lines.push(
      params.deliveryType === 'delivery'
        ? `🚚 Yetkazish — ${params.address ?? ''} (${formatSom(p.delivery)})`
        : '🏠 O\'zingiz olib ketasiz',
    );
    lines.push('');
    lines.push(`*Jami: ${formatSom(p.total)}*`);
    lines.push(`Avans: ${formatSom(p.prepaid)}`);
    lines.push(`Qoldiq (olishda): ${formatSom(p.remaining)}`);
    lines.push('');
    lines.push('Hammasi to\'g\'rimi?');
    return lines.join('\n');
  },

  slotTaken:
    'Kechirasiz, siz tanlagan kun shu orada band bo\'lib qoldi. Iltimos, boshqa kun tanlang.',

  // --- to'lov (chek-skrinshot varianti)
  paymentInstructions: (params: {
    orderNumber: number;
    prepaid: number;
    card: string | null;
    cardHolder: string | null;
  }) =>
    `Buyurtma *#${params.orderNumber}* qabul qilindi.\n\n` +
    `Tasdiqlash uchun avans to'lovi kerak: *${formatSom(params.prepaid)}*\n\n` +
    (params.card
      ? `💳 Karta: \`${params.card}\`\n👤 ${params.cardHolder ?? ''}\n\n`
      : '💳 Karta raqami do\'kon tomonidan yuboriladi.\n\n') +
    `To'lovdan keyin *chek skrinshotini shu yerga rasm qilib yuboring*. ` +
    `Do'kon tasdiqlagach, sizga xabar keladi.`,
  receiptReceived:
    'Chek qabul qilindi ✅ Do\'kon tekshirib, tez orada tasdiqlaydi. Rahmat!',
  receiptNeedPhoto: 'Iltimos, chekni *rasm* ko\'rinishida yuboring.',

  // --- mijozga holat xabarlari
  statusMessage: (status: OrderStatus, orderNumber: number): string | null => {
    switch (status) {
      case 'CONFIRMED':
        return `✅ To'lovingiz tasdiqlandi. Buyurtma #${orderNumber} qabul qilindi.`;
      case 'ACCEPTED':
        return `👨‍🍳 Do'kon buyurtma #${orderNumber} ni tasdiqladi.`;
      case 'READY':
        return `🎂 Buyurtma #${orderNumber} tayyor!`;
      case 'DELIVERING':
        return `🚚 Buyurtma #${orderNumber} yo'lda.`;
      case 'COMPLETED':
        return `Rahmat! Buyurtma #${orderNumber} yakunlandi. Bahoyingizni bildiring ⭐`;
      case 'CANCELLED':
        return `❌ Buyurtma #${orderNumber} bekor qilindi. Savol bo'lsa, do'kon bilan bog'laning.`;
      default:
        return null;
    }
  },
  paymentRejected: (orderNumber: number) =>
    `Buyurtma #${orderNumber}: to'lov tasdiqlanmadi. Iltimos, do'kon bilan bog'laning yoki chekni qayta yuboring.`,

  // --- mening buyurtmalarim
  noOrders: 'Sizda hali buyurtma yo\'q.',
  myOrdersHeader: '📋 *Buyurtmalaringiz*',
  orderLine: (o: Order) =>
    `#${o.orderNumber} — ${o.productSnapshot.name}, ${formatKg(o.weightKg)}\n` +
    `${formatDateUz(o.pickupDate)}, ${o.pickupTimeSlot ?? ''} — ${statusUz(o.status)}\n` +
    `${formatSom(o.total)}`,

  contactInfo: (shopName: string, phone: string | null) =>
    `*${shopName}*\n${phone ? `☎️ ${phone}` : 'Aloqa raqami kiritilmagan.'}`,

  // --- eslatmalar
  reminderDayBefore: (o: Order) =>
    `⏰ Eslatma: ertaga (${formatDateUz(o.pickupDate)}, ${o.pickupTimeSlot ?? ''}) ` +
    `buyurtmangiz #${o.orderNumber} tayyor bo'ladi. Qoldiq: ${formatSom(o.remainingAmount)}`,
};

export function statusUz(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    DRAFT: 'qoralama',
    AWAITING_PAYMENT: 'to\'lov kutilmoqda',
    CONFIRMED: 'to\'landi',
    ACCEPTED: 'tasdiqlandi',
    BAKING: 'pishirilmoqda',
    READY: 'tayyor',
    DELIVERING: 'yo\'lda',
    COMPLETED: 'yakunlandi',
    CANCELLED: 'bekor qilindi',
  };
  return map[status];
}
