import { Code, ConnectError, type Interceptor } from '@connectrpc/connect';
import type { SessionResolver } from '../application/session-resolver.js';
import type { Logger } from '../application/ports/system.js';
import { clientIpKey, PLAYER_TOKEN_HEADER, playerTokenKey } from './context.js';
import { toConnectError } from './errors.js';
import type { TokenBucketRateLimiter } from './rate-limiter.js';

/** RPC que no requieren token de jugador. */
const PUBLIC_METHODS = new Set(['CreateRoom', 'JoinRoom', 'GetLeaderboard']);
/** RPC que crean recursos: límite más estricto, por IP. */
const ROOM_CREATION_METHODS = new Set(['CreateRoom', 'JoinRoom']);

/**
 * Interceptor más externo: registra cada RPC y traduce cualquier error (también
 * los que ocurren a mitad de un stream) a un `ConnectError` con código gRPC.
 */
export function errorInterceptor(logger: Logger): Interceptor {
  return (next) => async (req) => {
    const startedAt = performance.now();
    const rpc = `${req.service.name}/${req.method.name}`;
    try {
      const res = await next(req);
      logger.debug({ rpc, ms: Math.round(performance.now() - startedAt) }, 'RPC completada');
      if (!res.stream) return res;
      return { ...res, message: mapStreamErrors(res.message, logger, rpc) };
    } catch (error) {
      const connectError = toConnectError(error, logger);
      logger.info(
        { rpc, code: Code[connectError.code], msg: connectError.rawMessage },
        'RPC rechazada',
      );
      throw connectError;
    }
  };
}

async function* mapStreamErrors<T>(source: AsyncIterable<T>, logger: Logger, rpc: string) {
  try {
    yield* source;
  } catch (error) {
    const connectError = toConnectError(error, logger);
    logger.info({ rpc, code: Code[connectError.code] }, 'Stream terminado con error');
    throw connectError;
  }
}

/**
 * Rate limiting de RPC unarias: por token (o IP si no hay token) para acciones,
 * y por IP para crear/unirse a salas. Los streams no consumen fichas.
 */
export function rateLimitInterceptor(limiters: {
  actions: TokenBucketRateLimiter;
  roomCreation: TokenBucketRateLimiter;
}): Interceptor {
  return (next) => (req) => {
    if (req.stream) return next(req);
    const ip = req.contextValues.get(clientIpKey);
    const method = req.method.name;
    const allowed = ROOM_CREATION_METHODS.has(method)
      ? limiters.roomCreation.tryConsume(`ip:${ip}`)
      : limiters.actions.tryConsume(req.header.get(PLAYER_TOKEN_HEADER) ?? `ip:${ip}`);
    if (!allowed) {
      throw new ConnectError('Demasiadas solicitudes, espera un momento', Code.ResourceExhausted);
    }
    return next(req);
  };
}

/**
 * Valida el token del header `x-player-token` en las RPC protegidas y lo deja
 * disponible para los handlers a través de los context values.
 */
export function authInterceptor(sessions: SessionResolver): Interceptor {
  return (next) => async (req) => {
    if (PUBLIC_METHODS.has(req.method.name)) return next(req);
    const token = req.header.get(PLAYER_TOKEN_HEADER) ?? undefined;
    await sessions.resolve(token); // lanza UnauthenticatedError si no es válido
    req.contextValues.set(playerTokenKey, token);
    return next(req);
  };
}
