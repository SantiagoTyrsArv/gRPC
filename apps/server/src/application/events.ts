import type {
  PlayerProgressView,
  PlayerResultView,
  PlayerView,
  RaceSetup,
  RoomView,
} from '../domain/types.js';

/**
 * Eventos que se publican en el bus de cada sala y alimentan los streams
 * `WatchRoom`. La capa de transporte los traduce a `WatchRoomResponse`.
 */
export type RoomEvent =
  | { type: 'snapshot'; room: RoomView }
  | { type: 'playerJoined'; player: PlayerView }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerReadyChanged'; playerId: string; ready: boolean }
  | { type: 'playerConnectionChanged'; playerId: string; connected: boolean }
  | { type: 'hostChanged'; newHostId: string }
  | { type: 'countdownStarted'; race: RaceSetup }
  | { type: 'raceStarted'; raceId: string }
  | { type: 'progressUpdated'; progress: PlayerProgressView }
  | { type: 'playerFinished'; result: PlayerResultView }
  | { type: 'raceFinished'; raceId: string; results: PlayerResultView[] };

export type RoomEventType = RoomEvent['type'];
