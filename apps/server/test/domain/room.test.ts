import { describe, expect, it } from 'vitest';
import {
  CheatDetectedError,
  ForbiddenError,
  InvalidStateError,
  RoomFullError,
  ValidationError,
} from '../../src/domain/errors.js';
import { canTransition, Room, type RoomRules } from '../../src/domain/room.js';
import type { RaceSetup } from '../../src/domain/types.js';

const RULES: RoomRules = { maxPlayers: 3, maxWpm: 250, antiCheatGraceMs: 1_000 };
const T0 = 1_000_000;
const TEXT = 'abcdefghij'; // 10 caracteres

function newRoom(): Room {
  return Room.create({
    code: 'ABCDEF',
    host: { id: 'host', token: 't-host', nickname: 'Anfitrión' },
    rules: RULES,
    now: T0,
  });
}

function addGuest(room: Room, id = 'guest', nickname = 'Invitado'): void {
  room.addPlayer({ id, token: `t-${id}`, nickname }, T0);
}

function setup(startAt = T0 + 3_000): RaceSetup {
  return {
    id: 'race-1',
    text: { id: 'txt', content: TEXT },
    startAt,
    deadlineAt: startAt + 120_000,
  };
}

/** Sala con anfitrión + invitado listos, en estado RACING desde START. */
const START = T0 + 3_000;
function racingRoom(): Room {
  const room = newRoom();
  addGuest(room);
  room.setReady('guest', true, T0);
  room.startCountdown('host', setup(START), T0);
  room.beginRace(START);
  return room;
}

describe('máquina de estados', () => {
  it('define solo las transiciones del ciclo de juego', () => {
    expect(canTransition('WAITING', 'COUNTDOWN')).toBe(true);
    expect(canTransition('COUNTDOWN', 'RACING')).toBe(true);
    expect(canTransition('RACING', 'FINISHED')).toBe(true);
    expect(canTransition('FINISHED', 'WAITING')).toBe(true);

    expect(canTransition('WAITING', 'RACING')).toBe(false);
    expect(canTransition('WAITING', 'FINISHED')).toBe(false);
    expect(canTransition('COUNTDOWN', 'FINISHED')).toBe(false);
    expect(canTransition('RACING', 'WAITING')).toBe(false);
    expect(canTransition('FINISHED', 'RACING')).toBe(false);
  });

  it('una sala nueva está en WAITING con el creador como anfitrión', () => {
    const room = newRoom();
    expect(room.status).toBe('WAITING');
    expect(room.hostId).toBe('host');
    expect(room.toView(T0).players).toEqual([
      { id: 'host', nickname: 'Anfitrión', isHost: true, isReady: false, isConnected: false },
    ]);
  });

  it('lanza error de dominio en transiciones inválidas', () => {
    const room = newRoom();
    expect(() => {
      room.beginRace(T0);
    }).toThrow(InvalidStateError);
    expect(() => room.finishRace(T0)).toThrow(InvalidStateError);
  });

  it('recorre el ciclo completo y permite la revancha', () => {
    const room = racingRoom();
    expect(room.status).toBe('RACING');
    room.finishRace(START + 10_000);
    expect(room.status).toBe('FINISHED');

    room.setReady('guest', true, START + 11_000);
    room.startCountdown('host', { ...setup(START + 20_000), id: 'race-2' }, START + 17_000);
    expect(room.status).toBe('COUNTDOWN');
    expect(room.race?.id).toBe('race-2');
  });
});

describe('jugadores', () => {
  it('limita la sala a maxPlayers', () => {
    const room = newRoom();
    addGuest(room, 'g1', 'Uno');
    addGuest(room, 'g2', 'Dos');
    expect(() => {
      addGuest(room, 'g3', 'Tres');
    }).toThrow(RoomFullError);
  });

  it('rechaza apodos repetidos sin distinguir mayúsculas', () => {
    const room = newRoom();
    expect(() => {
      addGuest(room, 'g1', 'anfitrión');
    }).toThrow(ValidationError);
  });

  it('no permite unirse durante la carrera', () => {
    const room = racingRoom();
    expect(() => {
      addGuest(room, 'late', 'Tarde');
    }).toThrow(InvalidStateError);
  });

  it('transfiere el rol de anfitrión al jugador más antiguo', () => {
    const room = newRoom();
    addGuest(room, 'g1', 'Uno');
    addGuest(room, 'g2', 'Dos');
    expect(room.removePlayer('host', T0)).toEqual({ newHostId: 'g1', isEmpty: false });
    expect(room.hostId).toBe('g1');
    expect(room.removePlayer('g2', T0)).toEqual({ newHostId: null, isEmpty: false });
    expect(room.removePlayer('g1', T0)).toEqual({ newHostId: null, isEmpty: true });
  });

  it('solo permite marcarse listo fuera de la carrera', () => {
    const room = racingRoom();
    expect(() => {
      room.setReady('guest', false, START);
    }).toThrow(InvalidStateError);
  });
});

