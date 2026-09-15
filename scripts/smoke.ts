import { listActiveShops, listCategories, listProducts, listProductOptions, upsertCustomer, createOrder, listOrdersByDate, getUsage } from '../src/db/repo.js';
import { initSchema } from '../src/db/init.js';
import { getAvailableDates } from '../src/services/availability.js';
import { calcPrice } from '../src/services/pricing.js';
import { at } from '../src/texts/admin-uz.js';
import { t } from '../src/texts/uz.js';
import { addDays, todayInTz } from '../src/services/dates.js';

await initSchema();
const shop = (await listActiveShops())[0];
const cats = await listCategories(shop.id);
const prods = await listProducts(shop.id, cats[0].id);
const opts = await listProductOptions(shop.id, prods[0].id);
console.log('Kategoriyalar:', cats.map(c=>c.name).join(', '));
console.log('Mahsulotlar:', prods.map(p=>p.name).join(', '));
const missing = [];
for (const c of cats) {
  for (const p of await listProducts(shop.id, c.id)) {
    const fs = await import('node:fs');
    if (!p.photoPath || !fs.existsSync(p.photoPath)) missing.push(p.name);
  }
}
console.log('Rasmi yo\'q mahsulotlar:', missing.length ? missing.join(', ') : 'yo\'q — hammasi joyida');
console.log('Opsiya guruhlari:', [...new Set(opts.map(o=>o.groupName))].join(', '));

const days = await getAvailableDates(shop, 3);
console.log('Bo\'sh sanalar (dastlabki 5):', days.slice(0,5).map(d=>`${d.date}(${d.slotsForRequest})`).join(' '));

const price = calcPrice({ pricePerKg: prods[0].pricePerKg, weightKg: 3,
  options: [{groupName:'Ichlik',optionName:'Qaymoqli',extraPrice:5000,priceType:'per_kg'}],
  hasInscription: true, inscriptionPrice: shop.inscriptionPrice, deliveryFee: shop.deliveryFee, prepaymentPercent: shop.prepaymentPercent });

console.log('\n--- Mijozga ko\'rinadigan hisob ---');
console.log(t.summary({ productName: prods[0].name, weightKg: 3, optionLines: price.optionLines,
  inscription: 'Dilnoza 25 yosh', date: days[0].date, timeSlot: shop.timeSlots[0],
  deliveryType: 'delivery', address: 'Chilonzor 7-kvartal, 12-uy', price }));

const c = await upsertCustomer(shop.id, 999, 'Dilshod');
const order = await createOrder({ shopId: shop.id, customerId: c.id, telegramUserId: 999,
  productSnapshot: { name: prods[0].name, pricePerKg: prods[0].pricePerKg },
  optionsSnapshot: [{groupName:'Ichlik',optionName:'Qaymoqli',price:15000}],
  weightKg: 3, inscriptionText: 'Dilnoza 25 yosh', deliveryType:'delivery',
  addressText:'Chilonzor 7-kvartal, 12-uy', addressNote:'2-podez', lat:null, lng:null,
  pickupDate: days[0].date, pickupTimeSlot: shop.timeSlots[0],
  subtotal: price.subtotal, deliveryFee: price.delivery, total: price.total,
  prepaidAmount: price.prepaid, remainingAmount: price.remaining,
  capacityKg: shop.dailyCapacityKg, capacityOrders: shop.dailyCapacityOrders });

console.log('\n--- Admin guruhga tushadigan xabar ---');
console.log(at.newOrder(order));

console.log('\n--- Ertalabki reja ---');
console.log(at.dailyPlan(days[0].date, await listOrdersByDate(shop.id, days[0].date), 0));

const u = (await getUsage(shop.id, days[0].date, days[0].date)).get(days[0].date);
console.log('\nBand:', u?.usedKg, 'kg,', u?.usedOrders, 'buyurtma');
