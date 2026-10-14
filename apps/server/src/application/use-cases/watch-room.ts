import type { AppDeps } from '../deps.js';
import type { RoomEvent } from '../events.js';
import type { RaceLifecycle } from '../race-lifecycle.js';
import type { SessionResolver } from '../session-resolver.js';

/**
 * Stream de eventos de la sala para un jugador. Envía primero un `snapshot`
 * con el estado completo y luego los eventos en orden. Mientras el jugador
 * tenga al menos un stream abierto se considera conectado.
 */
export class WatchRoom {
  /** Streams abiertos por jugador (puede tener varias pestañas). */
  private readonly openStreams = new Map<string, number>();

  constructor(
    private readonly deps: Pick<AppDeps, 'bus' | 'clock'>,
    private readonly lifecycle: RaceLifecycle,
    private readonly sessions: SessionResolver,
  ) {}

  async *execute(token: string | undefined, signal: AbortSignal): AsyncGenerator<RoomEvent> {
    const { room, player } = await this.sessions.resolve(token);
    // Suscribirse antes de tomar el snapshot para no perder eventos intermedios.
    const events = this.deps.bus.subscribe(room.code, signal);
    await this.open(room.code, player.id);

    try {
      yield { type: 'snapshot', room: room.toView(this.deps.clock.now()) };
      for await (const event of events) {
        yield event;
        if (event.type === 'playerLeft' && event.playerId === player.id) return;
      }
    } finally {
      await this.close(room.code, player.id);
    }
  }

  private async open(roomCode: string, playerId: string): Promise<void> {
    const count = (this.openStreams.get(playerId) ?? 0) + 1;
    this.openStreams.set(playerId, count);
    if (count === 1) await this.lifecycle.setConnected(roomCode, playerId, true);
  }

  private async close(roomCode: string, playerId: string): Promise<void> {
    const count = (this.openStreams.get(playerId) ?? 1) - 1;
    if (count > 0) {
      this.openStreams.set(playerId, count);
      return;
    }
    this.openStreams.delete(playerId);
    await this.lifecycle.setConnected(roomCode, playerId, false);
  }
}
