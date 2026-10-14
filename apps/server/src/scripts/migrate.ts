/**
 * Aplica migraciones y seed. En la imagen Docker se ejecuta al arrancar, antes
 * del servidor (ver `apps/server/Dockerfile`); en local con `pnpm db:migrate`.
 */
import { loadEnv } from '../config/env.js';
import { createDatabase } from '../infrastructure/db/client.js';
import { migrateAndSeed } from '../infrastructure/db/migrate.js';
import { createLogger } from '../infrastructure/logger.js';

const env = loadEnv();
const logger = createLogger(env);

if (!env.DATABASE_URL) {
  logger.error({}, 'DATABASE_URL no está definida');
  process.exit(1);
}

const connection = createDatabase(env.DATABASE_URL, { maxConnections: 1 });
try {
  const { insertedTexts } = await migrateAndSeed(connection.db);
  logger.info({ insertedTexts }, 'Migraciones y seed aplicados');
} catch (error) {
  logger.error({ err: error }, 'Fallo al migrar la base de datos');
  process.exitCode = 1;
} finally {
  await connection.close();
}
