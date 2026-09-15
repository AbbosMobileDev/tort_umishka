import { pathToFileURL } from 'node:url';
import { config, log } from '../config.js';
import { initSchema } from './init.js';
import { getDb, num } from './pool.js';

/**
 * NAMUNAVIY KATALOG — test uchun.
 * Nomlar, narxlar va rasmlar vaqtinchalik. Do'kon egasi keyin Telegramdagi /menu orqali
 * narxlarni o'zgartiradi, rasmlar esa o'z suratlariga almashtiriladi.
 * Rasmlar assets/products/ dan yuklanadi (scripts/generate_images.py chizgan).
 */
const SHOP = {
  name: 'Umidaxonim shirinliklari',
  contactPhone: '+998 90 123 45 67', // namuna
  paymentCard: '8600 1234 5678 9012', // namuna
  paymentCardHolder: 'UMIDA X.', // namuna
};

const CAKE_WEIGHTS = '{1,1.5,2,2.5,3,4,5}';
const BIG_WEIGHTS = '{3,4,5,6,8,10}';
const SMALL_WEIGHTS = '{0.5,1,1.5,2}';

/** Tortlar uchun umumiy variantlar. */
const CAKE_OPTIONS = [
  { group: 'Ichlik', name: 'Klassik', price: 0, type: 'fixed' },
  { group: 'Ichlik', name: 'Qaymoqli', price: 5_000, type: 'per_kg' },
  { group: 'Ichlik', name: 'Shokoladli', price: 7_000, type: 'per_kg' },
  { group: 'Ichlik', name: 'Mevali', price: 10_000, type: 'per_kg' },
  { group: 'Ichlik', name: 'Pista kremi', price: 15_000, type: 'per_kg' },
  { group: 'Bezak', name: 'Oddiy bezak', price: 0, type: 'fixed' },
  { group: 'Bezak', name: 'Mevalar bilan', price: 20_000, type: 'fixed' },
  { group: 'Bezak', name: 'Shokolad naqsh', price: 25_000, type: 'fixed' },
  { group: 'Bezak', name: 'Mastika bezak', price: 45_000, type: 'fixed' },
];

interface SeedProduct {
  name: string;
  description: string;
  price: number;
  photo: string;
  min: number;
  max: number;
  weights: string;
}

