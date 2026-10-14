import type { RoomRules } from '../domain/room.js';

/** Parámetros del juego. Se inyectan para poder acortarlos en tests. */
export interface GameRules extends RoomRules {
  countdownMs: number;
  raceDurationMs: number;
  inactiveRoomTtlMs: number;
  /**
   * Margen para reconectar durante una carrera: una desconexión no da la
   * carrera por terminada hasta que pasa este tiempo (p. ej. al recargar).
   */
  disconnectGraceMs: number;
}

export const DEFAULT_GAME_RULES: GameRules = {
  maxPlayers: 5,
  maxWpm: 250,
  antiCheatGraceMs: 1_000,
  countdownMs: 3_000,
  raceDurationMs: 120_000,
  inactiveRoomTtlMs: 30 * 60_000,
  disconnectGraceMs: 10_000,
};
