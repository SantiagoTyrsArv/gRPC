import { describe, expect, it } from 'vitest';
import type { Room } from '../../src/api/types';
import { roomReducer } from '../../src/features/room/room-reducer';

const baseRoom: Room = {
  code: 'ABCDEF',
  status: 'WAITING',
  maxPlayers: 5,
  players: [
    { id: 'a', nickname: 'Ana', isHost: true, isReady: false, isConnected: true },
    { id: 'b', nickname: 'Beto', isHost: false, isReady: false, isConnected: true },
  ],
  race: null,
  progress: {},
  results: [],
};

const race = { id: 'r1', text: 'hola', startAt: 1_000, deadlineAt: 121_000 };

describe('roomReducer', () => {
  it('el snapshot reemplaza el estado y sin él se ignoran los eventos', () => {
    expect(roomReducer(null, { type: 'playerLeft', playerId: 'a' })).toBeNull();
    expect(roomReducer(null, { type: 'snapshot', room: baseRoom })).toBe(baseRoom);
  });

  it('agrega jugadores de forma idempotente', () => {
    const player = { id: 'c', nickname: 'Caro', isHost: false, isReady: false, isConnected: true };
    const once = roomReducer(baseRoom, { type: 'playerJoined', player });
    const twice = roomReducer(once, { type: 'playerJoined', player });
    expect(twice?.players.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('actualiza listo, conexión y anfitrión', () => {
    let room = roomReducer(baseRoom, { type: 'playerReadyChanged', playerId: 'b', ready: true });
    room = roomReducer(room, { type: 'playerConnectionChanged', playerId: 'a', connected: false });
    room = roomReducer(room, { type: 'hostChanged', newHostId: 'b' });
    expect(room?.players).toMatchObject([
      { id: 'a', isHost: false, isConnected: false },
      { id: 'b', isHost: true, isReady: true },
    ]);
  });

  it('recorre cuenta regresiva, carrera y resultados', () => {
    let room = roomReducer(baseRoom, { type: 'countdownStarted', race });
    expect(room).toMatchObject({ status: 'COUNTDOWN', race });
    expect(room?.progress.a).toMatchObject({ percent: 0 });

    room = roomReducer(room, { type: 'raceStarted', raceId: 'otra' });
    expect(room?.status).toBe('COUNTDOWN');
    room = roomReducer(room, { type: 'raceStarted', raceId: 'r1' });
    expect(room?.status).toBe('RACING');

    const progress = {
      playerId: 'b',
      typedCorrect: 2,
      errors: 1,
      percent: 50,
      wpm: 30,
      finished: false,
    };
    room = roomReducer(room, { type: 'progressUpdated', progress });
    expect(room?.progress.b).toEqual(progress);

    const result = {
      playerId: 'b',
      nickname: 'Beto',
      position: 1,
      wpm: 40,
      accuracy: 1,
      elapsedMs: 6_000,
      finished: true,
    };
    room = roomReducer(room, { type: 'playerFinished', result });
    room = roomReducer(room, { type: 'playerFinished', result });
    expect(room?.results).toHaveLength(1);

    room = roomReducer(room, { type: 'raceFinished', raceId: 'r1', results: [result] });
    expect(room).toMatchObject({ status: 'FINISHED', results: [result] });
  });

  it('elimina al jugador y su progreso al salir', () => {
    const racing = roomReducer(baseRoom, { type: 'countdownStarted', race });
    const room = roomReducer(racing, { type: 'playerLeft', playerId: 'b' });
    expect(room?.players.map((p) => p.id)).toEqual(['a']);
    expect(room?.progress.b).toBeUndefined();
  });

  it('el heartbeat no cambia el estado', () => {
    expect(roomReducer(baseRoom, { type: 'heartbeat' })).toBe(baseRoom);
  });
});
