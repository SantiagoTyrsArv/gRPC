import type { PlayerResultView } from '../../domain/types.js';

export interface FinishedRaceRecord {
  raceId: string;
  roomCode: string;
  textId: string;
  startedAt: number;
  finishedAt: number;
  results: PlayerResultView[];
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  wpm: number;
  accuracy: number;
  achievedAt: number;
}

export interface RaceResultRepository {
  saveRace(record: FinishedRaceRecord): Promise<void>;
  /** Mejores resultados completados, ordenados por WPM descendente. */
  topByWpm(limit: number): Promise<LeaderboardEntry[]>;
}
