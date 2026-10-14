import { UnauthenticatedError } from '../domain/errors.js';
import type { Player } from '../domain/player.js';
import type { Room } from '../domain/room.js';
import type { AppDeps } from './deps.js';

export interface PlayerSessionContext {
  room: Room;
  player: Player;
}

/** Resuelve el `player_token` (enviado en un header) a su sala y jugador. */
export class SessionResolver {
  constructor(private readonly deps: Pick<AppDeps, 'rooms'>) {}

  async resolve(token: string | undefined): Promise<PlayerSessionContext> {
    if (!token) throw new UnauthenticatedError('Falta el token de jugador');
    const room = await this.deps.rooms.findByPlayerToken(token);
    const player = room?.findPlayerByToken(token);
    if (!room || !player) {
      throw new UnauthenticatedError('Sesión inválida o expirada');
    }
    return { room, player };
  }
}
