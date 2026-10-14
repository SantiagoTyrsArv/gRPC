import http2 from 'node:http2';
import { cors as connectCors, createContextValues, type Interceptor } from '@connectrpc/connect';
import { fastifyConnectPlugin } from '@connectrpc/connect-fastify';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import fastifyCors from '@fastify/cors';
import { fastify, LogController, type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger as PinoLogger } from 'pino';
import type { Application } from '../application/index.js';
import type { Clock } from '../application/ports/system.js';
import { clientIpKey, PLAYER_TOKEN_HEADER } from './context.js';
import { createOriginMatcher } from './cors.js';
import { authInterceptor, errorInterceptor, rateLimitInterceptor } from './interceptors.js';
import { TokenBucketRateLimiter } from './rate-limiter.js';
import { createRoutes } from './routes.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error' | 'disabled';
}

export interface ServerOptions {
  app: Application;
  clock: Clock;
  logger: PinoLogger;
  corsOrigins: readonly string[];
  allowLocalhost: boolean;
  heartbeatIntervalMs?: number;
  rateLimits?: {
    actions: { capacity: number; refillPerSecond: number };
    roomCreation: { capacity: number; refillPerSecond: number };
  };
  checkDatabase?: () => Promise<boolean>;
}

/** ~15 s: por debajo del tiempo de inactividad de los proxies (Railway). */
export const DEFAULT_HEARTBEAT_MS = 15_000;

const DEFAULT_RATE_LIMITS = {
  // ~5 progresos/s durante la carrera + otras acciones, con ráfagas.
  actions: { capacity: 30, refillPerSecond: 10 },
  // Crear o unirse a salas: 10 de golpe y luego 1 cada 3 s por IP.
  roomCreation: { capacity: 10, refillPerSecond: 1 / 3 },
};

/** Construye la cadena de interceptores (el primero es el más externo). */
function createInterceptors(options: ServerOptions) {
  const limits = options.rateLimits ?? DEFAULT_RATE_LIMITS;
  const limiters = {
    actions: new TokenBucketRateLimiter(limits.actions),
    roomCreation: new TokenBucketRateLimiter(limits.roomCreation),
  };
  const interceptors: Interceptor[] = [
    errorInterceptor(options.logger),
    rateLimitInterceptor(limiters),
    authInterceptor(options.app.sessions),
  ];
  const pruneTimer = setInterval(() => {
    limiters.actions.prune();
    limiters.roomCreation.prune();
  }, 60_000);
  pruneTimer.unref();
  return interceptors;
}

/**
 * Servidor HTTP/1.1 (Fastify) que atiende los protocolos Connect, gRPC-Web y
 * gRPC sobre las mismas rutas, más `/health` y CORS para el frontend.
 */
export async function buildHttpServer(options: ServerOptions): Promise<FastifyInstance> {
  const loggerInstance: FastifyBaseLogger = options.logger;
  const server = fastify({
    loggerInstance,
    // Railway termina TLS en su proxy: confiar en X-Forwarded-For para la IP real.
    trustProxy: true,
    // Las RPC se registran en `errorInterceptor`; se evita duplicar logs por petición.
    logController: new LogController({ disableRequestLogging: true }),
  });

  const isAllowedOrigin = createOriginMatcher(options.corsOrigins, {
    allowLocalhost: options.allowLocalhost,
  });
  await server.register(fastifyCors, {
    origin: (origin, callback) => {
      // Sin cabecera Origin: clientes no navegador (curl, bot gRPC, healthcheck).
      callback(null, !origin || isAllowedOrigin(origin));
    },
    methods: [...connectCors.allowedMethods],
    allowedHeaders: [...connectCors.allowedHeaders, PLAYER_TOKEN_HEADER],
    exposedHeaders: [...connectCors.exposedHeaders],
    maxAge: 2 * 60 * 60,
  });

  server.get('/health', async (_request, reply) => {
    const health = await healthStatus(options.checkDatabase);
    return reply.code(health.status === 'ok' ? 200 : 503).send(health);
  });

  await server.register(fastifyConnectPlugin, {
    routes: createRoutes({
      app: options.app,
      clock: options.clock,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS,
    }),
    interceptors: createInterceptors(options),
    contextValues: (request) => createContextValues().set(clientIpKey, request.ip),
    // Al cerrar, espera hasta 5 s y luego aborta los streams abiertos (WatchRoom).
    shutdownTimeoutMs: 5_000,
  });

  return server;
}

/**
 * Servidor HTTP/2 sin TLS (h2c) con las mismas rutas, para clientes gRPC
 * nativos (bot CLI). Opcional: solo se levanta si se define `GRPC_PORT`.
 */
export function buildGrpcServer(options: ServerOptions): http2.Http2Server {
  const handler = connectNodeAdapter({
    routes: createRoutes({
      app: options.app,
      clock: options.clock,
      heartbeatIntervalMs: options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS,
    }),
    interceptors: createInterceptors(options),
    contextValues: (request) =>
      createContextValues().set(clientIpKey, request.socket.remoteAddress ?? 'unknown'),
  });
  return http2.createServer(handler);
}

async function healthStatus(checkDatabase?: () => Promise<boolean>): Promise<HealthStatus> {
  if (!checkDatabase) return { status: 'ok', database: 'disabled' };
  const ok = await checkDatabase();
  return { status: ok ? 'ok' : 'degraded', database: ok ? 'ok' : 'error' };
}
