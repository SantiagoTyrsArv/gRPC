/**
 * Modelo de la sala en el cliente. Es independiente de Protobuf: los
 * componentes trabajan con estos tipos y el mapeo vive en `api/mappers.ts`.
 */

export type RoomStatus = 'WAITING' | 'COUNTDOWN' | 'RACING' | 'FINISHED';

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
}

export interface Progress {
  playerId: string;
  typedCorrect: number;
  errors: number;
  percent: number;
  wpm: number;
  finished: boolean;
}

export interface PlayerResult {
  playerId: string;
  nickname: string;
  position: number;
  wpm: number;
  accuracy: number;
  elapsedMs: number;
  finished: boolean;
}

export interface RaceInfo {
  id: string;
  text: string;
  /** ms epoch en el reloj del servidor. */
  startAt: number;
  deadlineAt: number;
}

export interface Room {
  code: string;
  status: RoomStatus;
  maxPlayers: number;
  players: Player[];
  race: RaceInfo | null;
  /** Avance por id de jugador. */
  progress: Record<string, Progress>;
  results: PlayerResult[];
}

export type RoomEvent =
  | { type: 'snapshot'; room: Room }
  | { type: 'playerJoined'; player: Player }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerReadyChanged'; playerId: string; ready: boolean }
  | { type: 'playerConnectionChanged'; playerId: string; connected: boolean }
  | { type: 'hostChanged'; newHostId: string }
  | { type: 'countdownStarted'; race: RaceInfo }
  | { type: 'raceStarted'; raceId: string }
  | { type: 'progressUpdated'; progress: Progress }
  | { type: 'playerFinished'; result: PlayerResult }
  | { type: 'raceFinished'; raceId: string; results: PlayerResult[] }
  | { type: 'heartbeat' };

/** Evento recibido junto con la hora del servidor (para sincronizar relojes). */
export interface TimedRoomEvent {
  event: RoomEvent;
  serverTime: number;
}

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  playerToken: string;
  nickname: string;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  wpm: number;
  accuracy: number;
  achievedAt: Date;
}
