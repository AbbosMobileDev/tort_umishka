# PRD — Shirinlik do'koni uchun Telegram bot

**Mahsulot nomi (ishchi):** TortBot
**Versiya:** 1.0 (MVP)
**Muallif:** Khojiakbar
**Sana:** 2026-yil sentyabr
**Holat:** Ishlab chiqishga tayyor

---

## 1. Qisqacha mazmun

Tumandagi shirinlik/tort do'konlari hozir Telegram guruhlarida tort rasmini tashlab, kelgan shaxsiy xabarlarga qo'lda javob berib sotishadi. Bu jarayonda:

- so'rovlarning bir qismi javobsiz qoladi (sotuvchi non pishirayotgan bo'ladi),
- har bir mijoz uchun narx qo'lda hisoblanadi (kg × narx + qo'shimchalar),
- bir kunga qancha buyurtma olinganini hech kim hisoblab bormaydi — bayramlarda ortiqcha buyurtma olib, yetkazolmay qolishadi,
- avans olinmaydi, natijada buyurtmadan voz kechish (no-show) zarar keltiradi,
- mijozlar bazasi yo'q — takroriy sotuv tasodifga qolgan.

TortBot shu beshta muammoni hal qiladi: mijoz bot orqali tortni o'zi konfiguratsiya qiladi, narxni ko'radi, bo'sh kunni tanlaydi, avansni to'laydi; do'kon admin guruhida buyurtma avtomatik paydo bo'ladi.

**Asosiy tamoyil:** bot suhbatlashish uchun emas, **buyurtmani yakunlash** uchun. Har bir ekran mijozni to'lovga bir qadam yaqinlashtirishi kerak.

---

## 2. Maqsad va muvaffaqiyat mezonlari

### Biznes maqsadlari (do'kon uchun)

| Maqsad | Metrika | MVP maqsadi |
|---|---|---|
| Yo'qotilgan so'rovlarni kamaytirish | Bot orqali kelgan so'rov → buyurtma konversiyasi | ≥ 35% |
| No-show'ni kamaytirish | Avans to'langan buyurtmalar ulushi | ≥ 60% |
| Sotuvchining vaqtini tejash | Qo'lda javob berishga ketgan vaqt | kuniga −1 soat |
| Ortiqcha buyurtmani oldini olish | Kunlik limitdan oshgan holatlar | 0 |
| Takroriy sotuv | Tug'ilgan kun eslatmasidan kelgan buyurtmalar | 2-oydan boshlab o'lchanadi |

### Texnik maqsadlar

- Bot javob vaqti: 95-foizli holatda < 1.5 soniya.
- Bir do'konni tizimga ulash vaqti: < 30 daqiqa (katalog kiritish bilan birga).
- Ishlab turish (uptime): ≥ 99% (oddiy VPS uchun yetarli).

---

## 3. Foydalanuvchilar

| Rol | Kim | Asosiy ehtiyoji |
|---|---|---|
| **Mijoz** | Tort buyurtma qiluvchi oddiy odam, 20–50 yosh, telefonda Telegram ishlatadi | Tez, sotuvchi bilan gaplashmasdan narxni bilish va buyurtma berish |
| **Do'kon admini** | Do'kon egasi yoki sotuvchi | Buyurtmalarni bir joyda ko'rish, kunlik pishirish rejasini bilish |
| **Kuryer** (ixtiyoriy) | Yetkazuvchi | Manzil va telefon raqamni olish |
| **Super-admin** | Siz (tizim egasi) | Yangi do'kon ulash, obuna holatini boshqarish |

**Muhim:** mijozning texnik tayyorgarligi past. Har bir qadamda **tugmalar** bo'lishi shart, matn kiritish faqat majburiy joyda (tortga yozuv, manzil izohi).

---

## 4. Ko'lam (Scope)

### 4.1 MVP ichida

