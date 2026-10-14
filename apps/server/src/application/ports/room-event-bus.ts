import type { RoomEvent } from '../events.js';

/** Pub/Sub de eventos por sala. */
export interface RoomEventBus {
  publish(roomCode: string, event: RoomEvent): void;
  /**
   * Suscribe a los eventos de la sala. La suscripción queda registrada de
   * inmediato (antes de iterar) y termina al abortar `signal` o al cerrar la sala.
   */
  subscribe(roomCode: string, signal: AbortSignal): AsyncIterable<RoomEvent>;
  /** Finaliza todas las suscripciones de la sala. */
  closeRoom(roomCode: string): void;
}
