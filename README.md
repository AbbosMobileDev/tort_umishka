# tort_umishka

Umidaxonim shirinliklari uchun Telegram buyurtma boti.

Mijoz botdan tort buyurtma qiladi (katalog → vazn → qo'shimchalar → sana va vaqt →
yetkazish → avans to'lov), do'kon egasi esa shaxsiy chatdagi admin panel orqali
buyurtmalarni boshqaradi: holatni o'zgartiradi, katalogni yangilaydi, hisobotni
CSV qilib yuklab oladi.

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
npm test            # 25 ta test
npm run smoke       # Telegramsiz: katalog, narx, buyurtma matnlari
npm run smoke:panel # Telegramsiz: admin panel oqimlari
```

## Hujjatlar

- [docs/PRD.md](docs/PRD.md) — mahsulot talablari
- [docs/DEPLOY.md](docs/DEPLOY.md) — serverga qo'yish (Render + Neon)
- [CLAUDE.md](CLAUDE.md) — kod bo'yicha qoidalar va arxitektura
