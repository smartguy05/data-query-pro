import postgres from 'postgres';

let pool: ReturnType<typeof postgres> | null = null;

export function isAppDbEnabled(): boolean {
  return !!process.env.APP_DATABASE_URL;
}

export function getAppDb(): ReturnType<typeof postgres> | null {
  if (!isAppDbEnabled()) {
    return null;
  }

  if (!pool) {
    pool = postgres(process.env.APP_DATABASE_URL!, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }

  return pool;
}