const CATALOG: { category: string; options: typeof CAKE_OPTIONS; products: SeedProduct[] }[] = [
  {
    category: 'Tortlar',
    options: CAKE_OPTIONS,
    products: [
      { name: 'Napoleon', description: 'Yupqa qatlamlar, klassik krem', price: 85_000, photo: 'napoleon.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
      { name: 'Medovik', description: 'Asalli qatlamlar, smetana krem', price: 90_000, photo: 'medovik.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
      { name: 'Shokoladli tort', description: 'Quyuq shokoladli biskvit va ganash', price: 95_000, photo: 'shokoladli.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
      { name: 'Chizkeyk', description: 'Tvorog asosli, rezavor mevalar bilan', price: 130_000, photo: 'chizkeyk.png', min: 1, max: 5, weights: CAKE_WEIGHTS },
      { name: 'Qizil barxat', description: 'Qizil biskvit, krem-chiz kremi', price: 115_000, photo: 'qizil-barxat.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
      { name: 'Praga', description: 'Achchiq shokolad va o\'rik jemi', price: 100_000, photo: 'praga.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
      { name: 'Yogurtli mevali', description: 'Yengil yogurt krem, mavsumiy mevalar', price: 105_000, photo: 'yogurtli.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
      { name: 'Bolalar torti', description: 'Rangli bezak, multfilm mavzusida', price: 110_000, photo: 'bolalar.png', min: 1, max: 8, weights: CAKE_WEIGHTS },
    ],
  },
  {
    category: 'Bayram tortlari',
    options: CAKE_OPTIONS,
    products: [
      { name: 'Nikoh torti', description: 'Ko\'p qavatli, oq mastika bezak', price: 180_000, photo: 'nikoh.png', min: 3, max: 15, weights: BIG_WEIGHTS },
      { name: 'Tug\'ilgan kun torti', description: 'Shamlar va yozuv bilan', price: 120_000, photo: 'tugilgan-kun.png', min: 1, max: 10, weights: CAKE_WEIGHTS },
      { name: 'Raqamli tort', description: 'Yosh raqami shaklida, kremli bezak', price: 135_000, photo: 'raqamli.png', min: 1, max: 10, weights: CAKE_WEIGHTS },
    ],
  },
  {
    category: 'Shirinliklar',
    options: [],
    products: [
      { name: 'Eklerlar', description: 'Krem to\'ldirilgan, shokolad glazur', price: 80_000, photo: 'eklerlar.png', min: 0.5, max: 5, weights: SMALL_WEIGHTS },
      { name: 'Makaron', description: 'Rangli fransuz pechenyesi, 6 xil ta\'m', price: 160_000, photo: 'makaron.png', min: 0.5, max: 3, weights: SMALL_WEIGHTS },
      { name: 'Kapkeyk', description: 'Kremli mini tortchalar', price: 95_000, photo: 'kapkeyk.png', min: 0.5, max: 5, weights: SMALL_WEIGHTS },
      { name: 'Chak-chak', description: 'An\'anaviy asalli shirinlik', price: 70_000, photo: 'chak-chak.png', min: 0.5, max: 5, weights: SMALL_WEIGHTS },
    ],
  },
];

/**
 * Katalogni yaratadi. CLI dan chaqirilganda baza ulanishi yopiladi; server ichidan
 * (bo'sh bazada avtomatik) chaqirilganda esa ochiq qoladi — bot o'sha ulanishda ishlaydi.
 */
export async function runSeed({ closeDb = true }: { closeDb?: boolean } = {}): Promise<void> {
  await initSchema();
  const db = await getDb();

  const existing = await db.query(`SELECT id, name FROM shops LIMIT 1`);
  if (existing.length) {
    log.info(`Do'kon allaqachon bor: ${existing[0].name} (id ${num(existing[0].id)}).`);
    log.info('Katalogni qaytadan yuklash uchun: npm run reseed');
    if (closeDb) await db.close();
    return;
  }

  const shopRows = await db.query(
    `INSERT INTO shops (name, admin_group_id, admin_user_ids, timezone,
                        contact_phone, payment_card, payment_card_holder)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      SHOP.name,
      config.adminGroupId,
      config.adminUserId ? [config.adminUserId] : [],
      config.timezone,
      SHOP.contactPhone,
      SHOP.paymentCard,
      SHOP.paymentCardHolder,
    ],
  );
  const shopId = num(shopRows[0].id);

  let catOrder = 0;
  let productCount = 0;
  for (const block of CATALOG) {
    const catRows = await db.query(
      `INSERT INTO categories (shop_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
      [shopId, block.category, catOrder++],
    );
    const categoryId = num(catRows[0].id);

    let prodOrder = 0;
    for (const p of block.products) {
      const prodRows = await db.query(
        `INSERT INTO products (shop_id, category_id, name, description, photo_path,
                               price_per_kg, min_kg, max_kg, weight_options, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::numeric[],$10) RETURNING id`,
        [
          shopId,
          categoryId,
          p.name,
          p.description,
          `assets/products/${p.photo}`,
          p.price,
          p.min,
          p.max,
          p.weights,
          prodOrder++,
        ],
      );
      productCount++;

      let optOrder = 0;
      for (const o of block.options) {
        await db.query(
          `INSERT INTO product_options
             (shop_id, product_id, group_name, option_name, extra_price, price_type, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [shopId, num(prodRows[0].id), o.group, o.name, o.price, o.type, optOrder++],
        );
      }
    }
  }

  log.info(`✅ "${SHOP.name}" yaratildi (shop_id ${shopId})`);
  log.info(`   ${CATALOG.length} kategoriya, ${productCount} mahsulot, rasmlar bilan`);
  log.info('   Karta raqami va telefon — namunaviy, keyin o\'zgartiring');
  log.info('Endi: npm run dev');
  if (closeDb) await db.close();
}

// Faqat to'g'ridan-to'g'ri ishga tushirilganda (npm run seed). Import qilinganda emas.
const isCli = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  runSeed().catch((e) => {
    log.error('Seed xatosi', e);
    process.exit(1);
  });
}
