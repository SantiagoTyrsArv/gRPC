import type { AddressInfo } from 'node:net';
import { Code, ConnectError, createClient, type Transport } from '@connectrpc/connect';
import {
  createConnectTransport,
  createGrpcTransport,
  createGrpcWebTransport,
} from '@connectrpc/connect-node';
import {
  LeaderboardService,
  RaceService,
  RoomService,
  RoomStatus,
  type WatchRoomResponse,
} from '@typerace/proto-gen';
import type { FastifyInstance } from 'fastify';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildGrpcServer,
  buildHttpServer,
  type ServerOptions,
} from '../../src/transport/server.js';
import { createTestApp, TEST_TEXTS } from '../helpers/fakes.js';

const TEXT = TEST_TEXTS[0]!.content;

let ctx: ReturnType<typeof createTestApp>;
let server: FastifyInstance;
let baseUrl: string;

function serverOptions(overrides: Partial<ServerOptions> = {}): ServerOptions {
  return {
    app: ctx.app,
    clock: ctx.clock,
    logger: pino({ level: 'silent' }),
    corsOrigins: ['https://typerace.vercel.app', 'https://typerace-*.vercel.app'],
    allowLocalhost: false,
    heartbeatIntervalMs: 60_000,
    ...overrides,
  };
}

async function start(overrides: Partial<ServerOptions> = {}): Promise<void> {
  server = await buildHttpServer(serverOptions(overrides));
  await server.listen({ port: 0, host: '127.0.0.1' });
  baseUrl = `http://127.0.0.1:${(server.server.address() as AddressInfo).port}`;
}

function clients(transport: Transport) {
  return {
    room: createClient(RoomService, transport),
    race: createClient(RaceService, transport),
    leaderboard: createClient(LeaderboardService, transport),
  };
}

const auth = (token: string) => ({ headers: { 'x-player-token': token } });

/** Lee eventos del stream hasta encontrar uno que cumpla `predicate`. */
async function nextEvent(
  stream: AsyncIterator<WatchRoomResponse>,
  predicate: (event: WatchRoomResponse) => boolean,
): Promise<WatchRoomResponse> {
  for (;;) {
    const result = await stream.next();
    if (result.done) throw new Error('El stream terminó antes de lo esperado');
    if (predicate(result.value)) return result.value;
  }
}

async function expectCode(promise: Promise<unknown>, code: Code): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ConnectError);
  expect((error as ConnectError).code).toBe(code);
}

beforeEach(() => {
  ctx = createTestApp({ countdownMs: 3_000, raceDurationMs: 60_000 });
});

afterEach(async () => {
  await server.close();
});

