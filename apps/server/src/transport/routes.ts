import type { ConnectRouter, HandlerContext } from '@connectrpc/connect';
import { LeaderboardService, RaceService, RoomService } from '@typerace/proto-gen';
import type { Application, RoomEvent } from '../application/index.js';
import type { Clock } from '../application/ports/system.js';
import { playerTokenKey } from './context.js';
import { withHeartbeat } from './heartbeat.js';
import { heartbeatResponse, toProtoLeaderboardEntry, toWatchRoomResponse } from './mappers.js';

export interface RoutesOptions {
  app: Application;
  clock: Clock;
  heartbeatIntervalMs: number;
}

/** Token validado previamente por `authInterceptor`. */
const tokenOf = (ctx: HandlerContext) => ctx.values.get(playerTokenKey);

/**
 * Handlers Connect: traducen mensajes proto a llamadas de casos de uso y sus
 * resultados de vuelta a proto. No contienen lógica de negocio.
 */
export function createRoutes({ app, clock, heartbeatIntervalMs }: RoutesOptions) {
  return (router: ConnectRouter) => {
    router.service(RoomService, {
      async createRoom(req) {
        return { session: await app.createRoom.execute({ nickname: req.nickname }) };
      },
      async joinRoom(req) {
        const session = await app.joinRoom.execute({
          nickname: req.nickname,
          roomCode: req.roomCode,
        });
        return { session };
      },
      async reconnect(_req, ctx) {
        const { nickname, ...session } = await app.reconnect.execute(tokenOf(ctx));
        return { session, nickname };
      },
      async setReady(req, ctx) {
        await app.setReady.execute(tokenOf(ctx), req.ready);
        return {};
      },
      async leaveRoom(_req, ctx) {
        await app.leaveRoom.execute(tokenOf(ctx));
        return {};
      },
      async *watchRoom(_req, ctx) {
        const events = app.watchRoom.execute(tokenOf(ctx), ctx.signal);
        const stream = withHeartbeat<RoomEvent | null>(events, heartbeatIntervalMs, () => null);
        for await (const event of stream) {
          yield event ? toWatchRoomResponse(event, clock.now()) : heartbeatResponse(clock.now());
        }
      },
    });

    router.service(RaceService, {
      async startRace(_req, ctx) {
        return app.startRace.execute(tokenOf(ctx));
      },
      async submitProgress(req, ctx) {
        const progress = await app.submitProgress.execute(tokenOf(ctx), {
          raceId: req.raceId,
          typedCorrect: req.typedCharsCorrect,
          errors: req.errors,
        });
        return { percent: progress.percent, wpm: progress.wpm, finished: progress.finished };
      },
    });

    router.service(LeaderboardService, {
      async getLeaderboard(req) {
        const entries = await app.getLeaderboard.execute({ limit: req.limit });
        return { entries: entries.map(toProtoLeaderboardEntry) };
      },
    });
  };
}
