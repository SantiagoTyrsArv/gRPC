/**
 * Tipos de solo lectura que el dominio expone hacia afuera (vistas). Son
 * estructuras planas e independientes de Protobuf: el mapeo a mensajes proto
 * vive en la capa de transporte.
 */

export type RoomStatus = 'WAITING' | 'COUNTDOWN' | 'RACING' | 'FINISHED';

export interface RaceText {
  id: string;
  content: string;
}

export interface RaceSetup {
  id: string;
  text: RaceText;
  /** Inicio de la carrera (ms epoch, reloj del servidor). */
  startAt: number;
  /** Límite de tiempo de la carrera (ms epoch). */
  deadlineAt: number;
}

export interface PlayerView {
  id: string;
  nickname: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
}

export interface PlayerProgressView {
  playerId: string;
  typedCorrect: number;
  percent: number;
  wpm: number;
  finished: boolean;
}

export interface PlayerResultView {
  playerId: string;
  nickname: string;
  /** 1 = primero. Quienes no terminan se ordenan después, por avance. */
  position: number;
  wpm: number;
  accuracy: number;
  /** Tiempo hasta terminar en ms; 0 si no terminó. */
  elapsedMs: number;
  finished: boolean;
}

export interface RoomView {
  code: string;
  status: RoomStatus;
  hostId: string;
  maxPlayers: number;
  players: PlayerView[];
  race: RaceSetup | null;
  progress: PlayerProgressView[];
  results: PlayerResultView[];
}
