import { asc, desc, eq } from 'drizzle-orm';
import type {
  FinishedRaceRecord,
  LeaderboardEntry,
  RaceResultRepository,
} from '../../application/ports/race-result-repository.js';
import type { TextRepository } from '../../application/ports/text-repository.js';
import type { RaceText } from '../../domain/types.js';
import type { Database } from './client.js';
import { raceResults, races, texts } from './schema.js';

/**
 * Textos desde Postgres. Como son estáticos, se cargan una vez y se cachean en
 * memoria; así elegir un texto no cuesta una consulta por carrera.
 */
export class DrizzleTextRepository implements TextRepository {
  private cache: RaceText[] | null = null;

  constructor(
    private readonly db: Database,
    private readonly random: () => number = Math.random,
  ) {}

  async pickRandom(excludeId?: string): Promise<RaceText> {
    const all = await this.load();
    const candidates = all.length > 1 ? all.filter((t) => t.id !== excludeId) : all;
    const text = candidates[Math.floor(this.random() * candidates.length)];
    if (!text) throw new Error('No hay textos en la base de datos; ejecuta el seed');
    return text;
  }

  private async load(): Promise<RaceText[]> {
    if (!this.cache) {
      const rows = await this.db.select({ id: texts.id, content: texts.content }).from(texts);
      this.cache = rows.map((row) => ({ id: String(row.id), content: row.content }));
    }
    return this.cache;
  }
}

export class DrizzleRaceResultRepository implements RaceResultRepository {
  constructor(private readonly db: Database) {}

  async saveRace(record: FinishedRaceRecord): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(races).values({
        id: record.raceId,
        roomCode: record.roomCode,
        textId: Number(record.textId),
        startedAt: new Date(record.startedAt),
        finishedAt: new Date(record.finishedAt),
      });
      if (record.results.length === 0) return;
      await tx.insert(raceResults).values(
        record.results.map((r) => ({
          raceId: record.raceId,
          playerId: r.playerId,
          nickname: r.nickname,
          position: r.position,
          wpm: r.wpm,
          accuracy: r.accuracy,
          elapsedMs: r.elapsedMs,
          finished: r.finished,
        })),
      );
    });
  }

  async topByWpm(limit: number): Promise<LeaderboardEntry[]> {
    const rows = await this.db
      .select({
        nickname: raceResults.nickname,
        wpm: raceResults.wpm,
        accuracy: raceResults.accuracy,
        achievedAt: races.finishedAt,
      })
      .from(raceResults)
      .innerJoin(races, eq(raceResults.raceId, races.id))
      .where(eq(raceResults.finished, true))
      .orderBy(desc(raceResults.wpm), asc(races.finishedAt))
      .limit(limit);

    return rows.map((row, index) => ({
      rank: index + 1,
      nickname: row.nickname,
      wpm: row.wpm,
      accuracy: row.accuracy,
      achievedAt: row.achievedAt.getTime(),
    }));
  }
}