1. Ko'p do'konli (multi-tenant) arxitektura — bitta kod bazasi, har do'konga alohida Telegram bot tokeni.
2. Mijoz oqimi: katalog → konfigurator → narx → sana/slot → manzil → avans to'lovi → tasdiq.
3. Kunlik quota (slot) boshqaruvi.
4. Admin guruhga buyurtma bildirishnomasi + holat tugmalari.
5. Buyurtma holati o'zgarganda mijozga avtomatik xabar.
6. Ertalabki kunlik pishirish rejasi.
7. Tug'ilgan kun sanasini saqlash va bir yildan keyin eslatma.
8. Do'kon admini uchun Telegram ichidagi boshqaruv (katalog, narx, quota, ish kunlari).
9. To'lov: Payme va/yoki Click orqali avans.

### 4.2 MVP'dan tashqarida (keyingi versiyalar)

- AI/LLM bilan erkin suhbat (v2).
- Instagram integratsiyasi (v2).
- Veb admin panel (v2 — MVP'da hamma narsa Telegram ichida).
- Kuryer uchun alohida bot va marshrut.
- Sodiqlik dasturi, chegirma kuponlari.
- Ko'p filialli do'konlar.
- Onlayn to'liq to'lov (MVP'da faqat avans, qolgani naqd).

---

## 5. Mijoz oqimi (asosiy ssenariy)

### 5.1 State machine

Bot holat mashinasi sifatida ishlaydi. Har bir foydalanuvchining joriy holati bazada saqlanadi (`sessions` jadvali). Bu tugmalar bosilishini to'g'ri talqin qilish uchun majburiy.

```
IDLE
 └─> START            /start bosildi
      └─> PHONE       telefon raqam so'raladi (request_contact tugmasi)
           └─> CATALOG          kategoriya tanlash
                └─> PRODUCT     mahsulot tanlash (rasm + tavsif + bazaviy narx)
                     └─> WEIGHT       kg tanlash
                          └─> FILLING ichlik/variant tanlash (agar bor bo'lsa)
                               └─> INSCRIPTION  yozuv kerakmi (ha/yo'q → matn)
                                    └─> DATE          bo'sh sanalar ro'yxati
                                         └─> TIME     vaqt oralig'i
                                              └─> DELIVERY   yetkazish yoki olib ketish
                                                   └─> ADDRESS    (yetkazish bo'lsa) lokatsiya yoki matn
                                                        └─> SUMMARY   yakuniy hisob
                                                             └─> PAYMENT   avans to'lovi
                                                                  └─> DONE
```

Har bir holatda **"⬅️ Orqaga"** va **"❌ Bekor qilish"** tugmalari bo'lishi shart. Orqaga bosilganda oldingi holatga qaytadi va tanlov saqlanadi.

### 5.2 Har bir qadam bo'yicha talablar

**START**
Salomlashish + do'kon nomi + qisqa tavsif. Tugmalar: `Buyurtma berish`, `Mening buyurtmalarim`, `Bog'lanish`.

**PHONE**
Telefon raqam `request_contact` tugmasi orqali olinadi. Qo'lda kiritishga ham ruxsat, lekin format tekshiriladi (`+998XXXXXXXXX`). Raqam bir marta olinadi — keyingi buyurtmalarda so'ralmaydi.

**CATALOG**
Kategoriyalar tugma sifatida (2 ustunli klaviatura). Bo'sh kategoriya ko'rsatilmaydi.

**PRODUCT**
Har mahsulot: rasm (`sendPhoto`), nomi, qisqa tavsif, 1 kg narxi. Agar mahsulot vaqtincha mavjud bo'lmasa (`is_available = false`) — ro'yxatda ko'rinmaydi.

**WEIGHT**
Do'kon sozlagan variantlar (masalan 1, 1.5, 2, 3, 4, 5 kg). Minimal va maksimal kg do'kon sozlamasida. "Boshqa" tugmasi → matn kiritish → validatsiya (min/max oralig'ida).

**FILLING**
Ixtiyoriy. Har variantning o'z qo'shimcha narxi bo'lishi mumkin (`0` bo'lishi ham mumkin).

**INSCRIPTION**
`Ha` / `Yo'q`. Ha bo'lsa — matn so'raladi, uzunligi cheklanadi (maks. 40 belgi). Narxga do'kon sozlagan qo'shimcha qo'shiladi.

**DATE**
Faqat **bo'sh** sanalar ko'rsatiladi. Hisoblash mantiqi 6-bo'limda. Ko'rsatiladigan oraliq: bugundan `lead_time_days` kundan keyin boshlanib, `booking_horizon_days` (odatda 30) kungacha. Har sana yonida holat: `bo'sh` / `N o'rin` / ko'rsatilmaydi (to'lgan bo'lsa).

**TIME**
Do'kon sozlagan vaqt oraliqlari (masalan `10:00–12:00`, `12:00–15:00`, `15:00–18:00`).

**DELIVERY**
`Yetkazib berish` / `O'zim olib ketaman`. Yetkazish narxi: do'kon sozlamasida — fiksirlangan summa yoki zona bo'yicha.

**ADDRESS**
Telegram lokatsiya tugmasi (`request_location`) birinchi variant, matn ikkinchi. Qo'shimcha izoh maydoni (uy raqami, mo'ljal).

**SUMMARY**
To'liq hisob-kitob ko'rsatiladi: mahsulot, kg, ichlik, yozuv, yetkazish, jami, avans summasi. Tugmalar: `Tasdiqlash va to'lash`, `O'zgartirish`, `Bekor qilish`.

**PAYMENT**
Avans foizi do'kon sozlamasida (standart 40%). Payme/Click havolasi generatsiya qilinadi. To'lov muvaffaqiyatli bo'lganda buyurtma `CONFIRMED` holatiga o'tadi.

**Muhim edge-case:** mijoz sanani tanlaganidan to'lov qilgunicha o'tgan vaqtda o'sha slot boshqa mijoz tomonidan band qilinishi mumkin. Yechim: `SUMMARY` bosqichida slot **15 daqiqaga vaqtincha rezerv** qilinadi (`slot_holds` jadvali, TTL 15 min). To'lov bo'lmasa rezerv bekor bo'ladi va mijozga xabar beriladi.

---

## 6. Slot va quota mantiqi

Bu mahsulotning eng muhim biznes qoidasi. Do'kon bir kunda cheklangan miqdorda tort pishira oladi.

### Sozlamalar (har do'kon uchun)

| Parametr | Tavsif | Standart |
|---|---|---|
| `daily_capacity_kg` | Kuniga umumiy kg quvvati | 25 |
| `daily_capacity_orders` | Kuniga buyurtmalar soni | 8 |
| `lead_time_hours` | Buyurtmadan tayyorlashgacha minimal vaqt | 24 |
| `booking_horizon_days` | Necha kun oldindan buyurtma olinadi | 30 |
| `working_days` | Ish kunlari (hafta kunlari massivi) | 1–6 |
| `blocked_dates` | Dam olish/band sanalar ro'yxati | — |

### Sanani bo'sh deb hisoblash sharti

Sana bo'sh deb ko'rsatiladi, agar **hammasi** bajarilsa:

1. Sana `now + lead_time_hours` dan keyin.
2. Sana `working_days` ichida va `blocked_dates` da yo'q.
3. `SUM(orders.weight_kg)` shu sana uchun `< daily_capacity_kg`.
4. `COUNT(orders)` shu sana uchun `< daily_capacity_orders`.
5. Aktiv `slot_holds` ham hisobga olinadi (rezerv qilingan, hali to'lanmagan).

**Qolgan o'rin** = `MIN(capacity_orders − band, FLOOR((capacity_kg − band_kg) / tanlangan_kg))`.

Agar mijoz tanlagan kg qolgan quvvatga sig'masa — o'sha sana ro'yxatda ko'rsatilmaydi va sababi tushuntiriladi: *"3 kg uchun bu kunda joy qolmadi. 16-mart bo'sh."*

### Bayram rejimi

Do'kon admini bitta tugma bilan `daily_capacity` ni vaqtincha oshirishi mumkin (8-mart, Yangi yil). Bu alohida sozlama emas — `capacity_overrides` jadvalidagi sana-specific yozuv.

---

## 7. Narx hisoblash

```
bazaviy_narx   = mahsulot.narx_1kg × og'irlik_kg
ichlik_qoshimcha = ichlik.qoshimcha_narx × og'irlik_kg   (yoki fiksirlangan — do'kon sozlaydi)
yozuv          = mahsulot bo'lsa: do'kon.inscription_price
bezak          = tanlangan bezaklar yig'indisi
yetkazish      = do'kon.delivery_fee (yoki 0, agar olib ketish bo'lsa)

jami           = bazaviy_narx + ichlik_qoshimcha + yozuv + bezak + yetkazish
avans          = CEIL(jami × do'kon.prepayment_percent / 100 / 1000) × 1000
qoldiq         = jami − avans
```

**Yaxlitlash:** barcha summalar 1000 so'mgacha yuqoriga yaxlitlanadi. Ekranda `395 000 so'm` formatida (probel bilan ajratilgan), tiyinlarsiz.

**Narx tarixi:** buyurtma yaratilganda narxlar `order_items` ga **nusxalanadi**. Do'kon keyinchalik narxni o'zgartirsa, eski buyurtmalar o'zgarmaydi. Bu majburiy talab.

---

## 8. Admin tomoni (do'kon egasi)

MVP'da veb panel yo'q. Hamma narsa Telegram ichida.

### 8.1 Admin guruh

Do'kon ulanganda alohida Telegram guruh yaratiladi, bot unga admin sifatida qo'shiladi.

**Yangi buyurtma xabari:**

```
🎂 Buyurtma #128
Napoleon, 3 kg, ichi klassik
Yozuv: "Dilnoza 25 yosh"
📅 15-mart, 14:00–16:00
🚚 Yetkazish — Chilonzor 7-kvartal, 12-uy
👤 Dilshod, +998 90 123 45 67
💰 Jami 395 000 | Avans 158 000 ✅ to'landi | Qoldiq 237 000

[Tasdiqlash] [Bekor qilish]
```

Tasdiqlangandan keyin tugmalar o'zgaradi: `[Pishirildi]` → `[Yetkazildi]`.

### 8.2 Buyurtma holatlari

| Holat | Kim o'zgartiradi | Mijozga xabar |
|---|---|---|
| `DRAFT` | tizim | yo'q |
| `AWAITING_PAYMENT` | tizim | to'lov havolasi |
| `CONFIRMED` | to'lov tizimi | "Buyurtmangiz qabul qilindi" |
| `ACCEPTED` | admin | "Do'kon tasdiqladi" |
| `BAKING` | admin | yo'q (ixtiyoriy) |
| `READY` | admin | "Tortingiz tayyor" |
| `DELIVERING` | admin | "Yo'lda" |
| `COMPLETED` | admin | "Rahmat! Bahо bering ⭐" |
| `CANCELLED` | admin yoki mijoz | sabab bilan |

Holat o'zgarishi `order_events` jadvaliga yoziladi (kim, qachon, qaysi holatga).

### 8.3 Ertalabki reja

Har kuni soat 08:00 da (do'kon vaqt zonasi) admin guruhga:

```
☀️ Bugungi reja — 15-mart

1. #128 Napoleon 3 kg — 14:00, yetkazish
2. #131 Medovik 2 kg — 12:00, olib ketish
3. #133 Bolalar torti 4 kg — 16:00, yetkazish

Jami 3 buyurtma, 9 kg, 1 240 000 so'm
Ertaga: 5 buyurtma
```

### 8.4 Admin buyruqlari (shaxsiy chatda)

| Buyruq | Vazifa |
|---|---|
| `/menu` | Katalogni boshqarish — mahsulot qo'shish, narx o'zgartirish, yoqish/o'chirish |
| `/bugun` | Bugungi buyurtmalar |
| `/ertaga` | Ertangi buyurtmalar |
| `/quota` | Kunlik limitni ko'rish va o'zgartirish |
| `/yopish` | Ma'lum sanani band qilish (dam olish) |
| `/hisobot` | Haftalik/oylik statistika |

**Mahsulot qo'shish oqimi:** nomi → kategoriya → rasm → 1 kg narxi → saqlash. Har qadam alohida xabar, tugmalar bilan. Ichlik/bezak variantlari shu kategoriyadagi mavjud mahsulotdan nusxalanadi.

### 8.5 Admin panel (shaxsiy chat)

Guruhda kartalar oqimda ko'milib ketadi, shuning uchun do'kon egasi uchun botning o'zi
panel bo'lib ochiladi: `ADMIN_USER_ID` li foydalanuvchi `/start` bosganda doimiy menyu
chiqadi — **📥 Buyurtmalar · 🍰 Katalog · 📊 Hisobot · ⚙️ Sozlamalar · 👤 Mijoz rejimi**.

Panelning qoidasi: har bo'lim **bitta xabarni tahrirlab** yangilanadi. Ro'yxat → karta →
holat o'zgarishi — hammasi o'sha xabar ichida, chatda eski ekranlar qolmaydi.

| Bo'lim | Nima qiladi |
|---|---|
| 📥 Buyurtmalar | 🆕 Yangi, 🔥 Jarayonda, 📅 Bugun, ➡️ Ertaga, 🗃 Arxiv — har biri sanog'i bilan. Kartadagi tugmalar holatni o'zgartiradi, mijozga xabar ketadi, guruhdagi karta ham yangilanadi |
| 🍰 Katalog | Mahsulot qo'shish, narx, sotuvda bor/yo'q, butunlay o'chirish (tasdiq so'raladi) |
| 📊 Hisobot | Bugun / 7 kun / 30 kun / kelgusi buyurtmalar — jamlanma va **CSV fayl** (Excel, Google Sheets) |
| ⚙️ Sozlamalar | Kunlik limit, sanani yopish va qayta ochish |

Yangi buyurtma tushganda guruhga to'liq karta, adminning shaxsiy chatiga esa qisqa
bildirishnoma (`🔔 Yangi buyurtma #128` + «Ko'rish» tugmasi) yuboriladi — bosilganda
o'sha xabarning o'zida to'liq karta ochiladi.

Mahsulot o'chirilsa, eski buyurtmalar o'zgarmaydi — ularda nomi va narxi
`product_snapshot` ichida saqlangan.

---

## 9. Bildirishnomalar va marketing

### 9.1 Avtomatik eslatmalar

| Trigger | Vaqt | Kimga | Mazmun |
|---|---|---|---|
| Buyurtmadan 1 kun oldin | 18:00 | mijoz | "Ertaga tortingiz tayyor bo'ladi" |
| Buyurtma kuni | 09:00 | mijoz | Vaqt va qoldiq summa eslatmasi |
| Yetkazilgandan 2 soat keyin | — | mijoz | Baho so'rash (1–5 yulduz) |
| Tug'ilgan kun | 5 kun oldin | mijoz | "O'tgan yili Dilnoza uchun tort olgan edingiz. Yaqinlashyapti 🎂" |

### 9.2 Tug'ilgan kun bazasi

Bu mahsulotning eng qimmatli qismi. Mijoz `INSCRIPTION` qadamida yozuv kiritsa (masalan "Dilnoza 25 yosh") va sana ma'lum bo'lsa, `occasions` jadvaliga yoziladi:

```
customer_id, occasion_name ("Dilnoza"), occasion_date (buyurtma sanasi), source
```

Bir yildan keyin shu sanadan 5 kun oldin avtomatik xabar yuboriladi.

**Muhim cheklov:** spam bo'lmasligi uchun bir mijozga oyiga maksimum 2 ta marketing xabari. Har xabarda "Eslatmalarni o'chirish" tugmasi bo'lishi shart.

---

## 10. Ma'lumotlar modeli

```
shops
  id, name, telegram_bot_token (shifrlangan), admin_group_id, timezone,
  currency, prepayment_percent, delivery_fee, inscription_price,
  lead_time_hours, booking_horizon_days, daily_capacity_kg,
  daily_capacity_orders, working_days (int[]), is_active,
  subscription_until, created_at

categories
  id, shop_id, name, sort_order, is_active

products
  id, shop_id, category_id, name, description, photo_file_id,
  price_per_kg, min_kg, max_kg, weight_options (numeric[]),
  is_available, sort_order

product_options            -- ichlik, bezak va h.k.
  id, product_id, group_name, option_name, extra_price,
  price_type ('fixed' | 'per_kg'), is_default, sort_order

customers
  id, shop_id, telegram_user_id, phone, first_name, username,
  language, notifications_enabled, created_at
  UNIQUE (shop_id, telegram_user_id)

sessions                   -- state machine holati
  id, shop_id, telegram_user_id, state, draft_order (jsonb),
  updated_at, expires_at

orders
  id, shop_id, customer_id, order_number, status,
  product_snapshot (jsonb), weight_kg, options_snapshot (jsonb),
  inscription_text, delivery_type, address_text, location_lat,
  location_lng, address_note, pickup_date, pickup_time_slot,
  subtotal, delivery_fee, total, prepaid_amount, remaining_amount,
  payment_provider, payment_status, payment_transaction_id,
  created_at, confirmed_at, completed_at, cancelled_reason

order_events
  id, order_id, from_status, to_status, actor_type, actor_id, created_at

slot_holds                 -- vaqtincha rezerv
  id, shop_id, telegram_user_id, date, weight_kg, expires_at

capacity_overrides         -- bayram rejimi
  id, shop_id, date, capacity_kg, capacity_orders, is_blocked, note

occasions                  -- tug'ilgan kunlar
  id, shop_id, customer_id, occasion_name, occasion_date,
  last_reminded_at, is_active

reviews
  id, order_id, rating, comment, created_at
```

**Indekslar (majburiy):**
- `orders (shop_id, pickup_date, status)` — slot hisoblash uchun eng ko'p ishlatiladi.
- `sessions (shop_id, telegram_user_id)` unique.
- `slot_holds (shop_id, date)` + `expires_at` bo'yicha tozalash.
- `occasions (occasion_date)` — kunlik eslatma job uchun.

---

## 11. Texnik arxitektura

### 11.1 Stack

| Qatlam | Tanlov | Sabab |
|---|---|---|
| Til | TypeScript (Node.js 20+) | Claude Code bilan yaxshi ishlaydi, tiplar xatolarni kamaytiradi |
| Bot framework | grammY | Telegram Bot API uchun zamonaviy, session/conversation plaginlari bor |
| Baza | PostgreSQL (Supabase yoki o'z VPS) | jsonb, tranzaksiyalar, indekslar |
| ORM | Drizzle yoki Prisma | migratsiyalar |
| Job scheduler | node-cron yoki BullMQ | ertalabki reja, eslatmalar, hold tozalash |
| Deployment | VPS (Ubuntu) + PM2, yoki Docker | O'zbekistonda arzon VPS yetarli |
| Log | pino | strukturalangan log |

**Muqobil:** Python + aiogram 3 ham to'liq mos. Agar Python qulayroq bo'lsa, PRD o'zgarmaydi.

### 11.2 Multi-tenant yondashuv

Bitta jarayon, ko'p bot. grammY'ning `Bot` instansiyalari `shops` jadvalidan yuklanadi:

- **Webhook rejimi (tavsiya etiladi):** har do'kon uchun `/webhook/:shopId` endpoint. Bitta HTTP server hammasiga xizmat qiladi.
- Har so'rovda `shop_id` konteksti aniqlanadi va **barcha** so'rovlar shu bo'yicha filtrlanadi.

**Kritik xavfsizlik qoidasi:** hech bir baza so'rovi `shop_id` filtrisiz bajarilmasin. Bir do'konning mijozi boshqa do'konning ma'lumotini ko'rmasligi kerak. Buni repository qatlamida majburiy parametr sifatida qo'ying.

### 11.3 Loyiha strukturasi

```
src/
  bot/
    index.ts              -- bot instansiyalarini yuklash, webhook router
    middlewares/
      shopContext.ts      -- shop_id ni aniqlash
      session.ts          -- sessiyani yuklash/saqlash
      errorHandler.ts
    scenes/               -- state machine qadamlari
      start.ts
      phone.ts
      catalog.ts
      configurator.ts     -- weight, filling, inscription
      schedule.ts         -- date, time
      delivery.ts
      summary.ts
      payment.ts
    admin/
      menu.ts
      orders.ts
      quota.ts
      reports.ts
    keyboards/
    texts/
      uz.ts               -- barcha matnlar shu yerda
      ru.ts
  services/
    pricing.ts
    availability.ts       -- slot hisoblash
    orders.ts
    notifications.ts
    payments/
      payme.ts
      click.ts
  db/
    schema.ts
    migrations/
    repositories/
  jobs/
    dailyPlan.ts
    reminders.ts
    occasionReminders.ts
    cleanupHolds.ts
  config/
```

**Matnlarni ajratish majburiy.** Har bir foydalanuvchiga ko'rinadigan satr `texts/uz.ts` da bo'lsin. Kodda hardcode qilingan matn bo'lmasin — keyin rus tilini qo'shish va do'kon ovozini sozlash oson bo'ladi.

### 11.4 To'lov integratsiyasi

Payme va Click O'zbekistonda merchant hisobi talab qiladi. Ikkalasining rasmiy hujjatlari bo'yicha:

- **Merchant hisobi do'konning o'ziga tegishli bo'lsin.** Pul sizning hisobingizdan o'tmasin — bu huquqiy javobgarlik va ishonch masalasi.
- Integratsiya `services/payments/` da **interfeys** orqali qilinsin (`createInvoice`, `checkStatus`, `handleCallback`), shunda provayderni almashtirish oson bo'ladi.
- MVP uchun oddiyroq variant: **to'lov havolasi + chek rasmini yuborish**. Mijoz to'laydi, chek skrinshotini botga yuboradi, admin tasdiqlaydi. Bu 1 kunda ishlaydi va birinchi pilot uchun yetadi. Avtomatik callback'ni v1.1 da qo'shing.

**Aniqlashtirish kerak:** Payme/Click merchant shartlari va API hujjatlari joriy holatini ishga tushirishdan oldin tekshiring — komissiya va integratsiya talablari o'zgarib turadi.

---

## 12. Xatolarni boshqarish va edge-case'lar

| Holat | Xatti-harakat |
|---|---|
| Slot to'lib qoldi (to'lov paytida) | Mijozga xabar + eng yaqin bo'sh sanalar taklifi + avans qaytariladi |
| Mijoz o'rtada g'oyib bo'ldi | Sessiya 2 soatdan keyin `expires_at` bo'yicha tozalanadi; 1 soatdan keyin bitta eslatma |
| Telegram API xatosi (429, 500) | Eksponensial retry, maks. 3 marta; muvaffaqiyatsiz bo'lsa admin guruhga xabar |
| Bot bloklangan (403) | `notifications_enabled = false`, keyingi xabarlar yuborilmaydi |
| Do'kon obunasi tugadi | Bot mijozlarga "vaqtincha ishlamayapti" deydi, adminга eslatma |
| Rasm yuklanmadi | Rasmsiz davom etadi, log yoziladi |
| Bir vaqtda ikki mijoz oxirgi slotni oladi | Baza darajasida tranzaksiya + `SELECT ... FOR UPDATE` |

**Barcha pul hisob-kitoblari butun sonda (tiyin/so'm)** saqlansin — `float` ishlatilmasin.

---

## 13. Ishga tushirish rejasi (sprintlar)

### Sprint 1 — Asos (3–4 kun)
- Loyiha skeleti, baza sxemasi, migratsiyalar
- Bitta do'kon uchun bot ishga tushishi (`/start`, telefon olish)
- Katalog ko'rsatish (statik ma'lumot bilan)
- **Natija:** mijoz mahsulotlarni ko'ra oladi

### Sprint 2 — Buyurtma oqimi (4–5 kun)
- To'liq state machine: konfigurator → sana → manzil → hisob
- Narx hisoblash servisi
- Slot mantiqi + `slot_holds`
- Buyurtma yaratish
- **Natija:** buyurtma bazaga tushadi (to'lovsiz)

### Sprint 3 — Admin (3 kun)
- Admin guruhga bildirishnoma + holat tugmalari
- Mijozga holat xabarlari
- `/bugun`, `/ertaga`, `/quota`
- Ertalabki reja (cron)
- **Natija:** do'kon botni real ishlata oladi

### Sprint 4 — To'lov va katalog boshqaruvi (3–4 kun)
- Avans to'lovi (avval chek-skrinshot varianti)
- `/menu` — katalogni Telegram orqali boshqarish
- **Natija:** pilot do'konga topshirishga tayyor

### Sprint 5 — Multi-tenant va marketing (3 kun)
- Ko'p bot qo'llab-quvvatlash, webhook router
- Super-admin: yangi do'kon ulash
- Tug'ilgan kun eslatmalari, baho so'rash
- **Natija:** ikkinchi va uchinchi do'konni ulash mumkin

**Umumiy baholash:** ~16–19 ish kuni. Claude Code bilan bu muddat sezilarli qisqarishi mumkin, lekin test va real ishlatishdagi tuzatishlarga vaqt qoldiring.

---

## 14. Qabul qilish mezonlari (MVP tayyor deb hisoblanadi, agar)

1. Yangi mijoz `/start` dan to'lovgacha **sotuvchi aralashuvisiz** o'tadi.
2. Kunlik limit oshib ketmaydi — to'lgan sana ro'yxatda ko'rinmaydi.
3. Har buyurtma admin guruhda 5 soniya ichida paydo bo'ladi.
4. Admin holatni o'zgartirsa, mijoz xabar oladi.
5. Ertalab soat 08:00 da kunlik reja keladi.
6. Katalogni admin Telegram orqali o'zgartira oladi, dasturchi kerak emas.
7. Ikkinchi do'kon kod o'zgartirmasdan, faqat baza yozuvi bilan ulanadi.
8. Do'kon narxni o'zgartirsa, eski buyurtmalar summasi o'zgarmaydi.

---

## 15. Claude Code bilan ishlash bo'yicha tavsiyalar

- Bu PRD'ni loyiha ildizidagi `docs/PRD.md` ga qo'ying va `CLAUDE.md` faylida unga havola bering.
- `CLAUDE.md` ga majburiy qoidalarni yozing: har so'rov `shop_id` bilan, matnlar `texts/uz.ts` da, pul butun sonda, `float` yo'q.
- Sprintlarni alohida sessiyalarda bajaring. Bitta sessiyada butun botni yozdirmang — kontekst yetmaydi va sifat tushadi.
- Har sprintdan keyin `slot` mantiqiga test yozdiring. Bu eng ko'p xato chiqadigan joy.
- Baza sxemasini birinchi navbatda qotiring — keyin o'zgartirish qimmatga tushadi.

---

## 16. Ochiq savollar

1. To'lov: birinchi pilotda chek-skrinshot varianti yetarlimi, yoki darhol Payme integratsiyasi kerakmi?
2. Til: faqat o'zbekcha (lotin) MVP uchun yetarlimi, yoki rus tili ham birinchi versiyadanmi?
3. Yetkazish narxi: fiksirlangan summami yoki masofaga qarabmi? Ikkinchisi Yandex/2GIS API talab qiladi.
4. Do'kon botlarining tokenlarini kim yaratadi — siz ularning nomidan yaratasizmi yoki egasi o'zi BotFather'dan olib beradimi? (Ishonch va bog'liqlik masalasi.)
