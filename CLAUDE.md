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
- `src/bot/panel.ts` — admin panel (do'kon egasining shaxsiy chati): buyurtmalar,
  katalog, hisobot, sozlamalar. Har bo'lim bitta xabarni tahrirlaydi (`editMessageText`),
  shuning uchun eski ekranlar chatda to'planib qolmaydi. Callback prefiksi — `p:`.
- `src/bot/admin.ts` — admin guruh tomoni: buyruqlar va guruhdagi karta tugmalari (`a:`).
- Ro'yxatdan o'tish tartibi: `panel` -> `admin` -> `customer`. Panel `ADMIN_*` holatidagi
  matnlarni va admin uchun `/start` ni mijoz handleridan oldin ushlashi kerak.
- `src/bot/guard.ts` — `isAdmin` (guruh ham) va `isPanelUser` (faqat shaxsiy chat).
- `src/services/availability.ts` — `computeAvailableDates()` sof funksiya (bazasiz, testlanadi),
  `getAvailableDates()` uni baza bilan bog'laydi.

## Mini App

Katalog va buyurtma oqimi Telegram ichidagi ilovada (Mini App) ochiladi. Ilova bot bilan
bir xil serverdan beriladi — alohida hosting yo'q.

- `public/` — frontend: build qadami yo'q, oddiy ES modullar. `index.html`, `app.css`, `app.js`.
- `src/web/server.ts` — HTTP yo'llari: statik fayllar, `/media/*` (assets), `/api/*`,
  `/api/photo/:id` (diskdagi rasm yoki Telegram `file_id`).
- `src/web/api.ts` — JSON endpointlar: `bootstrap`, `dates`, `quote`, `order`, `orders`, `phone`.
- `src/web/auth.ts` — `initData` imzosini tekshiradi. Foydalanuvchi ID siga faqat shundan
  keyin ishoniladi.
- `src/web/url.ts` — `miniAppUrl()`: manzil HTTPS bo'lmasa `null`, ya'ni bot eski
  bosqichma-bosqich oqimda ishlaydi (lokal `http://localhost` da shunday bo'ladi).
- `src/texts/webapp-uz.ts` — ilovaning barcha matnlari. Frontendda hardcode matn yo'q:
  lug'at `bootstrap` javobida keladi, `{nom}` o'rniga qiymat `fmt()` bilan qo'yiladi.

Mini App qoidalari:

9. **Frontenddan kelgan har bir maydon serverda qayta tekshiriladi** (`resolveDraft`).
   Brauzerdagi qiymatga ishonilmaydi — API ochiq internetda turadi.
10. **Narx serverda hisoblanadi.** `public/price.js` — `src/services/pricing.ts` ning aynan
    nusxasi va faqat ko'rsatish uchun. Biri o'zgarsa ikkinchisi ham o'zgaradi;
    `tests/webapp-price.test.ts` ikkalasini solishtiradi.

## Keyingi sprintlar

- Sprint 5: ko'p do'kon — tokenlar `shops.bot_token` dan, webhook router `/webhook/:shopId`
- v1.1: Payme/Click — `services/payments/` interfeysi (`createInvoice`, `checkStatus`,
  `handleCallback`) orqali, merchant hisobi do'konning o'ziga tegishli bo'lsin
- v1.2: tug'ilgan kun eslatmalari — `occasions` jadvali to'lib boryapti, cron qo'shilsa bo'ldi
  (oyiga maks. 2 marketing xabari, har xabarda "o'chirish" tugmasi — PRD 9.2)

## Tekshirish

```
npm run typecheck
npm test            # 37 ta test: narx (server va brauzer nusxasi), slot mantiqi, baza
                    # tranzaksiyalari, katalog, hisobot, Mini App initData imzosi
npm run smoke       # Telegramsiz: katalog, narx, buyurtma va xabar matnlari terminalda
npm run smoke:panel # Telegramsiz: admin panel oqimlari (soxta update'lar handlerlardan o'tadi)
npm run dev:app     # Mini App ni brauzerda ochish (bot ishga tushmaydi, webhook buzilmaydi)
```
