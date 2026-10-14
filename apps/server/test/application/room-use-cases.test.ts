import { describe, expect, it } from 'vitest';
import {
  InvalidStateError,
  NotFoundError,
  RoomFullError,
  UnauthenticatedError,
  ValidationError,
} from '../../src/domain/errors.js';
import { collect, createTestApp, flush } from '../helpers/fakes.js';

describe('CreateRoom / JoinRoom', () => {
  it('crea una sala y devuelve la sesión del anfitrión', async () => {
    const { app, rooms } = createTestApp();
    const session = await app.createRoom.execute({ nickname: '  Ana  ' });

    expect(session.roomCode).toMatch(/^[A-Z2-9]{6}$/);
    const room = await rooms.findByCode(session.roomCode);
    expect(room?.hostId).toBe(session.playerId);
    expect(room?.getPlayer(session.playerId).nickname).toBe('Ana');
  });

  it('reintenta si el código generado ya existe', async () => {
    const { app, ids } = createTestApp();
    ids.roomCodes.push('AAAAAA', 'AAAAAA', 'BBBBBB');
    expect((await app.createRoom.execute({ nickname: 'Ana' })).roomCode).toBe('AAAAAA');
    expect((await app.createRoom.execute({ nickname: 'Beto' })).roomCode).toBe('BBBBBB');
  });

  it('valida el apodo', async () => {
    const { app } = createTestApp();
    await expect(app.createRoom.execute({ nickname: 'x' })).rejects.toThrow(ValidationError);
  });

  it('se une con el código sin importar mayúsculas y notifica a la sala', async () => {
    const { app, bus } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const stream = collect(bus.subscribe(host.roomCode, new AbortController().signal));

    const guest = await app.joinRoom.execute({
      nickname: 'Beto',
      roomCode: host.roomCode.toLowerCase(),
    });
    await flush();

    expect(guest.roomCode).toBe(host.roomCode);
    expect(stream.events).toEqual([
      {
        type: 'playerJoined',
        player: {
          id: guest.playerId,
          nickname: 'Beto',
          isHost: false,
          isReady: false,
          isConnected: false,
        },
      },
    ]);
  });

  it('falla si la sala no existe o está llena', async () => {
    const { app } = createTestApp({ maxPlayers: 2 });
    await expect(app.joinRoom.execute({ nickname: 'Ana', roomCode: 'ZZZZZZ' })).rejects.toThrow(
      NotFoundError,
    );

    const { roomCode } = await app.createRoom.execute({ nickname: 'Ana' });
    await app.joinRoom.execute({ nickname: 'Beto', roomCode });
    await expect(app.joinRoom.execute({ nickname: 'Caro', roomCode })).rejects.toThrow(
      RoomFullError,
    );
  });
});

describe('Reconnect / SetReady / LeaveRoom', () => {
  it('recupera la sesión con el token', async () => {
    const { app } = createTestApp();
    const session = await app.createRoom.execute({ nickname: 'Ana' });
    expect(await app.reconnect.execute(session.playerToken)).toEqual({
      ...session,
      nickname: 'Ana',
    });
  });

  it('rechaza tokens ausentes o desconocidos', async () => {
    const { app } = createTestApp();
    await expect(app.reconnect.execute(undefined)).rejects.toThrow(UnauthenticatedError);
    await expect(app.reconnect.execute('nope')).rejects.toThrow(UnauthenticatedError);
  });

  it('publica el cambio de "listo"', async () => {
    const { app, bus } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const stream = collect(bus.subscribe(host.roomCode, new AbortController().signal));
    await app.setReady.execute(host.playerToken, true);
    await flush();
    expect(stream.events).toEqual([
      { type: 'playerReadyChanged', playerId: host.playerId, ready: true },
    ]);
  });

  it('al salir el anfitrión, el rol pasa al siguiente y su token deja de valer', async () => {
    const { app, bus } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const guest = await app.joinRoom.execute({ nickname: 'Beto', roomCode: host.roomCode });
    const stream = collect(bus.subscribe(host.roomCode, new AbortController().signal));

    await app.leaveRoom.execute(host.playerToken);
    await flush();

    expect(stream.events).toEqual([
      { type: 'playerLeft', playerId: host.playerId },
      { type: 'hostChanged', newHostId: guest.playerId },
    ]);
    await expect(app.reconnect.execute(host.playerToken)).rejects.toThrow(UnauthenticatedError);
  });

  it('elimina la sala cuando sale el último jugador y cierra los streams', async () => {
    const { app, rooms, bus } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const stream = collect(bus.subscribe(host.roomCode, new AbortController().signal));

    await app.leaveRoom.execute(host.playerToken);
    await stream.done;

    expect(await rooms.exists(host.roomCode)).toBe(false);
    expect(stream.types()).toEqual(['playerLeft']);
  });
});

