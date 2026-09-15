# Serverga qo'yish (tekin) — Render + Neon

Maqsad: bot doim onlayn tursin, do'kon egasi istalgan vaqtda ochib ko'rsin.
Ikkala xizmat ham tekin, karta so'ramaydi.

| Nima | Qayerda | Nega |
|---|---|---|
| Baza (Postgres) | [neon.tech](https://neon.tech) | Render diski vaqtinchalik — buyurtmalar o'chib ketmasligi uchun baza alohida turadi |
| Bot serveri | [render.com](https://render.com) | GitHub'dan avtomatik deploy |

---

## 1. Neon — baza

1. [neon.tech](https://neon.tech) → **Sign up with GitHub**.
2. **Create project** → nomi: `tortbot`, region: **Europe (Frankfurt)**.
3. Ochilgan sahifada **Connection string** ni nusxalang. Shunday ko'rinadi:

   ```
   postgresql://neondb_owner:XXXX@ep-xxx-123.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

   Shu satrni saqlab qo'ying — 2-bosqichda kerak. **Hech kimga bermang.**

Jadvallar va namunaviy katalogni qo'lda yaratish shart emas: bot birinchi
ishga tushganda bo'sh bazani ko'rib, sxema va katalogni o'zi yaratadi.

---

## 2. Render — bot serveri

1. [render.com](https://render.com) → **Sign up with GitHub**.
2. **New** → **Web Service** → `AbbosMobileDev/umi_cakes` repozitoriysini tanlang.
3. Sozlamalar (repodagi `render.yaml` tufayli ko'pi o'zi to'ladi):
   - **Region:** Frankfurt
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Instance type:** **Free**
4. **Environment Variables** — quyidagilarni qo'shing:

   | Key | Value |
   |---|---|
   | `BOT_TOKEN` | BotFather bergan token |
   | `DATABASE_URL` | Neon'dan olingan connection string |
   | `ADMIN_USER_ID` | Sizning Telegram ID ingiz (botga `/id`) |
   | `ADMIN_GROUP_ID` | Guruh ID si (manfiy son) |
   | `BOT_MODE` | `webhook` |
   | `WEBHOOK_URL` | Servis manzili, masalan `https://tortbot.onrender.com` |
   | `TZ` | `Asia/Tashkent` |

   `WEBHOOK_URL` ni Render servis nomini bergandan keyin bilasiz. Avval bo'sh
   qoldiring: bot yiqilmaydi, vaqtincha polling rejimida ishlab turadi va log'da
   `WEBHOOK_URL hali qo'yilmagan` deb ogohlantiradi. Manzil paydo bo'lgach uni
   qo'shing — qayta deploy'dan keyin webhook'ka o'tadi.

5. **Create Web Service** → 2-3 daqiqa kutasiz.

Log'da shular chiqsa — tayyor:

```
INFO Baza: Postgres (DATABASE_URL)
INFO Baza bo'sh — namunaviy katalog yaratilmoqda...
INFO ✅ "Umidaxonim shirinliklari" yaratildi (shop_id 1)
INFO HTTP server: 10000, webhook path: /webhook/1
INFO Webhook o'rnatildi
```

---

## 3. Uyqu muammosi va yechimi

Render'ning tekin plani **15 daqiqa jimlikdan keyin servisni uxlatadi**. Uyqudan
keyingi birinchi xabar ~40 soniya kechikadi — do'kon egasiga ko'rsatayotganda
bu yoqimsiz.

Yechim — tekin "pinger" har 10 daqiqada servisni turtib turadi:

1. [cron-job.org](https://cron-job.org) → ro'yxatdan o'ting.
2. **Create cronjob**:
   - URL: `https://tortbot.onrender.com/` (o'z manzilingiz)
   - Interval: **har 10 daqiqada**
3. Saqlang.

Bot `/` manziliga `ok` deb javob beradi (health check), shuning uchun ping
yetarli.

> Eslatma: tekin plan oyiga 750 soat beradi — bitta servis uchun 24/7 yetadi.

---

## 4. Muhim: ikki joyda bir vaqtda ishlamasin

Bitta bot tokeni bilan **ham lokal (polling), ham serverda (webhook)** ishlatib
bo'lmaydi — Telegram xato beradi va xabarlar yo'qoladi.

- Serverga qo'yganingizdan keyin lokal `npm run dev` ni **to'xtating** (Ctrl+C).
- Lokalda yana test qilmoqchi bo'lsangiz: Render'da servisni **Suspend** qiling,
  keyin lokal ishga tushiring (polling rejimi webhook'ni o'zi o'chiradi).
- Eng toza yo'l: BotFather'dan **ikkinchi test bot** oling va lokalda o'shani
  ishlating. U holda ikkalasi xalaqit bermaydi.

---

## 5. Keyin nima qilinadi

Namunaviy katalog (15 mahsulot, chizilgan rasmlar) — faqat ko'rsatish uchun.
Do'kon egasi roziligidan keyin, panel orqali:

- 🍰 Katalog → keraksiz mahsulotlarni o'chiring, o'z tortlarini qo'shing
- Har mahsulotga **o'z rasmini** yuklang (chizilgan rasmlar o'rniga)
- ⚙️ Sozlamalar → kunlik limitni haqiqiy quvvatga moslang
- Karta raqami va telefon — hozir namunaviy (`src/db/seed.ts`), bazada
  yangilanadi

---

## Nosozliklar

| Belgi | Sabab | Yechim |
|---|---|---|
| Bot javob bermaydi | Servis uxlab qolgan | Pinger qo'ying (3-bo'lim) |
| Log'da `401` | Token noto'g'ri | `BOT_TOKEN` ni qayta nusxalang |
| Log'da `409 Conflict` | Lokal polling ham ishlayapti | Lokalni to'xtating (4-bo'lim) |
| Buyurtmalar yo'qoldi | `DATABASE_URL` qo'yilmagan | Neon'siz baza vaqtinchalik — o'zgaruvchini qo'shing |
| Rasm chiqmayapti | `assets/` deploy'ga tushmagan | Repoda `assets/products/*.png` borligini tekshiring |
