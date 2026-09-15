# CLAUDE.md — TortBot

Mahsulot talablari: `docs/PRD.md`. Har o'zgartirishdan oldin shu hujjatga qarang.

## Majburiy qoidalar

1. **Har bir baza so'rovi `shop_id` bilan filtrlanadi.** Istisno yo'q. Bir do'konning mijozi
   boshqa do'konning ma'lumotini ko'rmasligi kerak (PRD 11.2).
2. **Pul faqat butun sonda (so'm).** `float` pul uchun ishlatilmaydi. Yaxlitlash —
   `roundUpTo(value, 1000)`.
3. **Foydalanuvchiga ko'rinadigan har bir satr `src/texts/` da.** Kodda hardcode matn yo'q.
4. **Narx tarixi.** Buyurtma yaratilganda narx `product_snapshot` / `options_snapshot` ga
   nusxalanadi. Do'kon narxni keyin o'zgartirsa, eski buyurtma summasi o'zgarmaydi.
5. **Baza sxemasi — `src/db/schema.sql`.** Yagona manba. Yangi ustun qo'shsangiz,
   `src/types.ts` va `src/db/repo.ts` dagi mapper'ni ham yangilang.
6. **Slot mantiqiga har o'zgartirishdan keyin test yozing.** Bu eng ko'p xato chiqadigan joy
   (`tests/availability.test.ts`, `tests/db.test.ts`).
7. **Sana faqat `YYYY-MM-DD` satr sifatida.** `Date` obyektlari vaqt zonasida adashadi —
   `src/services/dates.ts` yordamchilaridan foydalaning.
8. **SQL faqat `src/db/repo.ts` da.** Bot handlerlari bazaga to'g'ridan-to'g'ri murojaat
   qilmaydi.

## Arxitektura qisqacha

- `src/db/pool.ts` — bitta adapter ostida PGlite (lokal) va node-postgres (server).
  Ikkalasi ham bir xil SQL qabul qiladi, shuning uchun kod muhitga bog'liq emas.
- `src/bot/customer.ts` — state machine. Holat `sessions` jadvalida saqlanadi, `draft.history`
  orqali "Orqaga" ishlaydi.
- `src/bot/admin.ts` — customer handlerdan **oldin** ro'yxatdan o'tadi, chunki `ADMIN_*`
  holatidagi matnlarni u ushlashi kerak.
- `src/services/availability.ts` — `computeAvailableDates()` sof funksiya (bazasiz, testlanadi),
  `getAvailableDates()` uni baza bilan bog'laydi.

## Keyingi sprintlar

- Sprint 4 qoldig'i: `/menu` orqali yangi mahsulot qo'shish (nomi → kategoriya → rasm → narx)
- Sprint 5: ko'p do'kon — tokenlar `shops.bot_token` dan, webhook router `/webhook/:shopId`
- v1.1: Payme/Click — `services/payments/` interfeysi (`createInvoice`, `checkStatus`,
  `handleCallback`) orqali, merchant hisobi do'konning o'ziga tegishli bo'lsin
- v1.2: tug'ilgan kun eslatmalari — `occasions` jadvali to'lib boryapti, cron qo'shilsa bo'ldi
  (oyiga maks. 2 marketing xabari, har xabarda "o'chirish" tugmasi — PRD 9.2)

## Tekshirish

```
npm run typecheck
npm test          # 17 ta test: narx, slot mantiqi, baza tranzaksiyalari
npm run smoke     # Telegramsiz: katalog, narx, buyurtma va xabar matnlari terminalda
```
