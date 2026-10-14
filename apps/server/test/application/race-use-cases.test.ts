import { describe, expect, it } from 'vitest';
import type { RaceResultRepository } from '../../src/application/ports/race-result-repository.js';
import { CheatDetectedError, ForbiddenError, InvalidStateError } from '../../src/domain/errors.js';
import { collect, createTestApp, flush, TEST_TEXTS } from '../helpers/fakes.js';

const TEXT = TEST_TEXTS[0]!.content; // 'hola mundo' (10 caracteres)

/** Sala con Ana (anfitriona) y Beto listo, ambos con stream abierto. */
async function setupRoom(overrides: Parameters<typeof createTestApp>[0] = {}) {
  const ctx = createTestApp({ countdownMs: 3_000, raceDurationMs: 60_000, ...overrides });
  const { app } = ctx;
  const ana = await app.createRoom.execute({ nickname: 'Ana' });
  const beto = await app.joinRoom.execute({ nickname: 'Beto', roomCode: ana.roomCode });
  await app.setReady.execute(beto.playerToken, true);
  const anaStream = collect(app.watchRoom.execute(ana.playerToken, new AbortController().signal));
  const betoTab = new AbortController();
  collect(app.watchRoom.execute(beto.playerToken, betoTab.signal));
  await flush();
  return { ...ctx, ana, beto, anaStream, betoTab };
}

describe('StartRace', () => {
  it('lanza la cuenta regresiva con texto y hora de inicio del servidor', async () => {
    const { app, ana, anaStream, clock } = await setupRoom();
    const startedAt = clock.now();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await flush();

    const event = anaStream.events.find((e) => e.type === 'countdownStarted');
    expect(event).toEqual({
      type: 'countdownStarted',
      race: {
        id: raceId,
        text: TEST_TEXTS[0],
        startAt: startedAt + 3_000,
        deadlineAt: startedAt + 63_000,
      },
    });
  });

  it('pasa a RACING al terminar la cuenta regresiva', async () => {
    const { app, ana, anaStream, scheduler, rooms } = await setupRoom();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(3_000);
    await flush();

    expect((await rooms.findByCode(ana.roomCode))?.status).toBe('RACING');
    expect(anaStream.events.at(-1)).toEqual({ type: 'raceStarted', raceId });
  });

  it('solo el anfitrión puede iniciar', async () => {
    const { app, beto } = await setupRoom();
    await expect(app.startRace.execute(beto.playerToken)).rejects.toThrow(ForbiddenError);
  });

  it('exige que todos estén listos', async () => {
    const { app, ana, beto } = await setupRoom();
    await app.setReady.execute(beto.playerToken, false);
    await expect(app.startRace.execute(ana.playerToken)).rejects.toThrow(InvalidStateError);
  });
});

