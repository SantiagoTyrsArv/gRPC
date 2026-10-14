import { InvalidStateError, NotFoundError } from '../../domain/errors.js';
import { normalizeNickname } from '../../domain/nickname.js';
import { normalizeRoomCode } from '../../domain/room-code.js';
import { Room } from '../../domain/room.js';
import type { AppDeps } from '../deps.js';
import type { RaceLifecycle } from '../race-lifecycle.js';
import type { SessionResolver } from '../session-resolver.js';

/** Credenciales que el cliente guarda para reconectarse. */
export interface PlayerSession {
  roomCode: string;
  playerId: string;
  playerToken: string;
}

const MAX_CODE_ATTEMPTS = 20;

export class CreateRoom {
  constructor(
    private readonly deps: Pick<AppDeps, 'rooms' | 'ids' | 'clock' | 'rules' | 'logger'>,
  ) {}

  async execute(input: { nickname: string }): Promise<PlayerSession> {
    const nickname = normalizeNickname(input.nickname);
    const code = await this.uniqueCode();
    const host = { id: this.deps.ids.playerId(), token: this.deps.ids.playerToken(), nickname };
    const room = Room.create({ code, host, rules: this.deps.rules, now: this.deps.clock.now() });
    await this.deps.rooms.save(room);
    this.deps.logger.info({ roomCode: code, playerId: host.id }, 'Sala creada');
    return { roomCode: code, playerId: host.id, playerToken: host.token };
  }

  private async uniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = this.deps.ids.roomCode();
      if (!(await this.deps.rooms.exists(code))) return code;
    }
    throw new InvalidStateError('No se pudo generar un código de sala, inténtalo de nuevo');
  }
}

export class JoinRoom {
  constructor(private readonly deps: Pick<AppDeps, 'rooms' | 'ids' | 'clock' | 'bus' | 'logger'>) {}

  async execute(input: { nickname: string; roomCode: string }): Promise<PlayerSession> {
    const nickname = normalizeNickname(input.nickname);
    const code = normalizeRoomCode(input.roomCode);
    const room = await this.deps.rooms.findByCode(code);
    if (!room) throw new NotFoundError(`No existe una sala con el código ${code}`);

    const player = room.addPlayer(
      { id: this.deps.ids.playerId(), token: this.deps.ids.playerToken(), nickname },
      this.deps.clock.now(),
    );
    await this.deps.rooms.save(room);
    this.deps.bus.publish(code, { type: 'playerJoined', player: room.playerView(player) });
    this.deps.logger.info({ roomCode: code, playerId: player.id }, 'Jugador unido');
    return { roomCode: code, playerId: player.id, playerToken: player.token };
  }
}

export class Reconnect {
  constructor(private readonly sessions: SessionResolver) {}

  async execute(token: string | undefined): Promise<PlayerSession & { nickname: string }> {
    const { room, player } = await this.sessions.resolve(token);
    return {
      roomCode: room.code,
      playerId: player.id,
      playerToken: player.token,
      nickname: player.nickname,
    };
  }
}

export class SetReady {
  constructor(
    private readonly deps: Pick<AppDeps, 'rooms' | 'clock' | 'bus'>,
    private readonly sessions: SessionResolver,
  ) {}

  async execute(token: string | undefined, ready: boolean): Promise<void> {
    const { room, player } = await this.sessions.resolve(token);
    room.setReady(player.id, ready, this.deps.clock.now());
    await this.deps.rooms.save(room);
    this.deps.bus.publish(room.code, { type: 'playerReadyChanged', playerId: player.id, ready });
  }
}

export class LeaveRoom {
  constructor(
    private readonly lifecycle: RaceLifecycle,
    private readonly sessions: SessionResolver,
  ) {}

  async execute(token: string | undefined): Promise<void> {
    const { room, player } = await this.sessions.resolve(token);
    await this.lifecycle.removePlayer(room, player.id);
  }
}
