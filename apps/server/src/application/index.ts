import type { AppDeps } from './deps.js';
import { RaceLifecycle } from './race-lifecycle.js';
import { SessionResolver } from './session-resolver.js';
import {
  CleanupInactiveRooms,
  GetLeaderboard,
  StartRace,
  SubmitProgress,
} from './use-cases/race-use-cases.js';
import {
  CreateRoom,
  JoinRoom,
  LeaveRoom,
  Reconnect,
  SetReady,
} from './use-cases/room-use-cases.js';
import { WatchRoom } from './use-cases/watch-room.js';

/** Construye todos los casos de uso a partir de los puertos (composición). */
export function createApplication(deps: AppDeps) {
  const sessions = new SessionResolver(deps);
  const lifecycle = new RaceLifecycle(deps);
  return {
    sessions,
    createRoom: new CreateRoom(deps),
    joinRoom: new JoinRoom(deps),
    reconnect: new Reconnect(sessions),
    setReady: new SetReady(deps, sessions),
    leaveRoom: new LeaveRoom(lifecycle, sessions),
    watchRoom: new WatchRoom(deps, lifecycle, sessions),
    startRace: new StartRace(lifecycle, sessions),
    submitProgress: new SubmitProgress(lifecycle, sessions),
    getLeaderboard: new GetLeaderboard(deps),
    cleanupInactiveRooms: new CleanupInactiveRooms(deps, lifecycle),
  };
}

export type Application = ReturnType<typeof createApplication>;
export type { AppDeps } from './deps.js';
export type { RoomEvent } from './events.js';
export { DEFAULT_GAME_RULES, type GameRules } from './game-rules.js';