describe('servidor Connect (integración)', () => {
  beforeEach(async () => {
    await start();
  });

  it('expone /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'disabled' });
  });

  it('carrera completa con protocolo Connect y streaming del servidor', async () => {
    const { room, race } = clients(createConnectTransport({ baseUrl, httpVersion: '1.1' }));
    const { session: host } = await room.createRoom({ nickname: 'Ana' });
    const abort = new AbortController();
    const stream = room
      .watchRoom({}, { ...auth(host!.playerToken), signal: abort.signal })
      [Symbol.asyncIterator]();

    const snapshot = await nextEvent(stream, (e) => e.event.case === 'snapshot');
    expect(snapshot.serverTime).toBeDefined();
    expect(snapshot.event.case === 'snapshot' && snapshot.event.value.state?.status).toBe(
      RoomStatus.WAITING,
    );

    const { session: guest } = await room.joinRoom({ nickname: 'Beto', roomCode: host!.roomCode });
    const joined = await nextEvent(stream, (e) => e.event.case === 'playerJoined');
    expect(joined.event.case === 'playerJoined' && joined.event.value.player?.nickname).toBe(
      'Beto',
    );

    await room.setReady({ ready: true }, auth(guest!.playerToken));
    const { raceId } = await race.startRace({}, auth(host!.playerToken));
    const countdown = await nextEvent(stream, (e) => e.event.case === 'countdownStarted');
    expect(countdown.event.case === 'countdownStarted' && countdown.event.value.race?.text).toBe(
      TEXT,
    );

    await ctx.scheduler.advance(3_000 + 6_000);
    await nextEvent(stream, (e) => e.event.case === 'raceStarted');

    const progress = await race.submitProgress(
      { raceId, typedCharsCorrect: TEXT.length, errors: 0 },
      auth(guest!.playerToken),
    );
    expect(progress).toMatchObject({ percent: 100, wpm: 20, finished: true });
    await race.submitProgress(
      { raceId, typedCharsCorrect: TEXT.length, errors: 3 },
      auth(host!.playerToken),
    );

    const finished = await nextEvent(stream, (e) => e.event.case === 'raceFinished');
    expect(
      finished.event.case === 'raceFinished' &&
        finished.event.value.results.map((r) => [r.nickname, r.position]),
    ).toEqual([
      ['Beto', 1],
      ['Ana', 2],
    ]);
    abort.abort();
  });

  it('gRPC-Web: ranking y reconexión', async () => {
    const { room, leaderboard } = clients(createGrpcWebTransport({ baseUrl, httpVersion: '1.1' }));
    const { session } = await room.createRoom({ nickname: 'Ana' });
    const reconnected = await room.reconnect({}, auth(session!.playerToken));
    expect(reconnected.nickname).toBe('Ana');
    expect(reconnected.session?.roomCode).toBe(session!.roomCode);
    expect((await leaderboard.getLeaderboard({ limit: 5 })).entries).toEqual([]);
  });

  it('traduce errores de dominio a códigos gRPC', async () => {
    const { room, race } = clients(createConnectTransport({ baseUrl, httpVersion: '1.1' }));
    await expectCode(room.createRoom({ nickname: 'x' }), Code.InvalidArgument);
    await expectCode(room.joinRoom({ nickname: 'Ana', roomCode: 'ZZZZZZ' }), Code.NotFound);
    await expectCode(room.setReady({ ready: true }), Code.Unauthenticated);
    await expectCode(room.setReady({ ready: true }, auth('falso')), Code.Unauthenticated);

    const { session: host } = await room.createRoom({ nickname: 'Ana' });
    const { session: guest } = await room.joinRoom({ nickname: 'Beto', roomCode: host!.roomCode });
    await expectCode(race.startRace({}, auth(guest!.playerToken)), Code.PermissionDenied);
    await expectCode(race.startRace({}, auth(host!.playerToken)), Code.FailedPrecondition);
  });

  it('rechaza el stream sin token', async () => {
    const { room } = clients(createConnectTransport({ baseUrl, httpVersion: '1.1' }));
    const stream = room.watchRoom({})[Symbol.asyncIterator]();
    await expectCode(stream.next(), Code.Unauthenticated);
  });

  it('CORS: permite solo los orígenes configurados (incluido comodín)', async () => {
    const preflight = (origin: string) =>
      fetch(`${baseUrl}/typerace.v1.RoomService/CreateRoom`, {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,x-player-token',
        },
      });

    const allowed = await preflight('https://typerace-git-feat-x.vercel.app');
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://typerace-git-feat-x.vercel.app',
    );
    expect(allowed.headers.get('access-control-allow-headers')).toContain('x-player-token');

    const denied = await preflight('https://evil.example.com');
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    const localhost = await preflight('http://localhost:5173');
    expect(localhost.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('heartbeat y rate limiting', () => {
  it('envía heartbeats periódicos en el stream', async () => {
    await start({ heartbeatIntervalMs: 30 });
    const { room } = clients(createConnectTransport({ baseUrl, httpVersion: '1.1' }));
    const { session } = await room.createRoom({ nickname: 'Ana' });
    const abort = new AbortController();
    const stream = room
      .watchRoom({}, { ...auth(session!.playerToken), signal: abort.signal })
      [Symbol.asyncIterator]();

    const heartbeat = await nextEvent(stream, (e) => e.event.case === 'heartbeat');
    expect(heartbeat.serverTime).toBeDefined();
    abort.abort();
  });

  it('devuelve RESOURCE_EXHAUSTED al superar el límite', async () => {
    await start({
      rateLimits: {
        actions: { capacity: 2, refillPerSecond: 0.001 },
        roomCreation: { capacity: 1, refillPerSecond: 0.001 },
      },
    });
    const { room } = clients(createConnectTransport({ baseUrl, httpVersion: '1.1' }));
    const { session } = await room.createRoom({ nickname: 'Ana' });
    await expectCode(room.createRoom({ nickname: 'Beto' }), Code.ResourceExhausted);

    await room.setReady({ ready: true }, auth(session!.playerToken));
    await room.setReady({ ready: false }, auth(session!.playerToken));
    await expectCode(
      room.setReady({ ready: true }, auth(session!.playerToken)),
      Code.ResourceExhausted,
    );
  });
});

describe('gRPC nativo sobre HTTP/2 (h2c)', () => {
  it('atiende clientes gRPC puros con las mismas rutas', async () => {
    await start();
    const grpc = buildGrpcServer(serverOptions());
    await new Promise<void>((resolve) => grpc.listen(0, '127.0.0.1', resolve));
    const port = (grpc.address() as AddressInfo).port;
    try {
      const { room } = clients(createGrpcTransport({ baseUrl: `http://127.0.0.1:${port}` }));
      const { session } = await room.createRoom({ nickname: 'Bot' });
      expect(session?.roomCode).toMatch(/^[A-Z2-9]{6}$/);
      await expectCode(room.joinRoom({ nickname: 'Bot2', roomCode: 'ZZZZZZ' }), Code.NotFound);
    } finally {
      await new Promise((resolve) => grpc.close(resolve));
    }
  });
});
