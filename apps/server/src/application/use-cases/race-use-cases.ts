import type { PlayerProgressView } from '../../domain/types.js';
import type { AppDeps } from '../deps.js';
import type { LeaderboardEntry } from '../ports/race-result-repository.js';
import type { RaceLifecycle, SubmitProgressInput } from '../race-lifecycle.js';
import type { SessionResolver } from '../session-resolver.js';

export class StartRace {
  constructor(
    private readonly lifecycle: RaceLifecycle,
    private readonly sessions: SessionResolver,
  ) {}

  async execute(token: string | undefined): Promise<{ raceId: string }> {
    const { room, player } = await this.sessions.resolve(token);
    const raceId = await this.lifecycle.startRace(room, player.id);
    return { raceId };
  }
}

export class SubmitProgress {
  constructor(
    private readonly lifecycle: RaceLifecycle,
    private readonly sessions: SessionResolver,
  ) {}

  async execute(
    token: string | undefined,
    input: SubmitProgressInput,
  ): Promise<PlayerProgressView> {
    const { room, player } = await this.sessions.resolve(token);
    return this.lifecycle.submitProgress(room, player.id, input);
  }
}

export const LEADERBOARD_DEFAULT_LIMIT = 20;
export const LEADERBOARD_MAX_LIMIT = 50;

export class GetLeaderboard {
  constructor(private readonly deps: Pick<AppDeps, 'results'>) {}

  async execute(input: { limit?: number }): Promise<LeaderboardEntry[]> {
    const requested = input.limit ?? 0;
    const limit =
      requested <= 0 ? LEADERBOARD_DEFAULT_LIMIT : Math.min(requested, LEADERBOARD_MAX_LIMIT);
    return this.deps.results.topByWpm(limit);
  }
}

/** Elimina las salas sin actividad durante más de `inactiveRoomTtlMs`. */
export class CleanupInactiveRooms {
  constructor(
    private readonly deps: Pick<AppDeps, 'rooms' | 'clock' | 'rules' | 'logger'>,
    private readonly lifecycle: RaceLifecycle,
  ) {}

  async execute(): Promise<number> {
    const threshold = this.deps.clock.now() - this.deps.rules.inactiveRoomTtlMs;
    const stale = (await this.deps.rooms.listAll()).filter((r) => r.lastActivityAt < threshold);
    for (const room of stale) await this.lifecycle.disposeRoom(room.code);
    if (stale.length > 0) {
      this.deps.logger.info({ count: stale.length }, 'Salas inactivas eliminadas');
    }
    return stale.length;
  }
}
