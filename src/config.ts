import 'dotenv/config';

export const config = {
  botToken: process.env.BOT_TOKEN ?? '',
  adminUserId: process.env.ADMIN_USER_ID ? Number(process.env.ADMIN_USER_ID) : null,
  adminGroupId: process.env.ADMIN_GROUP_ID ? Number(process.env.ADMIN_GROUP_ID) : null,
  databaseUrl: process.env.DATABASE_URL || '',
  localDbPath: process.env.LOCAL_DB_PATH || './data/pgdata',
  mode: (process.env.BOT_MODE || 'polling') as 'polling' | 'webhook',
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: Number(process.env.PORT || 3000),
  timezone: process.env.TZ || 'Asia/Tashkent',
};

const levels: Record<string, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const current = levels[process.env.LOG_LEVEL || 'info'] ?? 20;

function emit(level: string, msg: string, extra?: unknown) {
  if ((levels[level] ?? 20) < current) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase()} ${msg}`;
  if (extra !== undefined) console.log(line, extra);
  else console.log(line);
}

export const log = {
  debug: (m: string, e?: unknown) => emit('debug', m, e),
  info: (m: string, e?: unknown) => emit('info', m, e),
  warn: (m: string, e?: unknown) => emit('warn', m, e),
  error: (m: string, e?: unknown) => emit('error', m, e),
};
