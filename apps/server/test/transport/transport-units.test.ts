import { Code } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { NotFoundError, RoomFullError } from '../../src/domain/errors.js';
import { RACE_TEXTS } from '../../src/infrastructure/seed/race-texts.js';
import { createOriginMatcher } from '../../src/transport/cors.js';
import { toConnectError } from '../../src/transport/errors.js';
import { withHeartbeat } from '../../src/transport/heartbeat.js';
import { TokenBucketRateLimiter } from '../../src/transport/rate-limiter.js';
import { silentLogger } from '../helpers/fakes.js';

describe('toConnectError', () => {
  it('mapea errores de dominio y oculta los inesperados', () => {
    expect(toConnectError(new NotFoundError('no'), silentLogger).code).toBe(Code.NotFound);
    expect(toConnectError(new RoomFullError('llena'), silentLogger).code).toBe(
      Code.ResourceExhausted,
    );
    const internal = toConnectError(new Error('secreto de la base de datos'), silentLogger);
    expect(internal.code).toBe(Code.Internal);
    expect(internal.rawMessage).not.toContain('secreto');
  });
});

describe('TokenBucketRateLimiter', () => {
  it('permite ráfagas y recupera fichas con el tiempo', () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
    expect(limiter.tryConsume('b')).toBe(true); // claves independientes
    now = 1_000;
    expect(limiter.tryConsume('a')).toBe(true);
    expect(limiter.tryConsume('a')).toBe(false);
  });

  it('elimina cubetas inactivas', () => {
    let now = 0;
    const limiter = new TokenBucketRateLimiter({ capacity: 2, refillPerSecond: 1, now: () => now });
    limiter.tryConsume('a');
    now = 10_000;
    limiter.prune();
    expect(limiter.size).toBe(0);
  });
});

describe('createOriginMatcher', () => {
  const match = createOriginMatcher(['https://typerace.vercel.app', 'https://tr-*.vercel.app'], {
    allowLocalhost: true,
  });

  it.each([
    ['https://typerace.vercel.app', true],
    ['https://tr-abc-123.vercel.app', true],
    ['http://localhost:5173', true],
    ['http://127.0.0.1:4173', true],
    ['https://typerace.vercel.app.evil.com', false],
    ['https://tr-a.b.vercel.app', false],
    ['https://otro.com', false],
  ])('%s → %s', (origin, expected) => {
    expect(match(origin)).toBe(expected);
  });
});

describe('withHeartbeat', () => {
  it('intercala latidos cuando la fuente está inactiva', async () => {
    async function* slowSource() {
      yield 'a';
      await new Promise((resolve) => setTimeout(resolve, 70));
      yield 'b';
    }
    const items: string[] = [];
    for await (const item of withHeartbeat(slowSource(), 20, () => 'hb')) items.push(item);
    expect(items[0]).toBe('a');
    expect(items.at(-1)).toBe('b');
    expect(items.filter((i) => i === 'hb').length).toBeGreaterThanOrEqual(2);
  });
});

describe('loadEnv', () => {
  it('aplica valores por defecto en desarrollo', () => {
    const env = loadEnv({ CORS_ORIGIN: 'https://a.com/, https://b.com', GRPC_PORT: '' });
    expect(env).toMatchObject({ NODE_ENV: 'development', PORT: 8080, HOST: '0.0.0.0' });
    expect(env.CORS_ORIGIN).toEqual(['https://a.com', 'https://b.com']);
    expect(env.GRPC_PORT).toBeUndefined();
  });

  it('exige DATABASE_URL y CORS_ORIGIN en producción', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL[\s\S]*CORS_ORIGIN/);
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});

describe('seed de textos', () => {
  it('tiene al menos 20 textos únicos de 150–300 caracteres', () => {
    expect(RACE_TEXTS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(RACE_TEXTS).size).toBe(RACE_TEXTS.length);
    for (const text of RACE_TEXTS) {
      expect(text.length, text).toBeGreaterThanOrEqual(150);
      expect(text.length, text).toBeLessThanOrEqual(300);
      expect(text).toBe(text.trim());
    }
  });
});