describe('WatchRoom', () => {
  it('envía primero el snapshot y luego los eventos', async () => {
    const { app } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const controller = new AbortController();
    const stream = collect(app.watchRoom.execute(host.playerToken, controller.signal));
    await flush();

    await app.joinRoom.execute({ nickname: 'Beto', roomCode: host.roomCode });
    await flush();
    controller.abort();
    await stream.done;

    // El snapshot ya refleja la conexión; el evento posterior es redundante pero inocuo.
    expect(stream.types()).toEqual(['snapshot', 'playerConnectionChanged', 'playerJoined']);
    const snapshot = stream.events[0];
    expect(snapshot?.type === 'snapshot' && snapshot.room.players[0]?.isConnected).toBe(true);
  });

  it('marca conectado/desconectado según los streams abiertos', async () => {
    const { app, rooms } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const isConnected = async () =>
      (await rooms.findByCode(host.roomCode))?.getPlayer(host.playerId).connected;

    const tab1 = new AbortController();
    const tab2 = new AbortController();
    const s1 = collect(app.watchRoom.execute(host.playerToken, tab1.signal));
    const s2 = collect(app.watchRoom.execute(host.playerToken, tab2.signal));
    await flush();
    expect(await isConnected()).toBe(true);

    tab1.abort();
    await s1.done;
    expect(await isConnected()).toBe(true);

    tab2.abort();
    await s2.done;
    expect(await isConnected()).toBe(false);
  });

  it('termina el stream del jugador que abandona la sala', async () => {
    const { app } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    const guest = await app.joinRoom.execute({ nickname: 'Beto', roomCode: host.roomCode });
    const stream = collect(app.watchRoom.execute(guest.playerToken, new AbortController().signal));
    await flush();

    await app.leaveRoom.execute(guest.playerToken);
    await stream.done;
    expect(stream.types().at(-1)).toBe('playerLeft');
  });

  it('rechaza suscribirse sin token válido', async () => {
    const { app } = createTestApp();
    const stream = app.watchRoom.execute('nope', new AbortController().signal);
    await expect(stream.next()).rejects.toThrow(UnauthenticatedError);
  });
});

describe('CleanupInactiveRooms', () => {
  it('elimina solo las salas sin actividad reciente', async () => {
    const { app, clock, rooms, rules } = createTestApp();
    const old = await app.createRoom.execute({ nickname: 'Ana' });
    clock.current += rules.inactiveRoomTtlMs;
    const fresh = await app.createRoom.execute({ nickname: 'Beto' });
    clock.current += 1;

    expect(await app.cleanupInactiveRooms.execute()).toBe(1);
    expect(await rooms.exists(old.roomCode)).toBe(false);
    expect(await rooms.exists(fresh.roomCode)).toBe(true);
  });
});

describe('errores de estado', () => {
  it('no se puede marcar listo durante la carrera', async () => {
    const { app } = createTestApp();
    const host = await app.createRoom.execute({ nickname: 'Ana' });
    await app.startRace.execute(host.playerToken);
    await expect(app.setReady.execute(host.playerToken, true)).rejects.toThrow(InvalidStateError);
  });
});
