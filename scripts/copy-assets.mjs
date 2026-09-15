import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('dist/src/db', { recursive: true });
copyFileSync('src/db/schema.sql', 'dist/src/db/schema.sql');
console.log('schema.sql → dist/src/db/');
