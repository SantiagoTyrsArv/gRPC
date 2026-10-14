import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  /** Comprueba la conectividad (healthcheck). */
  ping: () => Promise<boolean>;
  close: () => Promise<void>;
}

/** `maxConnections: 1` es obligatorio para migrar (el advisory lock es por conexión). */
export function createDatabase(url: string, { maxConnections = 10 } = {}): DatabaseConnection {
  const client = postgres(url, {
    max: maxConnections,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  const db = drizzle({ client, schema });
  return {
    db,
    ping: async () => {
      try {
        await db.execute(sql`select 1`);
        return true;
      } catch {
        return false;
      }
    },
    close: () => client.end({ timeout: 5 }),
  };
}
