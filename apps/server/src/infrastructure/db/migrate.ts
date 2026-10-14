import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { RACE_TEXTS } from '../seed/race-texts.js';
import type { Database } from './client.js';
import { texts } from './schema.js';

/** Carpeta `apps/server/drizzle` (válido desde `src/` con tsx y desde `dist/`). */
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../drizzle', import.meta.url));

/** Clave arbitraria del advisory lock que serializa migraciones concurrentes. */
const MIGRATION_LOCK_KEY = 727_272;

/**
 * Aplica las migraciones pendientes y el seed de textos de forma segura:
 * un advisory lock evita que dos instancias migren a la vez, y el seed es
 * idempotente (no duplica textos existentes).
 *
 * Requiere una conexión dedicada (`createDatabase(url, { maxConnections: 1 })`)
 * para que el lock y el unlock ocurran en la misma sesión de Postgres.
 */
export async function migrateAndSeed(db: Database): Promise<{ insertedTexts: number }> {
  await db.execute(sql`select pg_advisory_lock(${MIGRATION_LOCK_KEY})`);
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    const inserted = await db
      .insert(texts)
      .values(RACE_TEXTS.map((content) => ({ content })))
      .onConflictDoNothing({ target: texts.content })
      .returning({ id: texts.id });
    return { insertedTexts: inserted.length };
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${MIGRATION_LOCK_KEY})`);
  }
}
