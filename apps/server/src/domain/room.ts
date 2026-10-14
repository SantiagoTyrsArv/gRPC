import { assertValidProgress } from './anti-cheat.js';
import {
  ForbiddenError,
  InvalidStateError,
  NotFoundError,
  RoomFullError,
  ValidationError,
} from './errors.js';
import { emptyRaceState, Player, type NewPlayer } from './player.js';
import { calculateAccuracy, calculatePercent, calculateWpm } from './stats.js';
import type {
  PlayerProgressView,
  PlayerResultView,
  PlayerView,
  RaceSetup,
  RoomStatus,
  RoomView,
} from './types.js';

export interface RoomRules {
  maxPlayers: number;
  maxWpm: number;
  antiCheatGraceMs: number;
}

/** Máquina de estados explícita: WAITING → COUNTDOWN → RACING → FINISHED → WAITING. */
const TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  WAITING: ['COUNTDOWN'],
  COUNTDOWN: ['RACING'],
  RACING: ['FINISHED'],
  FINISHED: ['WAITING'],
};

export function canTransition(from: RoomStatus, to: RoomStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface ProgressInput {
  typedCorrect: number;
  errors: number;
}

export interface ProgressOutcome {
  progress: PlayerProgressView;
  /** Resultado del jugador si este reporte completó el texto. */
  finishedResult: PlayerResultView | null;
  /** `true` si este reporte provocó la transición COUNTDOWN → RACING. */
  startedRace: boolean;
}

export interface RemovalOutcome {
  /** Nuevo anfitrión si el que salió lo era. */
  newHostId: string | null;
  isEmpty: boolean;
}

/** Agregado raíz: una sala con sus jugadores y la carrera en curso. */
export class Room {
  private readonly players = new Map<string, Player>();
  private _status: RoomStatus = 'WAITING';
  private _hostId: string;
  private _race: RaceSetup | null = null;
  private _results: PlayerResultView[] = [];
  private _lastActivityAt: number;
  private finishCount = 0;

  private constructor(
    readonly code: string,
    private readonly rules: RoomRules,
    host: Player,
    now: number,
  ) {
    this.players.set(host.id, host);
    this._hostId = host.id;
    this._lastActivityAt = now;
  }

  static create(params: { code: string; host: NewPlayer; rules: RoomRules; now: number }): Room {
    return new Room(params.code, params.rules, new Player(params.host), params.now);
  }

  get status(): RoomStatus {
    return this._status;
  }

  get hostId(): string {
    return this._hostId;
  }

  get race(): RaceSetup | null {
    return this._race;
  }

  get lastActivityAt(): number {
    return this._lastActivityAt;
  }

  get playerCount(): number {
    return this.players.size;
  }

  listPlayers(): readonly Player[] {
    return [...this.players.values()];
  }

  getPlayer(playerId: string): Player {
    const player = this.players.get(playerId);
    if (!player) throw new NotFoundError('El jugador no pertenece a la sala');
    return player;
  }

  findPlayerByToken(token: string): Player | undefined {
    return this.listPlayers().find((p) => p.token === token);
  }

  addPlayer(data: NewPlayer, now: number): Player {
    if (this._status !== 'WAITING' && this._status !== 'FINISHED') {
      throw new InvalidStateError('No es posible unirse mientras hay una carrera en curso');
    }
    if (this.players.size >= this.rules.maxPlayers) {
      throw new RoomFullError(`La sala está llena (máximo ${this.rules.maxPlayers} jugadores)`);
    }
    const taken = this.listPlayers().some(
      (p) => p.nickname.toLocaleLowerCase('es') === data.nickname.toLocaleLowerCase('es'),
    );
    if (taken) throw new ValidationError('Ese apodo ya está en uso en la sala');

    const player = new Player(data);
    this.players.set(player.id, player);
    this.touch(now);
    return player;
  }

  removePlayer(playerId: string, now: number): RemovalOutcome {
    this.getPlayer(playerId);
    this.players.delete(playerId);
    this.touch(now);

    let newHostId: string | null = null;
    const next = this.players.values().next();
    if (playerId === this._hostId && !next.done) {
      // El jugador más antiguo (orden de inserción) hereda el rol de anfitrión.
      this._hostId = next.value.id;
      newHostId = this._hostId;
    }
    return { newHostId, isEmpty: this.players.size === 0 };
  }

  setReady(playerId: string, ready: boolean, now: number): void {
    if (this._status !== 'WAITING' && this._status !== 'FINISHED') {
      throw new InvalidStateError('Solo puedes marcarte como listo antes de la carrera');
    }
    this.getPlayer(playerId).ready = ready;
    this.touch(now);
  }

  /** Devuelve `true` si el estado de conexión cambió. */
  setConnected(playerId: string, connected: boolean, now: number): boolean {
    const player = this.getPlayer(playerId);
    if (player.connected === connected) return false;
    player.connected = connected;
    this.touch(now);
    return true;
  }

  /**
   * Inicia la cuenta regresiva de una nueva carrera. Solo el anfitrión puede
   * hacerlo y todos los demás jugadores deben estar listos. Desde FINISHED
   * (revancha) la sala vuelve primero a WAITING.
   */
  startCountdown(byPlayerId: string, setup: RaceSetup, now: number): void {
    this.getPlayer(byPlayerId);
    if (byPlayerId !== this._hostId) {
      throw new ForbiddenError('Solo el anfitrión puede iniciar la carrera');
    }
    if (this._status === 'FINISHED') this.transition('WAITING');
    if (this._status !== 'WAITING') {
      throw new InvalidStateError('Ya hay una carrera en curso');
    }
    const notReady = this.listPlayers().filter((p) => p.id !== this._hostId && !p.ready);
    if (notReady.length > 0) {
      throw new InvalidStateError(
        `Faltan jugadores por estar listos: ${notReady.map((p) => p.nickname).join(', ')}`,
      );
    }
    if (setup.text.content.length === 0) {
      throw new ValidationError('El texto de la carrera no puede estar vacío');
    }

    this.transition('COUNTDOWN');
    this._race = setup;
    this._results = [];
    this.finishCount = 0;
    for (const player of this.players.values()) player.race = emptyRaceState();
    this.touch(now);
  }

  beginRace(now: number): void {
    this.transition('RACING');
    this.touch(now);
  }

  recordProgress(playerId: string, input: ProgressInput, now: number): ProgressOutcome {
    const player = this.getPlayer(playerId);
    const race = this.requireRace();
    if (this._status !== 'COUNTDOWN' && this._status !== 'RACING') {
      throw new InvalidStateError('No hay una carrera en curso');
    }

    if (player.finished) {
      // Reporte duplicado tras terminar: se ignora de forma idempotente.
      return { progress: this.progressOf(player, now), finishedResult: null, startedRace: false };
    }

    assertValidProgress({
      previousCorrect: player.race.typedCorrect,
      previousErrors: player.race.errors,
      nextCorrect: input.typedCorrect,
      nextErrors: input.errors,
      textLength: race.text.content.length,
      startAt: race.startAt,
      now,
      maxWpm: this.rules.maxWpm,
      graceMs: this.rules.antiCheatGraceMs,
    });

    // Si el temporizador de inicio aún no se ejecutó pero ya es la hora, se arranca aquí.
    let startedRace = false;
    if (this._status === 'COUNTDOWN') {
      this.beginRace(now);
      startedRace = true;
    }

    player.race.typedCorrect = input.typedCorrect;
    player.race.errors = input.errors;

    let finishedResult: PlayerResultView | null = null;
    if (input.typedCorrect === race.text.content.length) {
      this.finishCount += 1;
      player.race.finishedAt = now;
      player.race.position = this.finishCount;
      finishedResult = this.resultOf(player, now);
    }
    this.touch(now);
    return { progress: this.progressOf(player, now), finishedResult, startedRace };
  }

  /**
   * La carrera está completa si todos terminaron o, en su defecto, si todos
   * los jugadores conectados terminaron (los desconectados no bloquean).
   */
  isRaceComplete(): boolean {
    if (this._status !== 'RACING') return false;
    const players = this.listPlayers();
    if (players.length > 0 && players.every((p) => p.finished)) return true;
    const connected = players.filter((p) => p.connected);
    return connected.length > 0 && connected.every((p) => p.finished);
  }

  /** RACING → FINISHED. Calcula y congela los resultados finales. */
  finishRace(now: number): PlayerResultView[] {
    this.requireRace();
    this.transition('FINISHED');

    const finished = this.listPlayers()
      .filter((p) => p.finished)
      .sort((a, b) => (a.race.position ?? 0) - (b.race.position ?? 0));
    const unfinished = this.listPlayers()
      .filter((p) => !p.finished)
      .sort((a, b) => b.race.typedCorrect - a.race.typedCorrect);

    this._results = [...finished, ...unfinished].map((player, index) => ({
      ...this.resultOf(player, now),
      position: index + 1,
    }));
    for (const player of this.players.values()) player.ready = false;
    this.touch(now);
    return this._results;
  }

  toView(now: number): RoomView {
    const race = this._race;
    const showRace = this._status !== 'WAITING';
    return {
      code: this.code,
      status: this._status,
      hostId: this._hostId,
      maxPlayers: this.rules.maxPlayers,
      players: this.listPlayers().map((p) => this.playerView(p)),
      race: showRace ? race : null,
      progress: showRace && race ? this.listPlayers().map((p) => this.progressOf(p, now)) : [],
      results: this._status === 'FINISHED' ? this._results : [],
    };
  }

  playerView(player: Player): PlayerView {
    return {
      id: player.id,
      nickname: player.nickname,
      isHost: player.id === this._hostId,
      isReady: player.ready,
      isConnected: player.connected,
    };
  }

  private progressOf(player: Player, now: number): PlayerProgressView {
    const race = this.requireRace();
    const end = player.race.finishedAt ?? now;
    return {
      playerId: player.id,
      typedCorrect: player.race.typedCorrect,
      percent: calculatePercent(player.race.typedCorrect, race.text.content.length),
      wpm: calculateWpm(player.race.typedCorrect, end - race.startAt),
      finished: player.finished,
    };
  }

  private resultOf(player: Player, now: number): PlayerResultView {
    const race = this.requireRace();
    const elapsed = (player.race.finishedAt ?? Math.min(now, race.deadlineAt)) - race.startAt;
    return {
      playerId: player.id,
      nickname: player.nickname,
      position: player.race.position ?? 0,
      wpm: calculateWpm(player.race.typedCorrect, elapsed),
      accuracy: calculateAccuracy(player.race.typedCorrect, player.race.errors),
      elapsedMs: player.finished ? elapsed : 0,
      finished: player.finished,
    };
  }

  private requireRace(): RaceSetup {
    if (!this._race) throw new InvalidStateError('La sala no tiene una carrera');
    return this._race;
  }

  private transition(to: RoomStatus): void {
    if (!canTransition(this._status, to)) {
      throw new InvalidStateError(`Transición de estado inválida: ${this._status} → ${to}`);
    }
    this._status = to;
  }

  private touch(now: number): void {
    this._lastActivityAt = now;
  }
}
