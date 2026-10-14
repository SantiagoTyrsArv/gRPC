import { pino, type Logger } from 'pino';
import type { Env } from '../config/env.js';

/** JSON estructurado en producción; salida legible (pino-pretty) en desarrollo. */
export function createLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Logger {
  return pino({
    level: env.LOG_LEVEL,
    base: { service: 'typerace-server' },
    redact: ['req.headers["x-player-token"]', 'playerToken'],
    ...(env.NODE_ENV === 'development' && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
      },
    }),
  });
}
