import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase, type DatabaseConnection } from '../../src/infrastructure/db/client.js';
import {
  DrizzleRaceResultRepository,
  DrizzleTextRepository,
} from '../../src/infrastructure/db/drizzle-repositories.js';
import { migrateAndSeed } from '../../src/infrastructure/db/migrate.js';
import { RACE_TEXTS } from '../../src/infrastructure/seed/race-texts.js';

/** Base de datos desechable: el test borra y recrea el esquema. Nunca uses la de desarrollo. */
const url = process.env.TEST_DATABASE_URL;

/**
 * Requiere Postgres real (`pnpm db:up` en local, servicio en CI). Se omite si
 * no hay `TEST_DATABASE_URL`.
 */
describe.skipIf(!url)('repositorios Drizzle (Postgres)', () => {
  let connection: DatabaseConnection;

  beforeAll(async () => {
    connection = createDatabase(url!, { maxConnections: 1 });
    await connection.db.execute(sql`drop schema if exists public cascade`);
    await connection.db.execute(sql`drop schema if exists drizzle cascade`);
    await connection.db.execute(sql`create schema public`);
    await migrateAndSeed(connection.db);
  });

  afterAll(async () => {
    await connection.close();
  });

  it('las migraciones y el seed son idempotentes', async () => {
    expect(await migrateAndSeed(connection.db)).toEqual({ insertedTexts: 0 });
    expect(await connection.ping()).toBe(true);
  });

  it('elige textos del seed evitando repetir el anterior', async () => {
    const repo = new DrizzleTextRepository(connection.db, () => 0);
    const first = await repo.pickRandom();
    expect(RACE_TEXTS).toContain(first.content);
    const second = await repo.pickRandom(first.id);
    expect(second.id).not.toBe(first.id);
  });

  it('guarda carreras y construye el ranking con resultados completados', async () => {
    const texts = new DrizzleTextRepository(connection.db);
    const results = new DrizzleRaceResultRepository(connection.db);
    const text = await texts.pickRandom();
    const result = (nickname: string, wpm: number, finished: boolean, position: number) => ({
      playerId: randomUUID(),
      nickname,
      position,
      wpm,
      accuracy: 0.95,
      elapsedMs: finished ? 30_000 : 0,
      finished,
    });

    await results.saveRace({
      raceId: randomUUID(),
      roomCode: 'ABCDEF',
      textId: text.id,
      startedAt: Date.now() - 60_000,
      finishedAt: Date.now() - 1_000,
      results: [result('Ana', 80, true, 1), result('Beto', 300, false, 2)],
    });
    await results.saveRace({
      raceId: randomUUID(),
      roomCode: 'GHJKLM',
      textId: text.id,
      startedAt: Date.now() - 30_000,
      finishedAt: Date.now(),
      results: [result('Caro', 95.5, true, 1)],
    });

    const top = await results.topByWpm(10);
    expect(top.map((e) => [e.rank, e.nickname, e.wpm])).toEqual([
      [1, 'Caro', 95.5],
      [2, 'Ana', 80],
    ]);
    expect(await results.topByWpm(1)).toHaveLength(1);
  });
});
