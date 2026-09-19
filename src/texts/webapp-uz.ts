/**
 * Mini App (Telegram WebApp) dagi barcha matnlar.
 * Frontend hech qanday matnni o'zida saqlamaydi — lug'at `/api/bootstrap` javobida
 * shu yerdan beriladi (CLAUDE.md qoida 3).
 *
 * Qiymatlar faqat satr bo'lsin: ular JSON ga aylantirilib yuboriladi. O'zgaruvchi
 * o'rniga `{nom}` yoziladi, frontend uni `fmt()` bilan almashtiradi.
 */
export const w = {
  // --- umumiy
  loading: 'Yuklanmoqda...',
  retry: 'Qayta urinish',
  errorGeneric: 'Xatolik yuz berdi. Qayta urinib ko\'ring.',
  errorNetwork: 'Internet bilan aloqa yo\'q. Qayta urinib ko\'ring.',
  errorAuth: 'Sessiya tasdiqlanmadi. Mini ilovani botdan qayta oching.',
  back: 'Orqaga',
  free: 'bepul',
  perKg: '1 kg',
  /** Katalog kartochkasidagi qisqa ko'rinish: "90 000 so'm/kg" */
  perKgSuffix: '/kg',

  // --- pastki navigatsiya
  tabCatalog: 'Katalog',
  tabOrders: 'Buyurtmalarim',
  tabContact: 'Aloqa',

  // --- katalog
  catalogSubtitle: 'Tortni tanlang, narxini ko\'ring va bo\'sh kunga buyurtma bering.',
  catalogAll: 'Hammasi',
  catalogEmpty: 'Hozircha katalog bo\'sh. Keyinroq urinib ko\'ring.',
  catalogSearchPlaceholder: 'Tort nomi bo\'yicha qidirish',
  searchEmpty: 'Hech narsa topilmadi.',

  // --- mahsulot
  stepWeight: 'Og\'irligi',
  weightOther: 'Boshqa',
  weightCustomPlaceholder: 'Masalan: 2,5',
  weightInvalid: 'Faqat {min} dan {max} gacha bo\'lgan son yozing.',
  stepInscription: 'Tort ustiga yozuv',
  inscriptionToggle: 'Yozuv qo\'shish',
  inscriptionPlaceholder: 'Masalan: Dilnoza 25 yosh',
  inscriptionHint: 'Maksimal 40 belgi.',
  inscriptionTooLong: 'Yozuv 40 belgidan oshmasin.',
  priceTotal: 'Jami',
  btnContinue: 'Davom etish',

  // --- sana va vaqt
  stepDate: 'Qaysi kunga kerak?',
  dateHint: 'Faqat {kg} sig\'adigan bo\'sh kunlar ko\'rsatilgan.',
  dateFewLeft: '{n} o\'rin',
  dateEmpty:
    'Afsuski, yaqin kunlarda bu og\'irlik uchun bo\'sh joy yo\'q. Kamroq kg tanlab ko\'ring ' +
    'yoki do\'kon bilan bog\'laning.',
  stepTime: 'Qaysi vaqtda olasiz?',

  // --- yetkazish
  stepDelivery: 'Qanday olasiz?',
  deliveryTitle: 'Yetkazib berish',
  deliveryDesc: 'Kuryer ko\'rsatilgan manzilga olib boradi',
  pickupTitle: 'O\'zim olib ketaman',
  pickupDesc: 'Do\'kondan belgilangan vaqtda olasiz',
  addressLabel: 'Manzil',
  addressPlaceholder: 'Ko\'cha, uy, mo\'ljal',
  addressRequired: 'Manzilni yozing.',
  addressNoteLabel: 'Qo\'shimcha izoh',
  addressNotePlaceholder: 'Qavat, domofon, mo\'ljal',

  // --- telefon
  stepPhone: 'Telefon raqamingiz',
  phoneHint: 'Do\'kon buyurtma bo\'yicha shu raqamga qo\'ng\'iroq qiladi.',
  phonePlaceholder: '+998901234567',
  phoneShare: 'Telegramdagi raqamni olish',
  phoneInvalid: 'Raqam formati noto\'g\'ri. Namuna: +998901234567',

  // --- hisob
  stepSummary: 'Buyurtma tafsiloti',
  sumWhen: 'Qachon',
  sumWhere: 'Manzil',
  sumPhone: 'Telefon',
  sumInscription: 'Yozuv',
  sumDelivery: 'Yetkazish',
  sumTotal: 'Jami',
  sumPrepaid: 'Avans (hozir)',
  sumRemaining: 'Qoldiq (olishda)',
  btnConfirm: 'Tasdiqlash',
  confirming: 'Yuborilmoqda...',
  slotTaken: 'Kechirasiz, bu kun shu orada band bo\'lib qoldi. Boshqa kun tanlang.',

  // --- to'lov
  paymentTitle: 'Buyurtma qabul qilindi',
  paymentOrderNo: 'Buyurtma #{n}',
  paymentAmount: 'Avans to\'lovi',
  paymentCard: 'Karta raqami',
  paymentNoCard: 'Karta raqamini do\'kon yuboradi.',
  paymentCopy: 'Nusxa',
  paymentCopied: 'Nusxa olindi',
  paymentStep1: 'Yuqoridagi kartaga avansni o\'tkazing.',
  paymentStep2: 'Chek skrinshotini botga rasm qilib yuboring.',
  paymentStep3: 'Do\'kon tasdiqlagach, sizga xabar keladi.',
  btnSendReceipt: 'Chekni botga yuborish',

  // --- buyurtmalarim
  ordersEmpty: 'Sizda hali buyurtma yo\'q.',
  ordersEmptyHint: 'Katalogdan tort tanlab, birinchi buyurtmani bering.',
  orderRemaining: 'Qoldiq',

  // --- aloqa
  contactPhoneLabel: 'Telefon',
  contactNoPhone: 'Aloqa raqami kiritilmagan.',
  contactHours: 'Ish kunlari',
  contactSlots: 'Olish vaqtlari',
  contactPrepayment: 'Avans — buyurtma summasining {percent}%',
  contactLeadTime: 'Buyurtma kamida {hours} soat oldin qabul qilinadi',
  contactDeliveryFee: 'Yetkazish narxi — {fee}',
  contactWrite: 'Botga yozish',
};

export type WebappTexts = typeof w;