describe('inicio de carrera', () => {
  it('solo el anfitrión puede iniciar', () => {
    const room = newRoom();
    addGuest(room);
    room.setReady('guest', true, T0);
    expect(() => {
      room.startCountdown('guest', setup(), T0);
    }).toThrow(ForbiddenError);
  });

  it('exige que los demás jugadores estén listos', () => {
    const room = newRoom();
    addGuest(room);
    expect(() => {
      room.startCountdown('host', setup(), T0);
    }).toThrow(/Invitado/);
  });

  it('el anfitrión solo puede correr sin esperar a nadie', () => {
    const room = newRoom();
    room.startCountdown('host', setup(), T0);
    expect(room.status).toBe('COUNTDOWN');
    expect(room.toView(T0).race?.text.content).toBe(TEXT);
  });

  it('no permite iniciar dos carreras a la vez', () => {
    const room = racingRoom();
    expect(() => {
      room.startCountdown('host', setup(), START);
    }).toThrow(InvalidStateError);
  });
});

describe('progreso y resultados', () => {
  it('calcula avance y WPM con el reloj del servidor', () => {
    const room = racingRoom();
    const { progress, finishedResult } = room.recordProgress(
      'host',
      { typedCorrect: 5, errors: 1 },
      START + 6_000,
    );
    expect(progress).toEqual({
      playerId: 'host',
      typedCorrect: 5,
      errors: 1,
      percent: 50,
      wpm: 10, // 1 palabra en 0,1 min
      finished: false,
    });
    expect(finishedResult).toBeNull();
  });

  it('asigna posiciones por orden de llegada', () => {
    const room = racingRoom();
    const guest = room.recordProgress('guest', { typedCorrect: 10, errors: 0 }, START + 6_000);
    const host = room.recordProgress('host', { typedCorrect: 10, errors: 2 }, START + 12_000);
    expect(guest.finishedResult).toMatchObject({
      position: 1,
      wpm: 20,
      accuracy: 1,
      elapsedMs: 6_000,
    });
    expect(host.finishedResult).toMatchObject({ position: 2, wpm: 10, accuracy: 0.8333 });
    expect(room.isRaceComplete()).toBe(true);
  });

  it('ignora reportes después de terminar', () => {
    const room = racingRoom();
    room.recordProgress('guest', { typedCorrect: 10, errors: 0 }, START + 6_000);
    const again = room.recordProgress('guest', { typedCorrect: 10, errors: 0 }, START + 7_000);
    expect(again.finishedResult).toBeNull();
    expect(again.progress.finished).toBe(true);
  });

  it('aplica el anti-trampa', () => {
    const room = racingRoom();
    room.recordProgress('host', { typedCorrect: 5, errors: 0 }, START + 6_000);
    expect(() =>
      room.recordProgress('host', { typedCorrect: 4, errors: 0 }, START + 7_000),
    ).toThrow(CheatDetectedError);
  });

  it('rechaza progreso durante la cuenta regresiva', () => {
    const room = newRoom();
    room.startCountdown('host', setup(START), T0);
    expect(() => room.recordProgress('host', { typedCorrect: 1, errors: 0 }, START - 1)).toThrow(
      CheatDetectedError,
    );
  });

  it('arranca la carrera si llega progreso válido cuando ya es la hora', () => {
    const room = newRoom();
    room.startCountdown('host', setup(START), T0);
    const outcome = room.recordProgress('host', { typedCorrect: 1, errors: 0 }, START + 1_000);
    expect(outcome.startedRace).toBe(true);
    expect(room.status).toBe('RACING');
  });

  it('rechaza progreso fuera de una carrera', () => {
    const room = newRoom();
    expect(() => room.recordProgress('host', { typedCorrect: 1, errors: 0 }, T0)).toThrow(
      InvalidStateError,
    );
  });

  it('la carrera se completa cuando terminan todos los conectados', () => {
    const room = racingRoom();
    room.setConnected('host', true, START);
    room.setConnected('guest', true, START);
    room.recordProgress('host', { typedCorrect: 10, errors: 0 }, START + 6_000);
    expect(room.isRaceComplete()).toBe(false);
    room.setConnected('guest', false, START + 7_000);
    expect(room.isRaceComplete()).toBe(true);
  });

  it('ordena a quienes no terminaron por avance y reinicia "listo"', () => {
    const room = racingRoom();
    room.recordProgress('host', { typedCorrect: 3, errors: 0 }, START + 6_000);
    room.recordProgress('guest', { typedCorrect: 7, errors: 1 }, START + 6_000);
    const results = room.finishRace(START + 120_000);

    expect(results.map((r) => [r.playerId, r.position, r.finished])).toEqual([
      ['guest', 1, false],
      ['host', 2, false],
    ]);
    expect(results[0]).toMatchObject({ elapsedMs: 0, wpm: 0.7, accuracy: 0.875 });
    expect(room.toView(START + 120_000).players.every((p) => !p.isReady)).toBe(true);
    expect(room.toView(START + 120_000).results).toHaveLength(2);
  });
});
