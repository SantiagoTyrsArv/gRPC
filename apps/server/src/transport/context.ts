import { createContextKey } from '@connectrpc/connect';

/** Header (metadata gRPC) con el token del jugador. */
export const PLAYER_TOKEN_HEADER = 'x-player-token';

/** Token validado por el interceptor de autenticación. */
export const playerTokenKey = createContextKey<string | undefined>(undefined, {
  description: 'Token del jugador autenticado',
});

/** IP del cliente (tras el proxy), usada por el rate limiter. */
export const clientIpKey = createContextKey<string>('unknown', {
  description: 'IP del cliente',
});
