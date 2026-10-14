import { createClient, type Interceptor } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-web';
import { LeaderboardService, RaceService, RoomService } from '@typerace/proto-gen';
import { getApiUrl } from '../lib/env';
import { useSessionStore } from '../stores/session-store';

export const PLAYER_TOKEN_HEADER = 'x-player-token';

/** Adjunta el token de la sesión guardada como metadata en cada llamada. */
const playerTokenInterceptor: Interceptor = (next) => (req) => {
  const token = useSessionStore.getState().session?.playerToken;
  if (token && !req.header.has(PLAYER_TOKEN_HEADER)) req.header.set(PLAYER_TOKEN_HEADER, token);
  return next(req);
};

/**
 * Transporte con el protocolo Connect (binario). El servidor también acepta
 * gRPC-Web; Connect simplifica la depuración y funciona igual en streaming
 * del servidor. Ver docs/adr/0001.
 */
const transport = createConnectTransport({
  baseUrl: getApiUrl(),
  useBinaryFormat: true,
  interceptors: [playerTokenInterceptor],
});

export const roomClient = createClient(RoomService, transport);
export const raceClient = createClient(RaceService, transport);
export const leaderboardClient = createClient(LeaderboardService, transport);
