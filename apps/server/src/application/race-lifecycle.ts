import { CheatDetectedError, InvalidStateError } from '../domain/errors.js';
import type { ProgressOutcome, Room } from '../domain/room.js';
import type { PlayerProgressView, RaceSetup } from '../domain/types.js';
import type { AppDeps } from './deps.js';
import type { TimerHandle } from './ports/system.js';

export interface SubmitProgressInput {
  raceId: string;
  typedCorrect: number;
  errors: number;
}

/**
 * Orquesta el ciclo de vida de una carrera: cuenta regresiva, inicio, límite de
 * tiempo, fin anticipado y persistencia de resultados. También concentra las
 * operaciones que pueden terminar una carrera (salir o desconectarse).
 */
export class RaceLifecycle {
  /** Temporizadores activos por código de sala. */
  private readonly timers = new Map<string, TimerHandle[]>();

  constructor(private readonly deps: AppDeps) {}

  async startRace(room: Room, byPlayerId: string): Promise<string> {
    const { clock, ids, rules, texts, rooms, bus, scheduler } = this.deps;
    const text = await texts.pickRandom(room.race?.text.id);
    const now = clock.now();
    const startAt = now + rules.countdownMs;
    const setup: RaceSetup = {
      id: ids.raceId(),
      text,
      startAt,
      deadlineAt: startAt + rules.raceDurationMs,
    };

    room.startCountdown(byPlayerId, setup, now);
    await rooms.save(room);
    bus.publish(room.code, { type: 'countdownStarted', race: setup });

    this.cancelTimers(room.code);
    this.timers.set(room.code, [
      scheduler.schedule(rules.countdownMs, () => this.onCountdownElapsed(room.code, setup.id)),
      scheduler.schedule(rules.countdownMs + rules.raceDurationMs, () =>
        this.onDeadline(room.code, setup.id),
      ),
    ]);
    this.deps.logger.info({ roomCode: room.code, raceId: setup.id }, 'Cuenta regresiva iniciada');
    return setup.id;
  }

  async submitProgress(
    room: Room,
    playerId: string,
    input: SubmitProgressInput,
  ): Promise<PlayerProgressView> {
    if (room.race?.id !== input.raceId) {
      throw new InvalidStateError('La carrera indicada no está activa');
    }

    let outcome: ProgressOutcome;
    try {
      outcome = room.recordProgress(playerId, input, this.deps.clock.now());
    } catch (error) {
      if (error instanceof CheatDetectedError) {
        this.deps.logger.warn(
          { roomCode: room.code, playerId, reason: error.reason, input },
          'Progreso rechazado por anti-trampa',
        );
      }
      throw error;
    }

    await this.deps.rooms.save(room);
    if (outcome.startedRace) {
      this.deps.bus.publish(room.code, { type: 'raceStarted', raceId: input.raceId });
    }
    this.deps.bus.publish(room.code, { type: 'progressUpdated', progress: outcome.progress });
    if (outcome.finishedResult) {
      this.deps.bus.publish(room.code, { type: 'playerFinished', result: outcome.finishedResult });
    }
    await this.finishIfComplete(room);
    return outcome.progress;
  }

  async removePlayer(room: Room, playerId: string): Promise<void> {
    const { rooms, bus, clock } = this.deps;
    const { newHostId, isEmpty } = room.removePlayer(playerId, clock.now());
    bus.publish(room.code, { type: 'playerLeft', playerId });

    if (isEmpty) {
      await this.disposeRoom(room.code);
      return;
    }
    await rooms.save(room);
    if (newHostId) bus.publish(room.code, { type: 'hostChanged', newHostId });
    await this.finishIfComplete(room);
  }

  async setConnected(roomCode: string, playerId: string, connected: boolean): Promise<void> {
    const room = await this.deps.rooms.findByCode(roomCode);
    // La sala o el jugador pueden haber desaparecido (salió o se limpió la sala).
    if (!room?.listPlayers().some((p) => p.id === playerId)) return;

    if (!room.setConnected(playerId, connected, this.deps.clock.now())) return;
    await this.deps.rooms.save(room);
    this.deps.bus.publish(room.code, { type: 'playerConnectionChanged', playerId, connected });
    if (!connected) this.scheduleCompletionCheck(room);
  }

  /**
   * Tras una desconexión en plena carrera, espera el margen de reconexión
   * antes de comprobar si la carrera terminó (los conectados ya llegaron).
   */
  private scheduleCompletionCheck(room: Room): void {
    const raceId = room.race?.id;
    if (room.status !== 'RACING' || !raceId) return;
    const handle = this.deps.scheduler.schedule(this.deps.rules.disconnectGraceMs, async () => {
      const current = await this.deps.rooms.findByCode(room.code);
      if (current?.race?.id === raceId) await this.finishIfComplete(current);
    });
    this.timers.set(room.code, [...(this.timers.get(room.code) ?? []), handle]);
  }

  /** Elimina la sala, sus temporizadores y cierra los streams abiertos. */
  async disposeRoom(roomCode: string): Promise<void> {
    this.cancelTimers(roomCode);
    await this.deps.rooms.delete(roomCode);
    this.deps.bus.closeRoom(roomCode);
  }

  private async onCountdownElapsed(roomCode: string, raceId: string): Promise<void> {
    const room = await this.deps.rooms.findByCode(roomCode);
    if (room?.race?.id !== raceId || room.status !== 'COUNTDOWN') return;
    room.beginRace(this.deps.clock.now());
    await this.deps.rooms.save(room);
    this.deps.bus.publish(roomCode, { type: 'raceStarted', raceId });
  }

  private async onDeadline(roomCode: string, raceId: string): Promise<void> {
    const room = await this.deps.rooms.findByCode(roomCode);
    if (room?.race?.id !== raceId || room.status !== 'RACING') return;
    this.deps.logger.info({ roomCode, raceId }, 'Tiempo límite alcanzado');
    await this.finish(room);
  }

  private async finishIfComplete(room: Room): Promise<void> {
    if (room.isRaceComplete()) await this.finish(room);
  }

  private async finish(room: Room): Promise<void> {
    const race = room.race;
    if (!race) return;
    const now = this.deps.clock.now();
    const results = room.finishRace(now);
    this.cancelTimers(room.code);
    await this.deps.rooms.save(room);
    this.deps.bus.publish(room.code, { type: 'raceFinished', raceId: race.id, results });
    this.deps.logger.info({ roomCode: room.code, raceId: race.id }, 'Carrera finalizada');

    try {
      await this.deps.results.saveRace({
        raceId: race.id,
        roomCode: room.code,
        textId: race.text.id,
        startedAt: race.startAt,
        finishedAt: now,
        results,
      });
    } catch (error) {
      // Un fallo de persistencia no debe romper la partida en curso.
      this.deps.logger.error(
        { err: error, raceId: race.id },
        'No se pudieron guardar los resultados',
      );
    }
  }

  private cancelTimers(roomCode: string): void {
    for (const handle of this.timers.get(roomCode) ?? []) this.deps.scheduler.cancel(handle);
    this.timers.delete(roomCode);
  }
}
