import { rmSync } from 'node:fs';

// Lokal PGlite bazasini butunlay o'chiradi. Serverdagi Postgres'ga ta'sir qilmaydi.
rmSync('data', { recursive: true, force: true });
console.log('Lokal baza o\'chirildi (./data)');
