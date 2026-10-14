/**
 * Punto de entrada y raíz de composición: aquí (y solo aquí) se eligen las
 * implementaciones concretas de cada puerto y se conectan entre sí.
 */
import { createApplication, DEFAULT_GAME_RULES } from './application/index.js';
import type { RaceResultRepository } from './application/ports/race-result-repository.js';
import type { TextRepository } from './application/ports/text-repository.js';
import { loadEnv } from './config/env.js';
import { createDatabase, type DatabaseConnection } from './infrastructure/db/client.js';
import {
  DrizzleRaceResultRepository,
  DrizzleTextRepository,
} from './infrastructure/db/drizzle-repositories.js';
import { createLogger } from './infrastructure/logger.js';
import { InMemoryRoomEventBus } from './infrastructure/memory/in-memory-event-bus.js';
import { InMemoryRaceResultRepository } from './infrastructure/memory/in-memory-race-result-repository.js';
import { InMemoryRoomRepository } from './infrastructure/memory/in-memory-room-repository.js';
import { InMemoryTextRepository } from './infrastructure/memory/in-memory-text-repository.js';
import { RACE_TEXTS } from './infrastructure/seed/race-texts.js';
import { CryptoIdGenerator, SystemClock, TimeoutScheduler } from './infrastructure/system.js';
import { buildGrpcServer, buildHttpServer } from './transport/server.js';

const CLEANUP_INTERVAL_MS = 5 * 60_000;

const env = loadEnv();
const logger = createLogger(env);

let database: DatabaseConnection | undefined;
let texts: TextRepository;
let results: RaceResultRepository;

if (env.DATABASE_URL) {
  database = createDatabase(env.DATABASE_URL);
  texts = new DrizzleTextRepository(database.db);
  results = new DrizzleRaceResultRepository(database.db);
} else {
  logger.warn({}, 'Sin DATABASE_URL: textos y resultados en memoria (solo desarrollo)');
  texts = new InMemoryTextRepository(
    RACE_TEXTS.map((content, index) => ({ id: String(index + 1), content })),
  );
  results = new InMemoryRaceResultRepository();
}

const clock = new SystemClock();
const scheduler = new TimeoutScheduler(logger);
const app = createApplication({
  rooms: new InMemoryRoomRepository(),
  bus: new InMemoryRoomEventBus(),
  texts,
  results,
  clock,
  ids: new CryptoIdGenerator(),
  scheduler,
  logger,
  rules: DEFAULT_GAME_RULES,
});

const serverOptions = {
  app,
  clock,
  logger,
  corsOrigins: env.CORS_ORIGIN,
  allowLocalhost: env.NODE_ENV !== 'production',
  ...(database && { checkDatabase: database.ping }),
};

const httpServer = await buildHttpServer(serverOptions);
await httpServer.listen({ port: env.PORT, host: env.HOST });

const grpcServer = env.GRPC_PORT ? buildGrpcServer(serverOptions) : undefined;
if (grpcServer && env.GRPC_PORT) {
  const grpcPort = env.GRPC_PORT;
  grpcServer.listen(grpcPort, env.HOST, () => {
    logger.info({ port: grpcPort }, 'Servidor gRPC nativo (h2c) escuchando');
  });
}

const cleanupTimer = setInterval(() => {
  app.cleanupInactiveRooms.execute().catch((error: unknown) => {
    logger.error({ err: error }, 'Fallo al limpiar salas inactivas');
  });
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Apagando servidor');
  clearInterval(cleanupTimer);
  scheduler.cancelAll();
  grpcServer?.close();
  await httpServer.close();
  await database?.close();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown(signal));
}
