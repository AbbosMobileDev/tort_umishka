# tort_umishka

Umidaxonim shirinliklari uchun Telegram buyurtma boti.

Mijoz bot ichidagi ilovada (Telegram Mini App) tort buyurtma qiladi: katalog → vazn →
qo'shimchalar → sana va vaqt → yetkazish → avans to'lov. Do'kon egasi esa shaxsiy
chatdagi admin panel orqali buyurtmalarni boshqaradi: holatni o'zgartiradi, katalogni
yangilaydi, hisobotni CSV qilib yuklab oladi.

Mini App bot bilan bir xil servisdan beriladi (`public/` + `/api/*`) — alohida hosting
kerak emas. Manzil HTTPS bo'lmasa (masalan lokal `http://localhost`), bot avtomatik
eski bosqichma-bosqich oqimga tushadi.

## Ishga tushirish

```bash
npm install
cp .env.example .env   # BOT_TOKEN va ADMIN_USER_ID ni to'ldiring
npm run seed           # namunaviy katalog
npm run dev
```

Baza uchun hech narsa o'rnatish shart emas: `DATABASE_URL` bo'sh bo'lsa lokal
PGlite ishlatiladi. Serverda o'sha o'zgaruvchiga Neon/Supabase satri qo'yiladi.

## Tekshirish

```bash
npm run typecheck
npm test            # 40 ta test
npm run smoke       # Telegramsiz: katalog, narx, buyurtma matnlari
npm run smoke:panel # Telegramsiz: admin panel oqimlari
npm run dev:app     # Mini App ni brauzerda ochish (http://localhost:3000), bot ishga tushmaydi
```

## Hujjatlar

- [docs/PRD.md](docs/PRD.md) — mahsulot talablari
- [docs/DEPLOY.md](docs/DEPLOY.md) — serverga qo'yish (Render + Neon)
- [CLAUDE.md](CLAUDE.md) — kod bo'yicha qoidalar va arxitektura
