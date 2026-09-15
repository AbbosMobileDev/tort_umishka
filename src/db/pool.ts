import { config, log } from '../config.js';

export type Row = Record<string, any>;

export interface Conn {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Database extends Conn {
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Conn) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'pglite' | 'postgres';
}

let db: Database | null = null;

/**
 * DATABASE_URL bo'lsa — haqiqiy Postgres (Neon/Supabase/VPS).
 * Bo'lmasa — PGlite: o'sha Postgres, lekin fayl sifatida, o'rnatishsiz.
 * Ikkalasi ham bir xil SQL qabul qiladi, shuning uchun kod o'zgarmaydi.
 */
export async function getDb(): Promise<Database> {
  if (db) return db;

  // Test va CLI skriptlar env ni import'dan keyin o'zgartirishi mumkin — shuning uchun
  // qiymatlar chaqiruv paytida o'qiladi.
  const databaseUrl = process.env.DATABASE_URL || config.databaseUrl;
  const localDbPath = process.env.LOCAL_DB_PATH || config.localDbPath;

  if (databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    db = {
      kind: 'postgres',
      async query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
        const res = await pool.query(sql, params as any[]);
        return res.rows as T[];
      },
      async exec(sql: string) {
        await pool.query(sql);
      },
      async transaction<T>(fn: (tx: Conn) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const tx: Conn = {
            async query<R = Row>(sql: string, params: unknown[] = []) {
              const r = await client.query(sql, params as any[]);
              return r.rows as R[];
            },
          };
          const out = await fn(tx);
          await client.query('COMMIT');
          return out;
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      },
      async close() {
        await pool.end();
      },
    };
    log.info('Baza: Postgres (DATABASE_URL)');
    return db;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  if (!localDbPath.startsWith('memory://')) {
    const { mkdirSync } = await import('node:fs');
    mkdirSync(localDbPath, { recursive: true });
  }
  const pglite = new PGlite(localDbPath);
  await pglite.waitReady;
  db = {
    kind: 'pglite',
    async query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
      const res = await pglite.query(sql, params as any[]);
      return res.rows as T[];
    },
    async exec(sql: string) {
      await pglite.exec(sql);
    },
    async transaction<T>(fn: (tx: Conn) => Promise<T>): Promise<T> {
      return pglite.transaction(async (t) => {
        const tx: Conn = {
          async query<R = Row>(sql: string, params: unknown[] = []) {
            const r = await t.query(sql, params as any[]);
            return r.rows as R[];
          },
        };
        return fn(tx);
      }) as Promise<T>;
    },
    async close() {
      await pglite.close();
    },
  };
  log.info(`Baza: PGlite (${localDbPath})`);
  return db;
}

/** Postgres numeric/bigint qiymatlarini xavfsiz songa aylantirish. */
export function num(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'bigint') return Number(v);
  return Number(String(v));
}
