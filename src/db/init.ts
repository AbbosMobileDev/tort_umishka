import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './pool.js';
import { log } from '../config.js';

const here = dirname(fileURLToPath(import.meta.url));

export async function initSchema(): Promise<void> {
  const db = await getDb();
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  await db.exec(sql);
  log.info('Baza sxemasi tayyor');
}