describe('SubmitProgress y fin de carrera', () => {
  it('carrera completa: progreso, llegada, resultados y persistencia', async () => {
    const { app, ana, beto, anaStream, scheduler, results, rooms } = await setupRoom();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(3_000 + 6_000); // 6 s de carrera

    const partial = await app.submitProgress.execute(beto.playerToken, {
      raceId,
      typedCorrect: 5,
      errors: 1,
    });
    expect(partial).toMatchObject({ percent: 50, wpm: 10, finished: false });

    await app.submitProgress.execute(beto.playerToken, {
      raceId,
      typedCorrect: TEXT.length,
      errors: 1,
    });
    await scheduler.advance(6_000);
    await app.submitProgress.execute(ana.playerToken, {
      raceId,
      typedCorrect: TEXT.length,
      errors: 0,
    });
    await flush();

    expect(anaStream.types().slice(-6)).toEqual([
      'progressUpdated',
      'progressUpdated',
      'playerFinished',
      'progressUpdated',
      'playerFinished',
      'raceFinished',
    ]);
    const finished = anaStream.events.at(-1);
    expect(finished?.type === 'raceFinished' && finished.results).toMatchObject([
      { nickname: 'Beto', position: 1, wpm: 20, accuracy: 0.9091, finished: true },
      { nickname: 'Ana', position: 2, wpm: 10, accuracy: 1, finished: true },
    ]);
    expect((await rooms.findByCode(ana.roomCode))?.status).toBe('FINISHED');
    expect(results.races).toHaveLength(1);
    expect(results.races[0]).toMatchObject({ raceId, roomCode: ana.roomCode, textId: 'text-1' });
    expect(scheduler.pending).toBe(0);
  });

  it('termina por tiempo límite aunque nadie complete el texto', async () => {
    const { app, ana, beto, anaStream, scheduler, results } = await setupRoom();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(3_000 + 30_000);
    await app.submitProgress.execute(beto.playerToken, { raceId, typedCorrect: 4, errors: 0 });

    await scheduler.advance(30_000);
    await flush();

    const finished = anaStream.events.at(-1);
    expect(finished?.type).toBe('raceFinished');
    expect(finished?.type === 'raceFinished' && finished.results.map((r) => r.nickname)).toEqual([
      'Beto',
      'Ana',
    ]);
    expect(await results.topByWpm(10)).toEqual([]); // nadie terminó
  });

  it('termina cuando los conectados terminaron aunque otro se desconecte', async () => {
    const { app, ana, betoTab, anaStream, scheduler } = await setupRoom();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(3_000 + 10_000);
    await app.submitProgress.execute(ana.playerToken, {
      raceId,
      typedCorrect: TEXT.length,
      errors: 0,
    });
    expect(anaStream.types()).not.toContain('raceFinished');

    betoTab.abort();
    await flush();
    expect(anaStream.types().slice(-2)).toEqual(['playerConnectionChanged', 'raceFinished']);
  });

  it('termina la carrera si sale el único jugador que faltaba', async () => {
    const { app, ana, beto, anaStream, scheduler } = await setupRoom();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(3_000 + 10_000);
    await app.submitProgress.execute(ana.playerToken, {
      raceId,
      typedCorrect: TEXT.length,
      errors: 0,
    });

    await app.leaveRoom.execute(beto.playerToken);
    await flush();
    expect(anaStream.types().at(-1)).toBe('raceFinished');
  });

  it('rechaza trampas y conserva el último progreso válido', async () => {
    const { app, ana, scheduler, rooms } = await setupRoom();
    const { raceId } = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(3_000 + 5_000);

    await app.submitProgress.execute(ana.playerToken, { raceId, typedCorrect: 5, errors: 0 });
    await expect(
      app.submitProgress.execute(ana.playerToken, { raceId, typedCorrect: 99, errors: 0 }),
    ).rejects.toThrow(CheatDetectedError);
    await expect(
      app.submitProgress.execute(ana.playerToken, { raceId, typedCorrect: 3, errors: 0 }),
    ).rejects.toThrow(CheatDetectedError);

    const room = await rooms.findByCode(ana.roomCode);
    expect(room?.getPlayer(ana.playerId).race.typedCorrect).toBe(5);
  });

  it('rechaza progreso de otra carrera', async () => {
    const { app, ana, scheduler } = await setupRoom();
    await app.startRace.execute(ana.playerToken);
    await scheduler.advance(4_000);
    await expect(
      app.submitProgress.execute(ana.playerToken, { raceId: 'otra', typedCorrect: 1, errors: 0 }),
    ).rejects.toThrow(InvalidStateError);
  });

  it('permite la revancha con otro texto', async () => {
    const { app, ana, beto, anaStream, scheduler } = await setupRoom();
    const first = await app.startRace.execute(ana.playerToken);
    await scheduler.advance(63_000);
    await flush();
    expect(anaStream.types().at(-1)).toBe('raceFinished');

    await app.setReady.execute(beto.playerToken, true);
    const second = await app.startRace.execute(ana.playerToken);
    await flush();

    expect(second.raceId).not.toBe(first.raceId);
    const countdown = anaStream.events.at(-1);
    expect(countdown?.type === 'countdownStarted' && countdown.race.text.id).toBe('text-2');
  });

  it('un fallo al persistir no rompe la carrera', async () => {
    const { app, ana, anaStream, scheduler, results } = await setupRoom();
    const failing: RaceResultRepository = results;
    failing.saveRace = () => Promise.reject(new Error('db caída'));

    await app.startRace.execute(ana.playerToken);
    await scheduler.advance(63_000);
    await flush();
    expect(anaStream.types().at(-1)).toBe('raceFinished');
  });
});

describe('GetLeaderboard', () => {
  it('devuelve los mejores WPM con límite por defecto y máximo', async () => {
    const { app, results } = createTestApp();
    for (let i = 1; i <= 60; i++) {
      await results.saveRace({
        raceId: `r${i}`,
        roomCode: 'AAAAAA',
        textId: 't',
        startedAt: i,
        finishedAt: i,
        results: [
          {
            playerId: `p${i}`,
            nickname: `Jugador ${i}`,
            position: 1,
            wpm: i,
            accuracy: 1,
            elapsedMs: 1_000,
            finished: true,
          },
        ],
      });
    }

    const top = await app.getLeaderboard.execute({});
    expect(top).toHaveLength(20);
    expect(top[0]).toMatchObject({ rank: 1, nickname: 'Jugador 60', wpm: 60 });
    expect(await app.getLeaderboard.execute({ limit: 500 })).toHaveLength(50);
    expect(await app.getLeaderboard.execute({ limit: 3 })).toHaveLength(3);
  });
});
