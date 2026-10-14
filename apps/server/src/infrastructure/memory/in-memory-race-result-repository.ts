import type {
  FinishedRaceRecord,
  LeaderboardEntry,
  RaceResultRepository,
} from '../../application/ports/race-result-repository.js';

/** Resultados en memoria (desarrollo sin base de datos y tests). */
export class InMemoryRaceResultRepository implements RaceResultRepository {
  readonly races: FinishedRaceRecord[] = [];

  saveRace(record: FinishedRaceRecord): Promise<void> {
    this.races.push(record);
    return Promise.resolve();
  }

  topByWpm(limit: number): Promise<LeaderboardEntry[]> {
    const entries = this.races
      .flatMap((race) =>
        race.results
          .filter((r) => r.finished)
          .map((r) => ({
            nickname: r.nickname,
            wpm: r.wpm,
            accuracy: r.accuracy,
            achievedAt: race.finishedAt,
          })),
      )
      .sort((a, b) => b.wpm - a.wpm || a.achievedAt - b.achievedAt)
      .slice(0, limit)
      .map((entry, index) => ({ rank: index + 1, ...entry }));
    return Promise.resolve(entries);
  }
}
