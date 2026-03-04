export async function register() {
  // Only run migrations on the server side
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.APP_DATABASE_URL) {
    try {
      const { runMigrations } = await import('./lib/db/migrate');
      await runMigrations();
      console.log('[instrumentation] Database migrations complete');
    } catch (error) {
      console.error('[instrumentation] Migration failed:', error);
    }
  }
}
