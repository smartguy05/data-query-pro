import { getAppDb } from './pool';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

export async function runMigrations(): Promise<void> {
  const sql = getAppDb();
  if (!sql) {
    return;
  }

  // Create migrations tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Get already-applied migrations
  const applied = await sql`SELECT name FROM schema_migrations ORDER BY name`;
  const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

  // Read migration files
  const migrationsDir = join(process.cwd(), 'lib', 'db', 'migrations');
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
  } catch {
    console.warn('[migrate] No migrations directory found, skipping');
    return;
  }

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    console.log(`[migrate] Applying ${file}...`);
    const content = readFileSync(join(migrationsDir, file), 'utf-8');

    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });

    console.log(`[migrate] Applied ${file}`);
  }
}
